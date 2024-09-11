import { EmbedModel, GenModel } from '../Models';

export const providerNames = ['OpenAI', 'Ollama'];

export type ProviderNames = (typeof providerNames)[number];

export type GenModels = {
    [key: string]: GenModelSettings;
};

export type EmbedModels = {
    [key: string]: EmbedModelSettings;
};

export type GenModelSettings = {
    temperature: number;
    contextWindow: number;
};

export type EmbedModelSettings = {
    similarityThreshold: number;
};
type AtLeastOne<T> = {
    [K in keyof T]: Pick<T, K> & Partial<Omit<T, K>>;
}[keyof T];

export type ProviderSettings<TSettings> = {
    connectionArgs: TSettings;
    selectedEmbedModel: string;
    selectedGenModel: string;
    embedModels: EmbedModels;
    genModels: GenModels;
};

export abstract class BaseProvider<TSettings> {
    readonly isLocal: boolean;
    protected connectionArgs: TSettings;
    protected embedModels: EmbedModels;
    protected genModels: GenModels;
    protected selectedEmbedModel: string;
    protected selectedGenModel: string;

    abstract isSetuped(): Promise<boolean>;

    getSelEmbedModel(): string {
        return this.selectedEmbedModel;
    }

    getSelGenModel(): string {
        return this.selectedGenModel;
    }

    getEmbedModels(): EmbedModels {
        return this.embedModels;
    }

    getGenModels(): GenModels {
        return this.genModels;
    }

    //add active model check?
    setSelEmbedModel(model: string): string | null {
        if (!(model in this.embedModels)) {
            return null;
        }
        this.selectedEmbedModel = model;
        return model;
    }

    setSelGenModel(model: string): string | null {
        if (!(model in this.genModels)) {
            return null;
        }
        this.selectedGenModel = model;
        return model;
    }

    setConnectionArgs(partialUpdates: AtLeastOne<TSettings>): TSettings {
        this.connectionArgs = { ...this.connectionArgs, ...partialUpdates };
        return this.connectionArgs;
    }

    getConnectionArgs(): TSettings {
        return this.connectionArgs;
    }

    async addGenModel(model: string, settings: GenModelSettings): Promise<GenModelSettings | null> {
        if (this.genModels[model]) {
            return null;
        }

        const models = await this.getModels();
        if (!(model in models)) {
            return null;
        }

        this.genModels[model] = settings;

        return settings;
    }

    abstract getModels(): Promise<string[]>;

    async addEmbedModel(model: string, settings: EmbedModelSettings): Promise<EmbedModelSettings | null> {
        if (this.embedModels[model]) {
            return null;
        }

        const models = await this.getModels();
        if (!(model in models)) {
            return null;
        }

        this.embedModels[model] = settings;

        return settings;
    }

    updateEmbedModel(model: string, settings: EmbedModelSettings): EmbedModelSettings | null {
        if (this.embedModels[model]) {
            this.embedModels[model] = settings;
            return settings;
        }
        return null;
    }

    updateGenModel(model: string, settings: GenModelSettings): GenModelSettings | null {
        if (this.genModels[model]) {
            this.genModels[model] = settings;
            return settings;
        }
        return null;
    }

    abstract createEmbedModel(k: number): EmbedModel;

    abstract createGenModel(): GenModel;
}
