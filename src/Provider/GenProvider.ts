import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { initChatModel } from "langchain/chat_models/universal"
import { BaseProvider } from "./BaseProvider";
import { GenModelName } from "./ProviderFactory";

export type GenModelConfig = {
    temperature: number;
    contextWindow: number;
};

export type GenModel = {
    name: GenModelName;
    lc: BaseChatModel;
    config: GenModelConfig;
}

export abstract class GenProvider<TConfig> {
    protected provider: BaseProvider<TConfig>;
    protected models: { [model: string]: GenModelConfig };
    protected selectedModel: GenModelName;
    protected lcModel: BaseChatModel;

    async getModels(): Promise<string[]> {
        const providerModels = await this.provider.getModels();
        return providerModels.filter((model) => model in this.models);
    }

    async isSetuped(): Promise<boolean> {
        return await this.provider.isSetuped();
    }

    setModel(model: GenModelName) {
        this.selectedModel = model;
        this.createLCModel(model);
    }

    getModel(): GenModel {
        return { name: this.selectedModel, lc: this.lcModel, config: this.models[this.selectedModel] };
    }

    protected abstract createLCModel(model: GenModelName): void;
}