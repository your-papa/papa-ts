import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { decode, encode } from '@msgpack/msgpack';
import { applyPatch } from 'fast-json-patch';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';

import { IndexingMode, index, unindex } from './Indexing';
import { getTracer } from './Langsmith';
import { GenModel, EmbedModel, isOllamaEmbedModel, isOpenAIEmbedModel, isOpenAIGenModel, isOllamaGenModel } from './Models';
import { PipeInput, createConversationPipe, createRagPipe } from './PapaPipe';
import { Language, Prompts } from './Prompts';
import { DexieRecordManager, VectorIndexRecord } from './RecordManager';
import { OramaStore, VectorStoreBackup } from './VectorStore';
import Log, { LogLvl } from './Logging';

export interface PapaData {
    genModel: GenModel;
    embedModel: EmbedModel;
    langsmithApiKey?: string;
    logLvl?: LogLvl;
}

export interface PapaResponse {
    status: 'Startup' | 'Retrieving' | 'Reducing' | 'Generating';
    content?: string;
}

export class Papa {
    private vectorStore: OramaStore;
    private retriever: VectorStoreRetriever;
    private genModel: GenModel;
    private recordManager: DexieRecordManager;
    private tracer?: LangChainTracer;

    constructor(data: PapaData) {
        this.setGenModel(data.genModel);
        this.setEmbedModel(data.embedModel);
        if (data.langsmithApiKey) this.setTracer(data.langsmithApiKey);
        this.recordManager = new DexieRecordManager('RecordManager');
        Log.setLogLevel(data.logLvl ?? LogLvl.INFO);
    }

    private async setEmbedModel(embedModel: EmbedModel) {
        if (isOpenAIEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...embedModel, modelName: embedModel.model, batchSize: 2048, maxRetries: 0 }), {
                similarityThreshold: embedModel.similarityThreshold ?? 0.75,
            });
        } else if (isOllamaEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OllamaEmbeddings({ ...embedModel, maxRetries: 0 }), {
                similarityThreshold: embedModel.similarityThreshold ?? 0.5,
            });
        } else throw new Error('Invalid embedModel');
        await this.vectorStore.create(embedModel.model);
        this.retriever = this.vectorStore.asRetriever({ k: 100 });
    }

    async setGenModel(genModel: GenModel) {
        this.genModel = genModel;
        // TODO check if context window size already set internally
        if (isOpenAIGenModel(genModel)) {
            this.genModel.lcModel = new ChatOpenAI({ ...genModel, modelName: genModel.model, streaming: true });
        } else if (isOllamaGenModel(genModel)) {
            this.genModel.lcModel = new ChatOllama(genModel);
        } else throw new Error('Invalid genModel');
    }

    embedDocuments(documents: Document[], indexingMode: IndexingMode = 'full') {
        Log.info('Embedding documents in mode', indexingMode);
        return index(documents, this.recordManager, this.vectorStore, indexingMode, 10);
    }

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        await unindex(basedOn, this.recordManager, this.vectorStore);
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        return RunnableSequence.from([PromptTemplate.fromTemplate(Prompts[lang].createTitle), this.genModel.lcModel!, new StringOutputParser()]).invoke({
            chatHistory,
        });
    }

    run(input: PipeInput) {
        Log.info('Running RAG... Input:', input);
        return input.isRAG
            ? this.streamProcessor(createRagPipe(this.retriever, this.genModel, input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined))
            : this.streamProcessor(createConversationPipe(this.genModel, input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined));
    }

    private async *streamProcessor(responseStream: AsyncGenerator<RunLogPatch>): AsyncGenerator<PapaResponse> {
        let pipeOutput: any = {};
        let alreadyRetrieved = false;
        let alreadyReduced = false;
        let sbResponse: PapaResponse = { status: 'Startup', content: '...' };
        for await (const response of responseStream) {
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // Log.info('Stream Log', structuredClone(pipeOutput));
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
        const { VectorStore, RecordManager } = decode(vectorStoreBackup) as { VectorStore: VectorStoreBackup; RecordManager: VectorIndexRecord[] };
        await Promise.all([this.vectorStore.restore(VectorStore), this.recordManager.restore(RecordManager)]);
    }

    async getData(): Promise<ArrayBuffer> {
        return encode({
            VectorStore: await this.vectorStore.getData(),
            RecordManager: await this.recordManager.getData(),
        });
    }

    setTracer(langsmithApiKey: string) {
        this.tracer = getTracer(langsmithApiKey);
    }
    static setLogLevel(verbose: LogLvl) {
        Log.setLogLevel(verbose);
    }
}
