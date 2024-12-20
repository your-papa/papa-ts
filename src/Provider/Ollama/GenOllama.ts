import { ChatOllama } from "@langchain/ollama";
import { BaseProvider } from "../BaseProvider";
import { GenProvider } from "../GenProvider";
import { OllamaConfig } from "./BaseOllama";

export const OllamaGenModels = {
    llama2: { temperature: 0.5, contextWindow: 4096 },
    'llama2-uncensored': { temperature: 0.5, contextWindow: 4096 },
    mistral: { temperature: 0.5, contextWindow: 8000 },
    'mistral-openorca': { temperature: 0.5, contextWindow: 8000 },
    gemma: { temperature: 0.5, contextWindow: 8000 },
    mixtral: { temperature: 0.5, contextWindow: 32000 },
    'dolphin-mixtral': { temperature: 0.5, contextWindow: 32000 },
    phi: { temperature: 0.5, contextWindow: 2048 },
};

export type OllamaGenModel = keyof typeof OllamaGenModels;

export class OllamaGen extends GenProvider<OllamaConfig> {
    constructor(provider: BaseProvider<OllamaConfig>, model: OllamaGenModel = 'llama2') {
        super();
        this.provider = provider;
        this.models = OllamaGenModels;
        this.setModel(model);
    }

    protected createLCModel(model: OllamaGenModel): void {
        this.lcModel = new ChatOllama({
            baseUrl: this.provider.getConnectionConfig().baseUrl,
            model: model,
            temperature: this.models[model].temperature,
            streaming: true
        });
    }
} 