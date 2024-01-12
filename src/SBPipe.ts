import { BaseCallbackConfig } from 'langchain/callbacks';
import { LLM } from '@langchain/core/language_models/llms';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { RunnableSequence, RunnablePassthrough } from 'langchain/schema/runnable';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { Prompts, Language } from './Prompts';

export type PipeInput = {
    isRAG: boolean;
    userQuery: string;
    chatHistory: string;
    lang: Language;
};

export function createRagPipe(retriever: VectorStoreRetriever, model: LLM, input: PipeInput) {
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
            ]),
        },
        Prompts[input.lang].rag,
        model,
        new StringOutputParser(),
    ]);
    return ragChain;
}

export function createConversationPipe(model: LLM, input: PipeInput) {
    const conversationChain = RunnableSequence.from([
        {
            query: (input: PipeInput) => input.userQuery,
            chatHistory: (input: PipeInput) => input.chatHistory,
        },
        Prompts[input.lang].conversation,
        model,
        new StringOutputParser(),
    ]);
    return conversationChain;
}

function getDocsPostProcessor(model: LLM, pipeInput: PipeInput) {
    return async (documents: Document[]) => {
        const tokenMax =
            2000 -
            (await model.getNumTokens((await Prompts[pipeInput.lang].reduce.formatPromptValue({ query: pipeInput.userQuery, content: '' })).toString())) -
            5; // not sure why we need to subtract 5 tokens more
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

function getDocsReducePipe(model: LLM, pipeInput: PipeInput) {
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
        const tokenMax =
            2000 -
            (await model.getNumTokens((await Prompts[pipeInput.lang].reduce.formatPromptValue({ query: pipeInput.userQuery, content: '' })).toString())) -
            5; // not sure why we need to subtract 5 tokens more
        do {
            if (editableConfig) editableConfig.runName = `Reduce ${reduceCount + 1}`;

            // split notes by length to fit into context length
            const splitedContents = await splitContents(contents, (content: string) => model.getNumTokens(content), tokenMax);
            const reduceChain = RunnableSequence.from([
                { content: new RunnablePassthrough(), query: () => pipeInput.userQuery },
                reduceCount === 0 ? Prompts[pipeInput.lang].initialReduce : Prompts[pipeInput.lang].reduce,
                model,
                new StringOutputParser(),
            ]);
            contents = await Promise.all(splitedContents.map((contents) => reduceChain.invoke(contents.join('\n\n'))));
            console.log('Reduced Docs', contents);
            numTokens = await model.getNumTokens(contents.join('\n\n'));
            reduceCount += 1;
        } while (numTokens > tokenMax);
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
