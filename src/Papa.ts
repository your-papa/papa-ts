import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { decode, encode } from '@msgpack/msgpack';
import { applyPatch } from 'fast-json-patch';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';

import { IndexingMode, index, unindex } from './Indexing';
import { getTracer } from './Langsmith';
import { PipeInput, createConversationPipe, createRagPipe } from './PapaPipe';
import { Language, Prompts } from './Prompts';
import { DexieRecordManager, VectorIndexRecord } from './RecordManager';
import { OramaStore, VectorStoreBackup } from './VectorStore';
import Log, { LogLvl } from './Logging';
import { EmbedModelName, GenModelName, ProviderConfig, ProviderManager, RegisteredProvider } from './Provider/ProviderFactory';
import { GenProvider } from './Provider/GenProvider';
import { EmbedProvider } from './Provider/EmbedProvider';


export interface PapaConfig {
    baseProviders: Partial<{ [provider in RegisteredProvider]: ProviderConfig }>;
    selEmbedProvider: RegisteredProvider;
    selGenProvider: RegisteredProvider;
    selEmbedModel?: EmbedModelName;
    selGenModel?: GenModelName;
    rag?: { numDocsToRetrieve?: number, similarityThreshold?: number };
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
    private providerManager: ProviderManager = new ProviderManager();
    private embedProvider: EmbedProvider<ProviderConfig>;
    private genProvider: GenProvider<ProviderConfig>;
    private recordManager: DexieRecordManager;
    private stopRunFlag = false;
    private tracer?: LangChainTracer;

    async init(config: PapaConfig) {
        Log.setLogLevel(config.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        await this.updatePapaConfig(config);
    }

    async updatePapaConfig(config: Partial<PapaConfig>) {
        if (config.baseProviders) await this.providerManager.setupProviders(config.baseProviders);
        if (config.selEmbedProvider) this.embedProvider = this.providerManager.getEmbedProvider(config.selEmbedProvider);
        if (config.selGenProvider) this.genProvider = this.providerManager.getGenProvider(config.selGenProvider);
        if (config.selEmbedModel) this.embedProvider.setModel(config.selEmbedModel)
        if (config.selEmbedProvider || config.selEmbedModel) await this.createVectorIndex();
        if (config.selGenModel) this.genProvider.setModel(config.selGenModel);
        if (config.rag?.numDocsToRetrieve) this.retriever = this.vectorStore.asRetriever({ k: config.rag.numDocsToRetrieve });
        if (config.rag?.similarityThreshold) this.vectorStore.setSimilarityThreshold(config.rag.similarityThreshold);
        if (config.langsmithApiKey) this.tracer = getTracer(config.langsmithApiKey);
        if (config.logLvl) Log.setLogLevel(config.logLvl);
    }

    private async createVectorIndex() {
        this.vectorStore = new OramaStore(this.embedProvider.getModel().lc, { similarityThreshold: this.embedProvider.getModel().config.similarityThreshold });
        await this.vectorStore.create(this.embedProvider.getModel().name);
        this.retriever = this.vectorStore.asRetriever({ k: 20 });
        this.recordManager = new DexieRecordManager('RecordManager');
    }

    async isReady() {
        return await this.embedProvider.isSetuped() && await this.genProvider.isSetuped();
    }

    embedDocuments(documents: Document[], indexingMode: IndexingMode = 'full') {
        Log.info('Embedding documents in mode', indexingMode);
        return index(documents, this.recordManager, this.vectorStore, indexingMode, 10);
    }

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        await unindex(basedOn, this.recordManager, this.vectorStore);
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        return RunnableSequence.from([PromptTemplate.fromTemplate(Prompts[lang].createTitle), this.genProvider.getModel().lc, new StringOutputParser()]).invoke({
            chatHistory,
        });
    }

    run(input: PipeInput) {
        Log.info('Running RAG... Input:', input);
        return input.isRAG
            ? this.streamProcessor(createRagPipe(this.retriever, this.genProvider.getModel(), input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined))
            : this.streamProcessor(createConversationPipe(this.genProvider.getModel(), input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined));
    }

    stopRun() {
        Log.info('Stopping run...');
        this.stopRunFlag = true;
    }

    private async *streamProcessor(responseStream: AsyncGenerator<RunLogPatch>): AsyncGenerator<PapaResponse> {
        let pipeOutput: any = {};
        let retrieving = false;
        let retrieved = false;
        let reducing = false;
        let generatedText = '';
        let sbResponse: PapaResponse = { status: 'startup' };
        for await (const response of responseStream) {
            if (this.stopRunFlag) {
                this.stopRunFlag = false;
                yield { status: 'stopped', content: generatedText };
                return;
            }
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
                generatedText = pipeOutput.streamed_output.join('');
                sbResponse = { status: 'generating', content: generatedText };
            }
            yield sbResponse;
        }
    }

    async load(vectorStoreBackup: Uint8Array) {
        const { VectorStore, RecordManager } = decode(vectorStoreBackup) as { VectorStore: VectorStoreBackup; RecordManager: VectorIndexRecord[] };
        await Promise.all([this.vectorStore.restore(VectorStore), this.recordManager.restore(RecordManager)]);
    }

    async getData(): Promise<Uint8Array> {
        return encode({
            VectorStore: await this.vectorStore.getData(),
            RecordManager: await this.recordManager.getData(),
        });
    }
}
