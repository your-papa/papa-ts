import { ChatOpenAI } from "@langchain/openai";
import { BaseProvider } from "../BaseProvider";
import { GenProvider } from "../GenProvider";
import { OpenAIConfig } from "./BaseOpenAI";

export const OpenAIGenModels = {
    'gpt-3.5-turbo': { temperature: 0.5, contextWindow: 16385 },
    'gpt-4': { temperature: 0.5, contextWindow: 8192 },
    'gpt-4-32k': { temperature: 0.5, contextWindow: 32768 },
    'gpt-4-turbo-preview': { temperature: 0.5, contextWindow: 128000 },
    'gpt-4o-mini': { temperature: 0.5, contextWindow: 8192 },
};

export type OpenAIGenModel = keyof typeof OpenAIGenModels;

export class OpenAIGen extends GenProvider<OpenAIConfig> {
    constructor(provider: BaseProvider<OpenAIConfig>, model: OpenAIGenModel = 'gpt-4o-mini') {
        super();
        this.provider = provider;
        this.models = OpenAIGenModels;
        this.setModel(model);
    }

    protected createLCModel(model: OpenAIGenModel): void {
        this.lcModel = new ChatOpenAI({
            openAIApiKey: this.provider.getConnectionConfig().apiKey,
            modelName: model,
            temperature: this.models[model].temperature,
            streaming: true,
        });
    }
}