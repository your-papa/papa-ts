import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { BaseProvider, ProviderAPI } from "./BaseProvider";
import { ChatOpenAI, ClientOptions } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatAnthropic } from "@langchain/anthropic";

export type GenModelConfig = {
    temperature: number;
    contextWindow: number;
};

export type GenModel = {
    name: string;
    lc: BaseChatModel;
    config: GenModelConfig;
}

export class GenProvider<TConfig> extends BaseProvider<TConfig> {
    protected models: { [model: string]: GenModelConfig } = {};
    protected lcModel?: BaseChatModel;

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
            if (!supportedModels.includes(model))
                throw new Error('Gen Provider does not support the model ' + model);
            this.models[model] = { ...this.models[model], ...models[model] };
        }
    }

    getModel(): GenModel {
        if (!this.selectedModel || !this.lcModel) throw new Error('No gen model selected');
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    protected createLCModel() {
        if (this.provider.name === 'OpenAI' || this.provider.name === 'CustomOpenAI') {
            this.lcModel = new ChatOpenAI({ modelName: this.selectedModel }, { ...this.provider.getConnectionConfig() as ClientOptions });
        } else if (this.provider.name === 'Ollama') {
            this.lcModel = new ChatOllama({ ...this.provider.getConnectionConfig(), model: this.selectedModel });
        } else if (this.provider.name === "Anthropic") {
            this.lcModel = new ChatAnthropic({ ...this.provider.getConnectionConfig(), model: this.selectedModel });
        } else {
            throw new Error('Unsupported provider configuration');
        }
    }
}

