export abstract class BaseProvider<TConfig> {
    readonly isLocal: boolean;
    protected connectionConfig: TConfig;

    abstract isSetuped(): Promise<boolean>;

    setConnectionConfig(partialConfig: Partial<TConfig>): { connectionArgs: TConfig } {
        this.connectionConfig = { ...this.connectionConfig, ...partialConfig };
        return { connectionArgs: this.connectionConfig };
    }

    getConnectionConfig(): TConfig {
        return this.connectionConfig;
    }

    abstract getModels(): Promise<string[]>;
}
