import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { Document } from '@langchain/core/documents';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { decode, encode } from '@msgpack/msgpack';
import { applyPatch } from 'fast-json-patch';
import { OllamaEmbeddings } from 'langchain/embeddings/ollama';
import { LangChainTracer } from 'langchain/callbacks';

import { IndexingMode, index, unindex } from './Indexing';
import { getTracer } from './Langsmith';
import {
    OllamaEmbedModel,
    OllamaGenModel,
    OpenAIEmbedModel,
    OpenAIGenModel,
    isOllamaEmbedModel,
    isOllamaGenModel,
    isOpenAIEmbedModel,
    isOpenAIGenModel,
} from './Models';
import { PipeInput, createConversationPipe, createRagPipe } from './PapaPipe';
import { Language, Prompts } from './Prompts';
import { DexieRecordManager, VectorIndexRecord } from './RecordManager';
import { OramaStore, VectorDocument } from './VectorStore';

export interface PapaData {
    genModel: OllamaGenModel | OpenAIGenModel;
    embedModel: OllamaEmbedModel | OpenAIEmbedModel;
    langsmithApiKey?: string;
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
    private tracer?: LangChainTracer;

    constructor(data: PapaData) {
        this.setGenModel(data.genModel);
        this.setEmbedModel(data.embedModel);
        this.vectorStore.create('VectorStore');
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
        this.recordManager = new DexieRecordManager('RecordManager');
        if (data.langsmithApiKey) this.tracer = getTracer(data.langsmithApiKey);
    }

    setEmbedModel(embedModel: OllamaEmbedModel | OpenAIEmbedModel) {
        if (isOpenAIEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...embedModel, batchSize: 2048 }), {});
        } else if (isOllamaEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OllamaEmbeddings(embedModel), {});
        } else throw new Error('Invalid embedModel');
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

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        await unindex(basedOn, this.recordManager, this.vectorStore);
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        return RunnableSequence.from([Prompts[lang].createTitle, this.model, new StringOutputParser()]).invoke({ chatHistory });
    }

    run(input: PipeInput) {
        console.log('Running RAG... Input:', input);
        return input.isRAG
            ? this._streamProcessor(createRagPipe(this.retriever, this.model, input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined))
            : this._streamProcessor(createConversationPipe(this.model, input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined));
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
