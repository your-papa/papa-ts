import { BaseCallbackConfig } from 'langchain/callbacks';
import { OpenAIChat } from 'langchain/llms/openai';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { RunnableSequence, RunnableBranch, RunnablePassthrough } from 'langchain/schema/runnable';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { ragPrompt, conversationPrompt, reducePrompt, initialReducePrompt } from './Prompts';

export type ChainInput = {
    isRAG: boolean;
    userQuery: string;
    chatHistory: string;
};

export function createPipe(retriever: VectorStoreRetriever, model: OpenAIChat) {
    const ragChain = RunnableSequence.from([
        {
            query: (input: ChainInput) => input.userQuery,
            chatHistory: (input: ChainInput) => input.chatHistory,
            context: async (input: ChainInput) =>
                retriever.pipe(getDocsPostProcessor(model, input.userQuery)).pipe(getDocsReducePipe(model, input.userQuery)).invoke(input.userQuery),
        },
        ragPrompt,
        model,
        new StringOutputParser(),
    ]);

    const conversationChain = RunnableSequence.from([
        {
            query: (input: ChainInput) => input.userQuery,
            chatHistory: (input: ChainInput) => input.chatHistory,
        },
        conversationPrompt,
        model,
        new StringOutputParser(),
    ]);

    return RunnableBranch.from([[(input: { isRAG: boolean }) => input.isRAG, ragChain], conversationChain]);
}

function getDocsPostProcessor(model: OpenAIChat, userQuery = '') {
    return async (documents: Document[]) => {
        const tokenMax = 2000 - (await model.getNumTokens((await reducePrompt.formatPromptValue({ query: userQuery, content: '' })).toString())) - 5; // not sure why we need to subtract 5 tokens more
        console.log('Retrieved Docs', documents);
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
                content += '\n\n------\n';
                content += 'Note Path:' + filepath.replace('.md', '') + (hasMultipleParts && ' Part ' + (i + 1)) + '\n';
                content += contents.join('\n\n');
                processedDocuments.push(content);
            });
        }
        console.log('Postprocessed Docs', processedDocuments);
        return processedDocuments;
    };
}

function getDocsReducePipe(model: OpenAIChat, userQuery = '') {
    return async (
        notesContent: string[],
        options?: {
            config?: BaseCallbackConfig;
        }
    ) => {
        const editableConfig = options?.config;
        let contents = notesContent;
        let reduceCount = 0;
        let numTokens = 0;

        // 4097 max but not working that well
        const tokenMax = 2000 - (await model.getNumTokens((await reducePrompt.formatPromptValue({ query: userQuery, content: '' })).toString())) - 5; // not sure why we need to subtract 5 tokens more
        do {
            if (editableConfig) editableConfig.runName = `Reduce ${reduceCount + 1}`;

            // split notes by length to fit into context length
            const splitedContents = await splitContents(contents, (content: string) => model.getNumTokens(content), tokenMax);
            console.log('Splited Docs', splitContents);
            const reduceChain = RunnableSequence.from([
                { content: new RunnablePassthrough(), query: () => userQuery },
                reduceCount === 0 ? initialReducePrompt : reducePrompt,
                model,
                new StringOutputParser(),
            ]);
            contents = await Promise.all(splitedContents.map((contents) => reduceChain.invoke(contents.join('\n\n'))));
            console.log('Reduced Docs', contents);
            numTokens = await model.getNumTokens(contents.join('\n\n'));
            reduceCount += 1;
        } while (numTokens > tokenMax);
        console.log(`Reduced ${reduceCount} times`);
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
