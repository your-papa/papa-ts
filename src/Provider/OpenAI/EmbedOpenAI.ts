import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseProvider } from "../BaseProvider";
import { EmbedProvider } from "../EmbedProvider";
import { OpenAIConfig } from "./BaseOpenAI";

export const OpenAIEmbedModels = {
    'text-embedding-ada-002': { similarityThreshold: 0.75 },
    'text-embedding-3-large': { similarityThreshold: 0.5 },
    'text-embedding-3-small': { similarityThreshold: 0.5 },
};

export type OpenAIEmbedModel = keyof typeof OpenAIEmbedModels;

export class OpenAIEmbed extends EmbedProvider<OpenAIConfig> {
    constructor(provider: BaseProvider<OpenAIConfig>, model: OpenAIEmbedModel = 'text-embedding-3-large') {
        super();
        this.provider = provider;
        this.models = OpenAIEmbedModels;
        this.setModel(model);
    }

    protected createLCModel(model: OpenAIEmbedModel): void {
        this.lcModel = new OpenAIEmbeddings({ openAIApiKey: this.provider.getConnectionConfig().apiKey, modelName: model });
    }
}