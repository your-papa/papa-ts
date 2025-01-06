import { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { BaseProvider, ProviderAPI } from './BaseProvider';
import { ChatOpenAI, ClientOptions } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatAnthropic } from '@langchain/anthropic';

export type GenModelConfig = {
    temperature: number;
    contextWindow: number;
};

export type GenModel = {
    name: string;
    lc: BaseChatModel;
    config: GenModelConfig;
};

export class GenProvider<TConfig> extends BaseProvider<TConfig> {
    protected models: { [model: string]: GenModelConfig } = {};

    constructor(provider: ProviderAPI<TConfig>) {
        super(provider);
    }

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async registerModels(models: { [model: string]: GenModelConfig }): Promise<void> {
        const supportedModels = await this.provider.getModels();
        for (const model in models) {
            if (!supportedModels.includes(model)) throw new Error('Gen Provider does not support the model ' + model);
            this.models[model] = { ...this.models[model], ...models[model] };
        }
    }

    async useModel(model: string): Promise<GenModel> {
        if (!(await this.getModels()).includes(model)) throw new Error('Provider does not support the model ' + model);
        return { name: model, lc: this.createLCModel(model), config: this.models[model] };
    }

    protected createLCModel(model: string) {
        if (this.provider.name === 'OpenAI' || this.provider.name === 'CustomOpenAI') {
            return new ChatOpenAI({ modelName: model }, { ...(this.provider.getConnectionConfig() as ClientOptions) });
        } else if (this.provider.name === 'Ollama') {
            return new ChatOllama({ ...this.provider.getConnectionConfig(), model: model });
        } else if (this.provider.name === 'Anthropic') {
            return new ChatAnthropic({ ...this.provider.getConnectionConfig(), model: model });
        } else {
            throw new Error('Unsupported provider configuration');
        }
    }
}
