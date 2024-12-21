export abstract class BaseProvider<TConfig> {
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
