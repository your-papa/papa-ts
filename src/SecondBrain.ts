import { LLM } from '@langchain/core/language_models/llms';
import { OpenAIChat } from 'langchain/llms/openai';
import { Ollama } from 'langchain/llms/ollama';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Serialized } from 'langchain/load/serializable';
import { PipeInput, createConversationPipe, createRagPipe } from './SBPipe';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { OllamaGenModel, OpenAIEmbedModel, OpenAIGenModel, isOllamaGenModel, isOpenAIGenModel } from './Models';

export interface SecondBrainData {
    genModel: OllamaGenModel | OpenAIGenModel;
    embedModel: OpenAIEmbedModel;
    saveHandler?: (vectorStoreJson: string) => void;
}

export class SecondBrain {
    private vectorStore: OramaStore;
    private saveHandler?: (vectorStoreJson: string) => void;
    private retriever: VectorStoreRetriever;
    private model: LLM;

    constructor(data: SecondBrainData) {
        if (isOpenAIGenModel(data.genModel)) {
            // if (!data.genModel.openAIApiKey) throw new Error('No OpenAI API key provided');
            this.model = new OpenAIChat({ ...data.genModel, streaming: true });
        } else if (isOllamaGenModel(data.genModel)) {
            // if (!data.genModel.baseUrl) throw new Error('No Ollama API base URL provided');
            this.model = new Ollama(data.genModel);
        } else throw new Error('Invalid genModel');
        this.saveHandler = data.saveHandler;
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...data.embedModel, batchSize: 2048 }), {
            indexName: 'obsidiandb',
        });
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
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

    runRAG(input: PipeInput) {
        console.log('Running RAG... Input:', input);
        const pipeOptions = {
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
        };
        return input.isRAG
            ? createRagPipe(this.retriever, this.model, input.lang).streamLog(input, pipeOptions)
            : createConversationPipe(this.model, input.lang).streamLog(input, pipeOptions);
    }

    load(vectorStoreJson: string) {
        this.vectorStore.restoreDb(vectorStoreJson);
    }
}
