import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { BaseProvider, ProviderAPI } from './BaseProvider';
import { OllamaEmbeddings } from '@langchain/ollama';
import { RegisteredEmbedProvider } from './ProviderRegistry';

export type EmbedModelConfig = {
    similarityThreshold: number;
};

export type EmbedModel = {
    name: string;
    provider: RegisteredEmbedProvider;
};

export type EmbedModelFilled = EmbedModel & {
    lc: Embeddings;
    config: EmbedModelConfig;
};

export class EmbedProvider<TProviderConfig> extends BaseProvider<TProviderConfig> {
    protected models: { [model: string]: EmbedModelConfig } = {};

    constructor(provider: ProviderAPI<TProviderConfig>) {
        super(provider);
    }

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async registerModels(models: { [model: string]: EmbedModelConfig }): Promise<void> {
        const supportedModels = await this.provider.getModels();
        for (const model in models) {
            if (!supportedModels.includes(model)) throw new Error('Embed Provider does not support the model ' + model);
            this.models[model] = { ...this.models[model], ...models[model] };
        }
    }

    async useModel(model: string): Promise<EmbedModelFilled> {
        if (!(await this.getModels()).includes(model)) throw new Error('Provider does not support the model ' + model);
        return { name: model, provider: this.provider.name as RegisteredEmbedProvider, lc: this.createLCModel(model), config: this.models[model] };
    }

    protected createLCModel(model: string): Embeddings {
        if (this.provider.name === 'OpenAI' || this.provider.name === 'CustomOpenAI') {
            return new OpenAIEmbeddings({ ...this.provider.getConnectionConfig(), modelName: model });
        } else if (this.provider.name === 'Ollama') {
            return new OllamaEmbeddings({ ...this.provider.getConnectionConfig(), model: model });
        } else {
            throw new Error('Unsupported provider configuration');
        }
    }
}
