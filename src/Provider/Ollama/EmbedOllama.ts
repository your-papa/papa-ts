import { OllamaEmbeddings } from "@langchain/ollama";
import { BaseProvider } from "../BaseProvider";
import { EmbedProvider } from "../EmbedProvider";
import { OllamaConfig } from "./BaseOllama";


export const OllamaEmbedModels = {
    'nomic-embed-text': { similarityThreshold: 0.5 },
    'mxbai-embed-large': { similarityThreshold: 0.5 },
};

export type OllamaEmbedModel = keyof typeof OllamaEmbedModels;

export class OllamaEmbed extends EmbedProvider<OllamaConfig> {
    constructor(provider: BaseProvider<OllamaConfig>, model: OllamaEmbedModel = 'nomic-embed-text') {
        super();
        this.provider = provider;
        this.models = OllamaEmbedModels;
        this.setModel(model);
    }

    protected createLCModel(model: OllamaEmbedModel): void {
        this.lcModel = new OllamaEmbeddings({ baseUrl: this.provider.getConnectionConfig().baseUrl, model: model });
    }
}