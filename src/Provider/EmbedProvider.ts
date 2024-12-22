import { Embeddings } from "@langchain/core/embeddings";
import { BaseProvider } from "./BaseProvider";
import { EmbedModelName } from "./ProviderRegistry";

export type EmbedModelConfig = {
    similarityThreshold: number;
};

export type EmbedModel = {
    name: EmbedModelName;
    lc: Embeddings;
    config: EmbedModelConfig;
}

export abstract class EmbedProvider<TConfig> {
    protected provider: BaseProvider<TConfig>;
    protected models: { [model: string]: EmbedModelConfig };
    protected selectedModel: EmbedModelName;
    protected lcModel: Embeddings;

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async isSetuped(): Promise<boolean> {
        return this.provider.isSetuped();
    }

    async setModel(model: EmbedModelName, config?: EmbedModelConfig): Promise<void> {
        if (!(await this.getModels()).includes(model))
            throw new Error('Embed Provider does not support the model ' + model);
        this.selectedModel = model;
        if (config) this.models[model] = config;
        this.createLCModel(model);
    }
    getModel(): EmbedModel {
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    getProvider(): BaseProvider<TConfig> {
        return this.provider;
    }

    protected abstract createLCModel(model: EmbedModelName): void;
}

