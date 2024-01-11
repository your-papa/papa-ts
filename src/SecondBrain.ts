import { LLM } from '@langchain/core/language_models/llms';
import { OpenAIChat } from 'langchain/llms/openai';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { Ollama } from 'langchain/llms/ollama';
import { OramaStore } from './VectorStore';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Serialized } from 'langchain/load/serializable';
import { PipeInput, createConversationPipe, createRagPipe } from './SBPipe';
import { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { OllamaGenModel, OpenAIEmbedModel, OpenAIGenModel, isOllamaGenModel, isOpenAIGenModel } from './Models';
import { applyPatch } from 'fast-json-patch';

export interface SecondBrainData {
    genModel: OllamaGenModel | OpenAIGenModel;
    embedModel: OpenAIEmbedModel;
    saveHandler?: (vectorStoreJson: string) => void;
}

export interface SecondBrainResponse {
    status: 'Startup' | 'Retrieving' | 'Reducing' | 'Generating';
    content?: string;
}

export class SecondBrain {
    private vectorStore: OramaStore;
    private saveHandler?: (vectorStoreJson: string) => void;
    private retriever: VectorStoreRetriever;
    private model: LLM;

    constructor(data: SecondBrainData) {
        this.setGenModel(data.genModel);
        this.saveHandler = data.saveHandler;
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...data.embedModel, batchSize: 2048 }), {
            indexName: 'obsidiandb',
        });
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
    }

    async setGenModel(genModel: OllamaGenModel | OpenAIGenModel) {
        console.log('Setting genModel...', genModel);
        if (isOpenAIGenModel(genModel)) {
            this.model = new OpenAIChat({ ...genModel, streaming: true });
        } else if (isOllamaGenModel(genModel)) {
            this.model = new Ollama(genModel);
        } else throw new Error('Invalid genModel');
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

    run(input: PipeInput) {
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
            ? this._streamProcessor(createRagPipe(this.retriever, this.model, input).streamLog(input, pipeOptions))
            : this._streamProcessor(createConversationPipe(this.model, input).streamLog(input, pipeOptions));
    }

    async *_streamProcessor(responseStream: AsyncGenerator<RunLogPatch>): AsyncGenerator<SecondBrainResponse> {
        let pipeOutput: any = {};
        let alreadyRetrieved = false;
        let alreadyReduced = false;
        let sbResponse: SecondBrainResponse = { status: 'Startup', content: '...' };
        for await (const response of responseStream) {
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // console.log('Stream Log', structuredClone(pipeOutput));
            if (!alreadyRetrieved && pipeOutput.logs.Retrieving) {
                alreadyRetrieved = true;
                sbResponse = { status: 'Retrieving', content: 'Retrieving...' };
            } else if (!alreadyReduced && pipeOutput.logs.PPDocs && pipeOutput.logs.PPDocs.final_output) {
                alreadyReduced = true;
                sbResponse = { status: 'Reducing', content: 'Reducing... ' + pipeOutput.logs.PPDocs.final_output.output.length + ' notes' };
            } else if (pipeOutput.streamed_output.join('') !== '') {
                sbResponse = { status: 'Generating', content: pipeOutput.streamed_output.join('') };
            }
            yield sbResponse;
        }
    }

    load(vectorStoreJson: string) {
        this.vectorStore.restoreDb(vectorStoreJson);
    }
}
