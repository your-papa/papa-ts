import { BaseCallbackConfig } from '@langchain/core/callbacks/manager';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { PromptTemplate } from '@langchain/core/prompts';

import { Language, Prompts } from './Prompts';
import Log from './Logging';

export type PipeInput = {
    isRAG: boolean;
    userQuery: string;
    chatHistory: string;
    lang: Language;
};

export function createRagPipe(retriever: VectorStoreRetriever, model: BaseChatModel, input: PipeInput) {
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
        PromptTemplate.fromTemplate(Prompts[input.lang].rag),
        model,
        new StringOutputParser(),
    ]).withConfig({ runName: 'RAG Chat Pipe' });
    return ragChain;
}

export function createConversationPipe(model: BaseChatModel, input: PipeInput) {
    const conversationChain = RunnableSequence.from([
        {
            query: (input: PipeInput) => input.userQuery,
            chatHistory: (input: PipeInput) => input.chatHistory,
        },
        PromptTemplate.fromTemplate(Prompts[input.lang].conversation),
        model,
        new StringOutputParser(),
    ]).withConfig({ runName: 'Normal Chat Pipe' });
    return conversationChain;
}

function getDocsPostProcessor(model: BaseChatModel, pipeInput: PipeInput) {
    return async (documents: Document[]) => {
        const tokenMax =
            2000 -
            (await model.getNumTokens(
                (await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })).toString()
            )) -
            5; // not sure why we need to subtract 5 tokens more
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
            const splitedContents = await splitContents(contents, (content: string) => model.getNumTokens(content), tokenMax);
            const hasMultipleParts = splitedContents.length > 1;
            splitedContents.forEach((contents, i) => {
                let content = '';
                content += '------\n';
                content += 'Note Path: ' + filepath.replace('.md', '') + (hasMultipleParts ? ' Part ' + (i + 1) : '') + '\n';
                content += contents.join('\n\n');
                processedDocuments.push(content);
            });
        }

        const needsReduce = (await model.getNumTokens(processedDocuments.join('\n\n'))) > tokenMax;
        Log.debug('Postprocessed Docs', processedDocuments);
        return { notes: processedDocuments, needsReduce };
    };
}

function getDocsReducePipe(model: BaseChatModel, pipeInput: PipeInput) {
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

        // 4097 max but not working that well
        const tokenMax =
            2000 -
            (await model.getNumTokens(
                (await PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce).formatPromptValue({ query: pipeInput.userQuery, content: '' })).toString()
            )) -
            5; // not sure why we need to subtract 5 tokens more
        do {
            if (editableConfig) editableConfig.runName = `Reduce ${reduceCount + 1}`;

            // split notes by length to fit into context length
            const splitedContents = await splitContents(contents, (content: string) => model.getNumTokens(content), tokenMax);
            const reduceChain = RunnableSequence.from([
                { content: new RunnablePassthrough(), query: () => pipeInput.userQuery },
                reduceCount === 0
                    ? PromptTemplate.fromTemplate(Prompts[pipeInput.lang].initialReduce)
                    : PromptTemplate.fromTemplate(Prompts[pipeInput.lang].reduce),
                model,
                new StringOutputParser(),
            ]);
            contents = await Promise.all(splitedContents.map((contents) => reduceChain.invoke(contents.join('\n\n'))));
            Log.debug('Reduced Docs', contents);
            reduceCount += 1;
        } while ((await model.getNumTokens(contents.join('\n\n'))) > tokenMax);
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
                throw new Error('A single document was longer than the context length. Should not happen as we split documents by length in post processing!');
            splitContents.push(subResultContents.slice(0, -1));
            subResultContents = subResultContents.slice(-1);
        }
    }
    splitContents.push(subResultContents);
    return splitContents;
}
