import { BaseProvider } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Ollama/BaseOllama';
import { OpenAIProvider, OpenAIConfig } from './OpenAI/BaseOpenAI';
import { OpenAIGen, OpenAIGenModel } from './OpenAI/GenOpenAI';
import { OllamaGen, OllamaGenModel } from './Ollama/GenOllama';
import { OpenAIEmbed, OpenAIEmbedModel } from './OpenAI/EmbedOpenAI';
import { OllamaEmbed, OllamaEmbedModel } from './Ollama/EmbedOllama';
import { GenProvider } from './GenProvider';
import { EmbedProvider } from './EmbedProvider';

export type ProviderConfig = OpenAIConfig | OllamaConfig;
export const RegisteredProviders = ['OpenAI', 'Ollama'] as const;
export type RegisteredProvider = (typeof RegisteredProviders)[number];

export type GenModelName = OpenAIGenModel | OllamaGenModel;
export type EmbedModelName = OpenAIEmbedModel | OllamaEmbedModel;


export class ProviderManager {
    private baseProviders: { [provider in RegisteredProvider]: BaseProvider<ProviderConfig> };
    private genProviders: { [provider in RegisteredProvider]: GenProvider<ProviderConfig> };
    private embedProviders: { [provider in RegisteredProvider]: EmbedProvider<ProviderConfig> };

    constructor() {
        this.baseProviders["OpenAI"] = new OpenAIProvider();
        this.embedProviders["OpenAI"] = new OpenAIEmbed(this.baseProviders["OpenAI"] as BaseProvider<OpenAIConfig>);
        this.genProviders["OpenAI"] = new OpenAIGen(this.baseProviders["OpenAI"] as BaseProvider<OpenAIConfig>);
        this.baseProviders["Ollama"] = new OllamaProvider();
        this.embedProviders["Ollama"] = new OllamaEmbed(this.baseProviders["Ollama"] as BaseProvider<OllamaConfig>);
        this.genProviders["Ollama"] = new OllamaGen(this.baseProviders["Ollama"] as BaseProvider<OllamaConfig>);
    }

    async setupProviders(configs: Partial<{ [provider in RegisteredProvider]: ProviderConfig }>) {
        for (const provider in configs) {
            if (configs[provider as RegisteredProvider] === undefined)
                continue;
            await this.setupProvider(provider as RegisteredProvider, configs[provider as RegisteredProvider]!);
        }
    }

    async setupProvider(providerName: RegisteredProvider, config: ProviderConfig) {
        await this.baseProviders[providerName].setup(config);
    }

    getGenProvider(providerName: RegisteredProvider): GenProvider<ProviderConfig> {
        return this.genProviders[providerName];
    }

    getEmbedProvider(providerName: RegisteredProvider): EmbedProvider<ProviderConfig> {
        return this.embedProviders[providerName];
    }
}