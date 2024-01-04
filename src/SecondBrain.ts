import { RunnableBranch } from 'langchain/schema/runnable';
import { OpenAIChat } from 'langchain/llms/openai';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Serialized } from 'langchain/load/serializable';
import { ChainInput, createPipe } from './SBPipe';

export interface SecondBrainData {
    openAIApiKey: string;
    saveHandler?: (vectorStoreJson: string) => void;
}

export class SecondBrain {
    private vectorStore: OramaStore;
    private secondBrainPipe: RunnableBranch;
    private saveHandler?: (vectorStoreJson: string) => void;

    constructor(data: SecondBrainData) {
        if (!data.openAIApiKey) {
            throw new Error('No OpenAI API key provided');
        }
        this.saveHandler = data.saveHandler;
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ openAIApiKey: data.openAIApiKey, batchSize: 2048 }), {
            indexName: 'obsidiandb',
        });
        const retriever = this.vectorStore.asRetriever({ k: 100 });
        const model = new OpenAIChat({ openAIApiKey: data.openAIApiKey });
        this.secondBrainPipe = createPipe(retriever, model);
    }

    async embedDocuments(documents: Document[]) {
        console.log('Embedding documents...');
        await this.vectorStore.addDocuments(documents);
        console.log('Done embedding documents');
        if (this.saveHandler) this.saveHandler(await this.vectorStore.getJson());
    }

    async removeDocuments(documents: Document[]) {
        await this.vectorStore.removeDocuments(documents);
        if (this.saveHandler) this.saveHandler(await this.vectorStore.getJson());
    }

    async runRAG(input: ChainInput): Promise<string> {
        console.log('Running RAG... Input:', input);
        const result = this.secondBrainPipe.invoke(input, {
            callbacks: [
                {
                    handleLLMStart: async (llm: Serialized, prompts: string[]) => {
                        console.log(prompts[0]);
                    },
                    // handleLLMEnd: async (output: LLMResult) => {
                    //     console.log(output);
                    // },
                    handleLLMError: async (err: Error) => {
                        console.error(err);
                    },
                },
            ],
        });
        return result;
    }

    load(vectorStoreJson: string) {
        this.vectorStore.restoreDb(vectorStoreJson);
    }
}
