import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { initChatModel } from "langchain/chat_models/universal";

import { BaseProvider, ProviderAPI } from "./BaseProvider";

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
    protected models: { [model: string]: GenModelConfig };
    protected lcModel: BaseChatModel;

    constructor(provider: ProviderAPI<TConfig>) {
        super(provider);
    }

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async setModels(models: { [model: string]: GenModelConfig }): Promise<void> {
        const supportedModels = await this.getModels();
        for (const model in models) {
            if (!supportedModels.includes(model))
                throw new Error('Gen Provider does not support the model ' + model);
            this.models[model] = { ...this.models[model], ...models[model] };
        }
    }

    getModel(): GenModel {
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    protected async createLCModel() {
        this.lcModel = await initChatModel(this.selectedModel, { streaming: true, ...this.models[this.selectedModel], ...this.provider.getConnectionConfig() });
    }
}

