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

export type PapaResponseStatus = 'startup' | 'retrieving' | 'reducing' | 'generating' | 'stopped';
export interface PapaResponse {
    status: PapaResponseStatus;
    content?: string;
}

export class Papa {
    private vectorStore: OramaStore;
    private retriever: VectorStoreRetriever;
    private genModel: GenModel;
    private recordManager: DexieRecordManager;
    private tracer?: LangChainTracer;

    async init(data: PapaData) {
        await this.setGenModel(data.genModel);
        await this.setVectorStore(data.embedModel);
        if (data.langsmithApiKey) this.setTracer(data.langsmithApiKey);
        this.recordManager = new DexieRecordManager('RecordManager');
        Log.setLogLevel(data.logLvl ?? LogLvl.INFO);
    }

    private async setVectorStore(embedModel: EmbedModel) {
        if (isOpenAIEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OpenAIEmbeddings({ ...embedModel, modelName: embedModel.model, batchSize: 2048, maxRetries: 0 }), {
                similarityThreshold: embedModel.similarityThreshold,
            });
        } else if (isOllamaEmbedModel(embedModel)) {
            this.vectorStore = new OramaStore(new OllamaEmbeddings({ ...embedModel, maxRetries: 0 }), {
                similarityThreshold: embedModel.similarityThreshold,
            });
        } else throw new Error('Invalid embedModel');
        await this.vectorStore.create(embedModel.model);
        this.retriever = this.vectorStore.asRetriever({ k: embedModel.k ?? 100 });
    }

    setSimilarityThreshold(similarityThreshold: number) {
        this.vectorStore.setSimilarityThreshold(similarityThreshold);
    }

    setNumOfDocsToRetrieve(k: number) {
        this.retriever = this.vectorStore.asRetriever({ k });
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
        let retrieving = false;
        let retrieved = false;
        let reducing = false;
        let sbResponse: PapaResponse = { status: 'startup' };
        for await (const response of responseStream) {
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // Log.info('Stream Log', structuredClone(pipeOutput));
            if (!retrieving && pipeOutput.logs.Retrieving) {
                retrieving = true;
                sbResponse = { status: 'retrieving' };
            } else if (!retrieved && pipeOutput.logs.Retrieving?.final_output?.documents) {
                sbResponse = { status: 'retrieving', content: pipeOutput.logs.Retrieving.final_output.documents.length };
                retrieved = true;
            } else if (!reducing && pipeOutput.logs.PPDocs?.final_output?.needsReduce) {
                reducing = true;
                sbResponse = { status: 'reducing', content: pipeOutput.logs.PPDocs.final_output.notes.length };
            } else if (pipeOutput.streamed_output.join('') !== '') {
                sbResponse = { status: 'generating', content: pipeOutput.streamed_output.join('') };
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
