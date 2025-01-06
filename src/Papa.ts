import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { RunLogPatch } from '@langchain/core/tracers/log_stream';
import { applyPatch } from 'fast-json-patch';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';

import { getTracer } from './Langsmith';
import { PipeInput, createConversationPipe, createRagPipe } from './PapaPipe';
import { Language, Prompts } from './Prompts';
import Log, { LogLvl } from './Logging';
import { ProviderConfig, ProviderRegistry, ProviderRegistryConfig, RegisteredEmbedProvider, RegisteredEmbedProviders, RegisteredGenProvider, RegisteredProvider, RegisteredProviders } from './ProviderRegistry/ProviderRegistry';
import { GenProvider } from './ProviderRegistry/GenProvider';
import { EmbedProvider } from './ProviderRegistry/EmbedProvider';
import { IndexingMode, KnowledgeIndex } from './KnowledgeIndex/KnowledgeIndex';

export interface PapaConfig {
    providers: Partial<ProviderRegistryConfig>;
    selEmbedProvider?: RegisteredEmbedProvider;
    selGenProvider: RegisteredGenProvider;
    numDocsToRetrieve?: number;
    langsmithApiKey?: string;
    logLvl?: LogLvl;
}

export type PapaResponseStatus = 'startup' | 'retrieving' | 'reducing' | 'generating' | 'stopped';
export interface PapaResponse {
    status: PapaResponseStatus;
    content?: string;
}

export class Papa {
    // TODO refactor out into a separate class (Plain Chat, RAG Chat, etc.) to make it more modular and avoid having to check if the providers are setuped in every method
    private knowledgeIndex?: KnowledgeIndex;
    private providerRegistry: ProviderRegistry = new ProviderRegistry();
    private embedProvider?: EmbedProvider<ProviderConfig>;
    private genProvider?: GenProvider<ProviderConfig>;
    private stopRunFlag = false;
    private tracer?: LangChainTracer;

    async init(config: PapaConfig) {
        Log.setLogLevel(config.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        await this.configure(config);
    }

    async configure(config: Partial<PapaConfig>) {
        if (config.providers) {
            await this.providerRegistry.configure(config.providers);

            for (const provider of RegisteredEmbedProviders) {
                // If an Embed Provider is already selected, break the loop
                if (config.selEmbedProvider) break;
                // If a selected embedding model is part of the registered provider, create a new vector index
                if (config.providers[provider]?.selEmbedModel && this.embedProvider === this.providerRegistry.getEmbedProvider(provider)) {
                    this.knowledgeIndex = await KnowledgeIndex.create(this.embedProvider, 20);
                    break;
                }
                // Update the similarity threshold for the embed models if they match the current embed provider's model
                if (config.providers[provider]?.embedModels) {
                    for (const model in config.providers[provider].embedModels) {
                        if (this.embedProvider?.getModel().name === model) {
                            this.knowledgeIndex?.setSimilarityThreshold(config.providers[provider].embedModels[model].similarityThreshold);
                            break;
                        }
                    }
                }
            }
        }
        if (config.selEmbedProvider) {
            this.embedProvider = this.providerRegistry.getEmbedProvider(config.selEmbedProvider);
            this.knowledgeIndex = await KnowledgeIndex.create(this.embedProvider, 20);
        }
        if (config.selGenProvider) this.genProvider = this.providerRegistry.getGenProvider(config.selGenProvider);
        if (config.numDocsToRetrieve) this.knowledgeIndex?.setNumOfDocsToRetrieve(config.numDocsToRetrieve);
        if (config.langsmithApiKey) this.tracer = getTracer(config.langsmithApiKey);
        if (config.logLvl) Log.setLogLevel(config.logLvl);
    }

    getProvider(providerName: RegisteredProvider) {
        return this.providerRegistry.getProvider(providerName);
    }

    async isGenProviderSetuped() {
        return await this.genProvider?.isSetuped();
    }

    async isEmbedProviderSetuped() {
        return await this.embedProvider?.isSetuped();
    }

    embedDocuments(documents: Document[], indexingMode: IndexingMode = 'full') {
        Log.info('Embedding documents in mode', indexingMode);
        return this.knowledgeIndex?.embedDocuments(documents, indexingMode);
    }

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        Log.info('Deleting documents based on', basedOn);
        await this.knowledgeIndex?.deleteDocuments(basedOn);
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        if (!this.genProvider) throw new Error('Generation provider is not setuped');
        return RunnableSequence.from([PromptTemplate.fromTemplate(Prompts[lang].createTitle), this.genProvider.getModel().lc, new StringOutputParser()]).invoke({
            chatHistory,
        });
    }

    run(input: PipeInput) {
        Log.info('Running RAG... Input:', input);
        if (input.isRAG) {
            if (!this.knowledgeIndex || !this.genProvider?.isSetuped())
                throw new Error('RAG requires both Embedding and Generation providers to be setup');
            return this.streamProcessor(createRagPipe(this.knowledgeIndex.getRetriever(), this.genProvider.getModel(), input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined))
        } else {
            if (!this.isGenProviderSetuped() || !this.genProvider)
                throw new Error('Conversation requires a Generation provider to be setup');
            return this.streamProcessor(createConversationPipe(this.genProvider.getModel(), input).streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined))
        }
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
        if (!this.knowledgeIndex) throw new Error('Knowledge index is not setupe');
        await this.knowledgeIndex.load(vectorStoreBackup);
    }

    async getData(): Promise<Uint8Array> {
        if (!this.knowledgeIndex) throw new Error('Knowledge index is not setuped');
        return this.knowledgeIndex.getData();
    }
}
