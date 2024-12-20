import { Embeddings } from "@langchain/core/embeddings";
import { BaseProvider } from "./BaseProvider";
import { EmbedModelName } from "./ProviderFactory";

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

    setModel(model: EmbedModelName) {
        this.selectedModel = model;
        this.createLCModel(model);
    }
    getModel(): EmbedModel {
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    protected abstract createLCModel(model: EmbedModelName): void;
}

