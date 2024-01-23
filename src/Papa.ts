import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Serialized } from '@langchain/core/load/serializable';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { applyPatch } from 'fast-json-patch';
import { encode, decode } from '@msgpack/msgpack';

import { OllamaGenModel, OpenAIEmbedModel, OpenAIGenModel, isOllamaGenModel, isOpenAIGenModel } from './Models';
import { PipeInput, createConversationPipe, createRagPipe } from './PapaPipe';
import { Language, Prompts } from './Prompts';
import { OramaStore, VectorDocument } from './VectorStore';
import { IndexingMode, index, unindex } from './Indexing';
import { DexieRecordManager, VectorIndexRecord } from './RecordManager';

export interface PapaData {
    genModel: OllamaGenModel | OpenAIGenModel;
    embedModel: OpenAIEmbedModel;
}

export interface PapaResponse {
    status: 'Startup' | 'Retrieving' | 'Reducing' | 'Generating';
    content?: string;
}

export class Papa {
    private vectorStore: OramaStore;
    private retriever: VectorStoreRetriever;
    private model: BaseChatModel;
    private recordManager: DexieRecordManager;

    constructor(data: PapaData) {
        this.setGenModel(data.genModel);
        this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...data.embedModel, batchSize: 2048 }), {});
        this.vectorStore.create('VectorStore');
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
        this.recordManager = new DexieRecordManager('RecordManager');
    }

    async setGenModel(genModel: OllamaGenModel | OpenAIGenModel) {
        if (isOpenAIGenModel(genModel)) {
            this.model = new ChatOpenAI({ ...genModel, streaming: true });
        } else if (isOllamaGenModel(genModel)) {
            this.model = new ChatOllama(genModel);
        } else throw new Error('Invalid genModel');
    }

    async embedDocuments(documents: Document[], indexingMode: IndexingMode = 'full') {
        console.log('Embedding documents in mode', indexingMode);
        return await index(documents, this.recordManager, this.vectorStore, indexingMode, 1000);
    }

    async deleteDocuments(documents: Document[]) {
        unindex(documents, this.recordManager, this.vectorStore);
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        return RunnableSequence.from([Prompts[lang].createTitle, this.model, new StringOutputParser()]).invoke({ chatHistory });
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

    async *_streamProcessor(responseStream: AsyncGenerator<RunLogPatch>): AsyncGenerator<PapaResponse> {
        let pipeOutput: any = {};
        let alreadyRetrieved = false;
        let alreadyReduced = false;
        let sbResponse: PapaResponse = { status: 'Startup', content: '...' };
        for await (const response of responseStream) {
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // console.log('Stream Log', structuredClone(pipeOutput));
            if (!alreadyRetrieved && pipeOutput.logs.Retrieving) {
                alreadyRetrieved = true;
                sbResponse = { status: 'Retrieving', content: 'Retrieving...' };
            } else if (!alreadyReduced && pipeOutput.logs.PPDocs && pipeOutput.logs.PPDocs.final_output && pipeOutput.logs.PPDocs.final_output.needsReduce) {
                alreadyReduced = true;
                sbResponse = { status: 'Reducing', content: 'Reducing ' + pipeOutput.logs.PPDocs.final_output.notes.length + ' notes...' };
            } else if (pipeOutput.streamed_output.join('') !== '') {
                sbResponse = { status: 'Generating', content: pipeOutput.streamed_output.join('') };
            }
            yield sbResponse;
        }
    }

    async load(vectorStoreBackup: ArrayBuffer) {
        const { VectorStore, RecordManager } = decode(vectorStoreBackup) as { VectorStore: VectorDocument[]; RecordManager: VectorIndexRecord[] };
        await Promise.all([this.vectorStore.restore(VectorStore), this.recordManager.restore(RecordManager)]);
    }

    async getData(): Promise<ArrayBuffer> {
        return encode({
            VectorStore: await this.vectorStore.getData(),
            RecordManager: await this.recordManager.getData(),
        });
    }
}
