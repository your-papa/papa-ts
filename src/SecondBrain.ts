import { LLM } from '@langchain/core/language_models/llms';
import { OpenAIChat } from 'langchain/llms/openai';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Serialized } from 'langchain/load/serializable';
import { PipeInput, createPipe } from './SBPipe';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';

export interface SecondBrainData {
    openAIApiKey: string;
    saveHandler?: (vectorStoreJson: string) => void;
}

export class SecondBrain {
    private vectorStore: OramaStore;
    private saveHandler?: (vectorStoreJson: string) => void;
    private retriever: VectorStoreRetriever;
    private model: LLM;

    constructor(data: SecondBrainData) {
        if (!data.openAIApiKey) {
            throw new Error('No OpenAI API key provided');
        }
        this.saveHandler = data.saveHandler;
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ openAIApiKey: data.openAIApiKey, batchSize: 2048 }), {
            indexName: 'obsidiandb',
        });
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
        this.model = new OpenAIChat({ openAIApiKey: data.openAIApiKey });
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

    async runRAG(input: PipeInput): Promise<string> {
        console.log('Running RAG... Input:', input);
        const result = createPipe(this.retriever, this.model, input.lang).invoke(input, {
            callbacks: [
                {
                    handleLLMStart: async (llm: Serialized, prompts: string[]) => {
                        console.log(prompts[0]);
                    },
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
