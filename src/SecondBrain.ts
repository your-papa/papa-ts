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
    private vectorStore: OramaStore;
    private ragChain: RunnableSequence;
    private retriever: VectorStoreRetriever;

    constructor(openAIApiKey: string) {
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ openAIApiKey, batchSize: 2048 }), {
            indexName: 'obsidiandb',
        });
        this.retriever = this.vectorStore.asRetriever({ k: 7 });

        const model = new OpenAIChat({ openAIApiKey });
        const prompt =
            PromptTemplate.fromTemplate(`Antworte als mein Assistent auf meine Frage ausschließlich basierend auf meinem Wissen im folgenden Markdown formatierten Kontext. Bitte erstelle links im folgenden format [[Notename#Header1##Header2]] aus den Note Headern und füge sie deiner Antwort als Referenz bei:
        {context}

        Frage: {question}`);

        this.ragChain = RunnableSequence.from([
            {
                context: this.retriever.pipe((documents: Document[]): string => documents.map((doc) => doc.pageContent).join('\n\n')),
                question: new RunnablePassthrough(),
            },
            prompt,
            model,
            new StringOutputParser(),
        ]);
    }

    async embedDocuments(documents: Document[]) {
        console.log('Embedding documents...');
        if (!this.vectorStore) {
            throw new Error('Vector store not initialized');
        }
        await this.vectorStore.addDocuments(documents);
        console.log('Done embedding documents');
    }

    async runRAG(query: string) {
        console.log('Running RAG...');
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
