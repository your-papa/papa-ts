import { BaseCallbackConfig } from '@langchain/core/callbacks/manager';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { PromptTemplate } from '@langchain/core/prompts';
import llamaTokenizer from 'llama-tokenizer-js';

import { Language, Prompts } from './Prompts';
import Log from './Logging';
import { GenModel, isOpenAIGenModel } from './Models';

export type PipeInput = {
    isRAG: boolean;
    userQuery: string;
    chatHistory: string;
    lang: Language;
};

async function getTokenCount(model: GenModel, content: string) {
    if (isOpenAIGenModel(model)) {
        return await model.lcModel!.getNumTokens(content);
    } else {
        return (llamaTokenizer.encode(content) || []).length;
    }
}

export function createRagPipe(retriever: VectorStoreRetriever, model: GenModel, input: PipeInput) {
    const ragChain = RunnableSequence.from([
        {
            query: (input: PipeInput) => input.userQuery,
            chatHistory: (input: PipeInput) => input.chatHistory,
            context: RunnableSequence.from([
                (input: PipeInput) => input.userQuery,
                retriever
                    .withConfig({ runName: 'Retrieving' })
                    .pipe(getDocsPostProcessor(model, input))
                    .withConfig({ runName: 'PPDocs' })
                    .pipe(getDocsReducePipe(model, input)),
            ]).withConfig({ runName: 'Retrieving Notes' }),
        },
        getPreprocessPromptPipe(model, input),
        model.lcModel!,
        new StringOutputParser(),
    ]).withConfig({ runName: 'RAG Chat Pipe' });
    return ragChain;
}

export function createConversationPipe(model: GenModel, input: PipeInput) {
    const conversationChain = RunnableSequence.from([
        {
            query: (input: PipeInput) => input.userQuery,
            chatHistory: (input: PipeInput) => input.chatHistory,
        },
        PromptTemplate.fromTemplate(Prompts[input.lang].conversation),
        model.lcModel!,
        new StringOutputParser(),
    ]).withConfig({ runName: 'Normal Chat Pipe' });
    return conversationChain;
}

function getDocsPostProcessor(model: GenModel, pipeInput: PipeInput) {
    return async (documents: Document[]) => {
        // TODO add a check for the userQuery length
        const reducePrompt = (
            await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })
        ).toString();
        const tokenMax = model.contextWindow! - (await getTokenCount(model, reducePrompt));

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
            const splitedContents = await splitContents(contents, (content: string) => getTokenCount(model, content), tokenMax);
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

        const needsReduce = (await getTokenCount(model, processedDocuments.join('\n\n'))) > tokenMax;
        Log.debug('Postprocessed Docs', processedDocuments);
        return { notes: processedDocuments, needsReduce };
    };
}

function getDocsReducePipe(model: GenModel, pipeInput: PipeInput) {
    return async (
        postProcessedResult: { notes: string[]; needsReduce: boolean },
        options?: {
            config?: BaseCallbackConfig;
        }
    ) => {
        if (!postProcessedResult.needsReduce) return postProcessedResult.notes.join('\n\n');
        const editableConfig = options?.config;
        let contents = postProcessedResult.notes;
        let reduceCount = 0;

        const reducePrompt = (
            await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })
        ).toString();
        const tokenMax = model.contextWindow! - (await getTokenCount(model, reducePrompt));

        do {
            if (editableConfig) editableConfig.runName = `Reduce ${reduceCount + 1}`;

            // split notes by length to fit into context length
            const splitedContents = await splitContents(contents, (content: string) => getTokenCount(model, content), tokenMax);
            const reduceChain = RunnableSequence.from([
                { content: new RunnablePassthrough(), query: () => pipeInput.userQuery },
                reduceCount === 0
                    ? PromptTemplate.fromTemplate(Prompts[pipeInput.lang].initialReduce)
                    : PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce),
                model.lcModel!,
                new StringOutputParser(),
            ]);
            contents = await Promise.all(splitedContents.map((contents) => reduceChain.invoke(contents.join('\n\n'))));
            Log.debug('Reduced Docs', contents);
            reduceCount += 1;
        } while ((await getTokenCount(model, contents.join('\n\n'))) > tokenMax);
        return contents.join('\n\n');
    };
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

function getPreprocessPromptPipe(model: GenModel, input: PipeInput) {
    return async ({ query, chatHistory, context }: { query: string; chatHistory: string; context: string }) => {
        const ragPrompt = (await PromptTemplate.fromTemplate(Prompts[input.lang].rag).formatPromptValue({ query, context, chatHistory })).toString();
        if (model.contextWindow! > (await getTokenCount(model, ragPrompt))) return ragPrompt;
        // TODO: if the chathistory or the input is too long, we should summarize
        return "Please echo 'The chathistory is too long, please create a new chat or summarize it.'";
    };
}
