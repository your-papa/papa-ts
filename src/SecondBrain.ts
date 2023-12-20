import { RunnableSequence, RunnableBranch } from 'langchain/schema/runnable';
import { OpenAIChat } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { Serialized } from 'langchain/load/serializable';
import { LLMResult } from 'langchain/schema';

type chainInput = {
    isRAG: boolean;
    userQuery: string;
    chatHistory: string;
};

export interface SecondBrainData {
    openAIApiKey: string;
    vectorStoreJson?: string;
}

export class SecondBrain {
    private vectorStore: OramaStore;
    private secondBrain: RunnableBranch;
    private retriever: VectorStoreRetriever;

    constructor(data: SecondBrainData) {
        if (!data.openAIApiKey) {
            throw new Error('No OpenAI API key provided');
        }
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ openAIApiKey: data.openAIApiKey, batchSize: 2048 }), {
            indexName: 'obsidiandb',
            backupVectorStoreJson: data.vectorStoreJson,
        });
        this.retriever = this.vectorStore.asRetriever({ k: 30 });

        const model = new OpenAIChat({ openAIApiKey: data.openAIApiKey });
        const ragPrompt = PromptTemplate.fromTemplate(
            `Antworte als mein Assistent auf meine Frage ausschließlich basierend auf meinem Wissen im folgenden Kontext. Bitte erstelle links im folgenden format [[<Notename>#<Header1>##<Header2>###...]] aus den Note Headern und füge sie deiner Antwort als Referenz bei:
------------
Kontext: {context}
------------
Chat History: {chatHistory}
------------
Frage: {question}`
        );

        const conversationPrompt = PromptTemplate.fromTemplate(
            `Antworte als mein Assistent auf meine Frage ausschließlich basierend auf meinem Wissen im folgenden Kontext. Bitte erstelle links im folgenden format
             [[<Notename>#<Header1>##<Header2>###...]] aus den Note Headern und füge sie deiner Antwort als Referenz bei:
             ------------
            Chat History: {chatHistory}
            ------------
            Frage: {question}`
        );

        const ragChain = RunnableSequence.from([
            {
                question: (input: { isRAG: boolean; query: string; chatHistory: string }) => input.query,
                chatHistory: (input: { isRAG: boolean; query: string; chatHistory: string }) => input.chatHistory,
                context: async (input: { isRAG: boolean; query: string; chatHistory: string }) => {
                    const relevantDocs = await this.retriever.getRelevantDocuments(input.query);
                    const processedDocs = SecondBrain.docsPostProcessor(relevantDocs);
                    return processedDocs;
                },
            },
            ragPrompt,
            model,
            new StringOutputParser(),
        ]);

        const conversationChain = RunnableSequence.from([
            {
                question: (input: { isRAG: boolean; query: string; chatHistory: string }) => input.query,
                chatHistory: (input: { isRAG: boolean; query: string; chatHistory: string }) => input.chatHistory,
            },
            conversationPrompt,
            model,
            new StringOutputParser(),
        ]);

        this.secondBrain = RunnableBranch.from([[(input: { isRAG: boolean }) => input.isRAG, ragChain], conversationChain]);
    }

    async embedDocuments(documents: Document[]) {
        console.log('Embedding documents...');
        await this.vectorStore.addDocuments(documents);
        console.log('Done embedding documents');
    }

    async removeDocuments(documents: Document[]) {
        await this.vectorStore.removeDocuments(documents);
    }

    async runRAG(input: chainInput): Promise<string> {
        console.log('Running RAG...');
        console.log(input);
        const result = this.secondBrain.invoke(input, {
            callbacks: [
                {
                    handleRetrieverEnd: async (documents: Document[]) => {
                        console.log(documents);
                    },
                    handleLLMStart: async (llm: Serialized, prompts: string[]) => {
                        console.log(prompts[0]);
                    },
                    handleLLMEnd: async (output: LLMResult) => {
                        console.log(output);
                    },
                    handleLLMError: async (err: Error) => {
                        console.error(err);
                    },
                },
            ],
        });
        return result;
    }

    async retrieveDocuments(query: string): Promise<Document[]> {
        return await this.vectorStore.similaritySearch(query, 3);
    }

    async getVectorStoreJson(): Promise<string> {
        return await this.vectorStore.getJson();
    }

    static loadFromData(data: SecondBrainData): SecondBrain {
        return new this(data);
    }

    private static docsPostProcessor(documents: Document[]): string {
        // group documents by filename
        const documentsByFilename: Record<string, Document[]> = {};
        for (const document of documents) {
            if (!documentsByFilename[document.metadata.filename]) {
                documentsByFilename[document.metadata.filename] = [];
            }
            documentsByFilename[document.metadata.filename].push(document);
        }
        let context = '';
        for (const filename in documentsByFilename) {
            // reorder documents by order
            documentsByFilename[filename].sort((a, b) => a.metadata.order - b.metadata.order);
            context += '\n\n------\n';
            context += 'Note Name:' + filename + '\n';
            let lastHeader: string[] = [''];

            context += documentsByFilename[filename]
                .map((document) => {
                    // if (document.metadata.header !== currentHeader) {
                    //     currentHeader = document.metadata.header;
                    //     return currentHeader + '\n' + document.pageContent;
                    // }
                    let header = '';
                    for (let i = 0; i < document.metadata.header.length; i++) {
                        if (document.metadata.header[i] !== lastHeader[i]) {
                            header += document.metadata.header[i] + '\n';
                        }
                    }
                    lastHeader = document.metadata.header;
                    return header + document.pageContent;
                })
                .join('\n\n');
        }
        return context;
    }
}
