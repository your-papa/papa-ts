import { EmbedModel, GenModel } from '../Models';

export const providerNames = ['OpenAI', 'Ollama'];
export type ProviderName = (typeof providerNames)[number];

export type ProviderSettings<TSettings> = TSettings & {
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

    setConnectionArgs(connectionArgs: TSettings): TSettings {
        this.connectionArgs = connectionArgs;
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

    updateGenModel(model: string, settings: GenModelSettings): GenModelSettings | null {
        if (this.genModels[model]) {
            this.genModels[model] = settings;
            return settings;
        }
        return null;
    }

    updateEmbedModel(model: string, settings: EmbedModelSettings): EmbedModelSettings | null {
        if (this.embedModels[model]) {
            this.embedModels[model] = settings;
            return settings;
        }
        return null;
    }

    //add active model check?
    setSelectedEmbedModel(model: string): string | null {
        if (!(model in this.embedModels)) {
            return null;
        }
        this.selectedEmbedModel = model;
        return model;
    }

    setSelectedGenModel(model: string): string | null {
        if (!(model in this.genModels)) {
            return null;
        }
        this.selectedGenModel = model;
        return model;
    }

    abstract createEmbedModel(k: number): EmbedModel;

    abstract createGenModel(): GenModel;
}

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
