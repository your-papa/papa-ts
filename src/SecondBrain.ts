import { RunnablePassthrough, RunnableSequence } from 'langchain/schema/runnable';
import { OpenAIChat } from 'langchain/llms/openai';
import { PromptTemplate } from 'langchain/prompts';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { Serialized } from 'langchain/load/serializable';
import { LLMResult } from 'langchain/schema';

export class SecondBrain {
    private documents: Document[] = [];
    private vectorStore: OramaStore;
    private ragChain: RunnableSequence;
    private retriever: VectorStoreRetriever;

    constructor() {
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ openAIApiKey: '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' }), {
            indexName: 'obsidiandb',
        });
        this.retriever = this.vectorStore.asRetriever({ k: 2 });

        const model = new OpenAIChat({ openAIApiKey: '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' });
        const prompt = PromptTemplate.fromTemplate(`Answer the question based only on the following context:
        {context}

        Question: {question}`);

        this.ragChain = RunnableSequence.from([
            {
                context: this.retriever.pipe((documents: Document[], separator = '\n\n'): string => documents.map((doc) => doc.pageContent).join(separator)),
                question: new RunnablePassthrough(),
            },
            prompt,
            model,
            new StringOutputParser(),
        ]);
    }

    loadDocument(metadata: Record<string, any>, pageContent: string) {
        this.documents.push(new Document({ metadata, pageContent }));
    }

    async embedDocuments() {
        if (!this.documents.length) {
            throw new Error('No documents loaded');
        }
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized');
        }
        await this.vectorStore.addDocuments(this.documents);
    }

    async runRAG(query: string) {
        if (!this.ragChain) {
            throw new Error('RAG chain not initialized');
        }
        const result = this.ragChain.invoke(query, {
            callbacks: [
                {
                    handleRetrieverEnd: async (documents: Document[]) => {
                        console.log(JSON.stringify(documents, null, 2));
                    },
                    handleLLMStart: async (llm: Serialized, prompts: string[]) => {
                        console.log(JSON.stringify(llm, null, 2));
                        console.log(JSON.stringify(prompts, null, 2));
                    },
                    handleLLMEnd: async (output: LLMResult) => {
                        console.log(JSON.stringify(output, null, 2));
                    },
                    handleLLMError: async (err: Error) => {
                        console.error(err);
                    },
                },
            ],
        });
        return result;
    }

    async retrieveDocuments(query: string) {
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized');
        }
        return await this.vectorStore.similaritySearch(query, 3);
    }

    // async saveVectorStore() {
    //     if (!this.vectorStore) {
    //         throw new Error('Vector store not initialized');
    //     }
    //     await this.vectorStore.save('vectordb');
    // }

    // async loadVectorStore() {
    //     this.vectorStore = await OramaStore.load('vectordb', new OpenAIEmbeddings({ openAIApiKey: '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' }));
    // }
}
