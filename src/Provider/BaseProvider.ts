export abstract class ProviderAPI<TConfig> {
    readonly isLocal: boolean;
    protected connectionConfig: TConfig;
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
    protected selectedModel: string;

    constructor(provider: ProviderAPI<TConfig>) {
        this.provider = provider;
    }

    async isSetuped(): Promise<boolean> {
        return await this.provider.isSetuped();
    }

    async setModel(model: string): Promise<void> {
        if (!(await this.getModels()).includes(model))
            throw new Error('Provider does not support the model ' + model);
        this.selectedModel = model;
        this.createLCModel();
    }

    protected abstract getModels(): Promise<string[]>;
    protected abstract setModels(models: { [model: string]: any }): Promise<void>;
    protected abstract createLCModel(): void;
}