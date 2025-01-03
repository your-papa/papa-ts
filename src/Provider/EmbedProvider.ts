import { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseProvider, ProviderAPI } from "./BaseProvider";
import { OllamaEmbeddings } from "@langchain/ollama";

export type EmbedModelConfig = {
    similarityThreshold: number;
};

export type EmbedModel = {
    name: string;
    lc: Embeddings;
    config: EmbedModelConfig;
}

export class EmbedProvider<TProviderConfig extends object> extends BaseProvider<TProviderConfig> {
    protected models: { [model: string]: EmbedModelConfig };
    protected lcModel: Embeddings;

    constructor(provider: ProviderAPI<TProviderConfig>) {
        super(provider);
    }

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async setModels(models: { [model: string]: EmbedModelConfig }): Promise<void> {
        const supportedModels = await this.getModels();
        for (const model in models) {
            if (!supportedModels.includes(model))
                throw new Error('Embed Provider does not support the model ' + model);
            this.models[model] = { ...this.models[model], ...models[model] };
        }
    }
    getModel(): EmbedModel {
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    protected createLCModel() {
        const connectionConfig = this.provider.getConnectionConfig();
        if ('apiKey' in connectionConfig) {
            this.lcModel = new OpenAIEmbeddings({ ...connectionConfig, modelName: this.selectedModel });
        } else if ('baseUrl' in connectionConfig) {
            this.lcModel = new OllamaEmbeddings({ ...connectionConfig, model: this.selectedModel });
        } else {
            throw new Error('Unsupported provider configuration');
        }
    }
}

