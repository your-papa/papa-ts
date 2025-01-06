import { RunnableConfig, RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { GenModel } from '../ProviderRegistry/GenProvider';
import { BaseAssistant, AssistantResponse, PipeInput } from './BaseAssistant';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Language, Prompts } from '../Prompts';
import { applyPatch } from 'fast-json-patch';
import { Document } from '@langchain/core/documents';
import Log from '../Logging';
import llamaTokenizer from 'llama-tokenizer-js';
import { IndexingMode, KnowledgeIndex } from '../KnowledgeIndex/KnowledgeIndex';
import { EmbedModel } from '../ProviderRegistry/EmbedProvider';

export type RAGAssistantConfig = {
    embedModel: EmbedModel;
    genModel: GenModel;
    numOfDocsToRetrieve?: number;
    lang?: Language;
};

export class RAGAssistant extends BaseAssistant {
    private knowledgeIndex: KnowledgeIndex;

    private constructor(knowledgeIndex: KnowledgeIndex, genModel: GenModel, lang?: Language) {
        super(genModel);
        this.knowledgeIndex = knowledgeIndex;
        this.lang = lang ?? 'en';
    }

    static async create(config: RAGAssistantConfig) {
        const knowledgeIndex = await KnowledgeIndex.create(config.embedModel, config.numOfDocsToRetrieve ?? 20);
        return new RAGAssistant(knowledgeIndex, config.genModel, config.lang);
    }

    run(input: PipeInput): AsyncGenerator<AssistantResponse> {
        const pipe = RunnableSequence.from([
            {
                query: (input: PipeInput) => input.userQuery,
                chatHistory: (input: PipeInput) => input.chatHistory,
                context: RunnableSequence.from([
                    (input: PipeInput) => input.userQuery,
                    this.knowledgeIndex
                        .getRetriever()
                        .withConfig({ runName: 'Retrieving' })
                        .pipe(this.getDocsPostProcessor(input))
                        .withConfig({ runName: 'PPDocs' })
                        .pipe(this.getDocsReducePipe(input)),
                ]).withConfig({ runName: 'Retrieving Notes' }),
            },
            this.getPreprocessPromptPipe(input),
            this.genModel.lc,
            new StringOutputParser(),
        ]).withConfig({ runName: 'RAG Chat Pipe' });

        return this.streamProcessor(pipe.streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined));
    }

    embedDocuments(documents: Document[], indexingMode: IndexingMode = 'full') {
        Log.info('Embedding documents in mode', indexingMode);
        return this.knowledgeIndex?.embedDocuments(documents, indexingMode);
    }

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        Log.info('Deleting documents based on', basedOn);
        await this.knowledgeIndex?.deleteDocuments(basedOn);
    }

    async load(vectorStoreBackup: Uint8Array) {
        if (!this.knowledgeIndex) throw new Error('Knowledge index is not setuped');
        await this.knowledgeIndex.load(vectorStoreBackup);
    }

    async getData(): Promise<Uint8Array> {
        if (!this.knowledgeIndex) throw new Error('Knowledge index is not setuped');
        return this.knowledgeIndex.getData();
    }

    protected async *streamProcessor(responseStream: AsyncGenerator<any>): AsyncGenerator<AssistantResponse> {
        let pipeOutput: any = {};
        let retrieving = false;
        let retrieved = false;
        let reducing = false;
        let generatedText = '';
        let sbResponse: AssistantResponse = { status: 'startup' };
        for await (const response of responseStream) {
            if (this.stopRunFlag) {
                this.stopRunFlag = false;
                yield { status: 'stopped', content: generatedText };
                return;
            }
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // Log.info('Stream Log', structuredClone(pipeOutput));
            if (!retrieving && pipeOutput.logs.Retrieving) {
                retrieving = true;
                sbResponse = { status: 'retrieving' };
            } else if (!retrieved && pipeOutput.logs.Retrieving?.final_output?.documents) {
                sbResponse = { status: 'retrieving', content: pipeOutput.logs.Retrieving.final_output.documents.length };
                retrieved = true;
            } else if (!reducing && pipeOutput.logs.PPDocs?.final_output?.needsReduce) {
                reducing = true;
                sbResponse = { status: 'reducing', content: pipeOutput.logs.PPDocs.final_output.notes.length };
            } else if (pipeOutput.streamed_output.join('') !== '') {
                generatedText = pipeOutput.streamed_output.join('');
                sbResponse = { status: 'generating', content: generatedText };
            }
            yield sbResponse;
        }
    }

    private getDocsPostProcessor(pipeInput: PipeInput) {
        return async (documents: Document[]) => {
            // TODO add a check for the userQuery length
            const reducePrompt = (
                await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })
            ).toString();
            const tokenMax = this.genModel.config.contextWindow - (await getTokenCount(this.genModel, reducePrompt));

            Log.debug('Retrieved Docs', documents);
            // group documents by filepath
            const documentsByFilepath: Record<string, Document[]> = {};
            for (const document of documents) {
                if (!documentsByFilepath[document.metadata.filepath]) {
                    documentsByFilepath[document.metadata.filepath] = [];
                }
                documentsByFilepath[document.metadata.filepath].push(document);
            }

            const processedDocuments: string[] = [];
            for (const filepath in documentsByFilepath) {
                // reorder documents by order
                documentsByFilepath[filepath].sort((a, b) => a.metadata.order - b.metadata.order);

                // combine documents by filepath and headers
                let contents: string[] = [];
                let lastHeader: string[] = [''];
                for (const document of documentsByFilepath[filepath]) {
                    let header = '';
                    for (let i = 0; i < document.metadata.header.length; i++) {
                        if (document.metadata.header[i] !== lastHeader[i]) {
                            header += document.metadata.header[i] + '\n';
                        }
                    }
                    lastHeader = document.metadata.header;
                    contents.push(header + document.pageContent);
                }

                // split documents by length to fit into context length
                const splitedContents = await splitContents(contents, (content: string) => getTokenCount(this.genModel, content), tokenMax);
                const hasMultipleParts = splitedContents.length > 1;
                splitedContents.forEach((contents, i) => {
                    let content = '';
                    content += '<note>\n';
                    content += 'Wikilink: [[' + filepath.replace('.md', '') + ']]' + (hasMultipleParts ? ' Part ' + (i + 1) : '') + '\n';
                    content += contents.join('\n\n');
                    content += '\n</note>';
                    processedDocuments.push(content);
                });
            }

            const needsReduce = (await getTokenCount(this.genModel, processedDocuments.join('\n\n'))) > tokenMax;
            Log.debug('Postprocessed Docs', processedDocuments);
            return { notes: processedDocuments, needsReduce };
        };
    }

    private getDocsReducePipe(pipeInput: PipeInput) {
        return async (postProcessedResult: { notes: string[]; needsReduce: boolean }, config?: RunnableConfig<Record<string, any>>) => {
            if (!postProcessedResult.needsReduce) return postProcessedResult.notes.join('\n\n');
            let contents = postProcessedResult.notes;
            let reduceCount = 0;

            const reducePrompt = (
                await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })
            ).toString();
            const tokenMax = this.genModel.config.contextWindow - (await getTokenCount(this.genModel, reducePrompt));

            do {
                if (config) config.runName = `Reduce ${reduceCount + 1}`;

                // split notes by length to fit into context length
                const splitedContents = await splitContents(contents, (content: string) => getTokenCount(this.genModel, content), tokenMax);
                const reduceChain = RunnableSequence.from([
                    { content: new RunnablePassthrough(), query: () => pipeInput.userQuery },
                    reduceCount === 0
                        ? PromptTemplate.fromTemplate(Prompts[pipeInput.lang].initialReduce)
                        : PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce),
                    this.genModel.lc,
                    new StringOutputParser(),
                ]);
                contents = await Promise.all(splitedContents.map((contents) => reduceChain.invoke(contents.join('\n\n'))));
                Log.debug('Reduced Docs', contents);
                reduceCount += 1;
            } while ((await getTokenCount(this.genModel, contents.join('\n\n'))) > tokenMax);
            return contents.join('\n\n');
        };
    }

    private getPreprocessPromptPipe(input: PipeInput) {
        return async ({ query, chatHistory, context }: { query: string; chatHistory: string; context: string }) => {
            const ragPrompt = (await PromptTemplate.fromTemplate(Prompts[input.lang].rag).formatPromptValue({ query, context, chatHistory })).toString();
            if (this.genModel.config.contextWindow > (await getTokenCount(this.genModel, ragPrompt))) return ragPrompt;
            // TODO: if the chathistory or the input is too long, we should summarize
            return "Please echo 'The chathistory is too long, please create a new chat or summarize it.'";
        };
    }
}

async function getTokenCount(model: GenModel, content: string) {
    // if (isOpenAIGenModel(model)) {
    //     return await model.lcModel!.getNumTokens(content);
    // } else {
    return (llamaTokenizer.encode(content) || []).length;
    //}
}

async function splitContents(contents: string[], getNumTokens: (content: string) => Promise<number>, tokenMax: number) {
    const splitContents: string[][] = [];
    let subResultContents: string[] = [];
    for (const content of contents) {
        subResultContents.push(content);
        const numTokens = await getNumTokens(subResultContents.join('\n\n'));
        if (numTokens > tokenMax) {
            if (subResultContents.length === 1)
                throw new Error(
                    'User query is too long or a single document was longer than the context length (should not happen as we split documents by length in post processing).'
                );
            splitContents.push(subResultContents.slice(0, -1));
            subResultContents = subResultContents.slice(-1);
        }
    }
    splitContents.push(subResultContents);
    return splitContents;
}
