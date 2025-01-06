import { RegisteredProvider } from './ProviderRegistry';

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

export abstract class BaseProvider<TConfig> {
    protected provider: ProviderAPI<TConfig>;

    constructor(provider: ProviderAPI<TConfig>) {
        this.provider = provider;
    }

    async isSetuped(): Promise<boolean> {
        return await this.provider.isSetuped();
    }

    abstract getModels(): Promise<string[]>;
    abstract registerModels(models: { [model: string]: any }): Promise<void>;
    abstract useModel(model: string): void;

    protected abstract createLCModel(model: string): void;
}
