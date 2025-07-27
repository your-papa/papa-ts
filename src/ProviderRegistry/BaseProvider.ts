import { RegisteredProvider } from './ProviderRegistry';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { GenModelConfig } from './GenProvider';
import { EmbedModelConfig } from './EmbedProvider';

// Interface for providers that can create generation models
export interface IGenProvider<TConfig, TGenLC extends BaseChatModel> {
    configureGenInstance(config: TConfig): void;
    getGenLCInstance(modelName: string, config: GenModelConfig): TGenLC;
}

// Interface for providers that can create embedding models
export interface IEmbedProvider<TConfig, TEmbedLC extends Embeddings> {
    configureEmbedInstance(config: TConfig): void;
    getEmbedLCInstance(modelName: string, config: EmbedModelConfig): TEmbedLC;
}

export abstract class ProviderAPI<TConfig> {
    abstract readonly isLocal: boolean;
    abstract readonly name: RegisteredProvider;
    protected connectionConfig: TConfig = {} as TConfig;
    protected isSetupComplete: boolean = false;

    abstract setup(config: TConfig): Promise<boolean>;
    isSetuped(): boolean {
        return this.isSetupComplete;
    }

    setConnectionConfig(partialConfig: Partial<TConfig>): { connectionArgs: TConfig } {
        this.connectionConfig = { ...this.connectionConfig, ...partialConfig };
        return { connectionArgs: this.connectionConfig };
    }

    getConnectionConfig(): TConfig {
        return this.connectionConfig;
    }

    abstract getModels(): Promise<string[]>;
}

// Type guard functions
export function isGenProvider<TConfig>(provider: ProviderAPI<TConfig>): provider is ProviderAPI<TConfig> & IGenProvider<TConfig, BaseChatModel> {
    return 'genLCInstance' in provider && 'configureGenInstance' in provider && 'getGenLCInstance' in provider;
}

export function isEmbedProvider<TConfig>(provider: ProviderAPI<TConfig>): provider is ProviderAPI<TConfig> & IEmbedProvider<TConfig, Embeddings> {
    return 'embedLCInstance' in provider && 'configureEmbedInstance' in provider && 'getEmbedLCInstance' in provider;
}

// Legacy BaseProvider class - kept for backwards compatibility
export abstract class BaseProvider<TConfig> {
    protected provider: ProviderAPI<TConfig>;

    constructor(provider: ProviderAPI<TConfig>) {
        this.provider = provider;
    }

    async isSetuped(): Promise<boolean> {
        return this.provider.isSetuped();
    }

    abstract getModels(): Promise<string[]>;
    abstract registerModels(models: { [model: string]: any }): Promise<void>;
    abstract useModel(model: string): void;

    protected abstract createLCModel(model: string): void;
}
