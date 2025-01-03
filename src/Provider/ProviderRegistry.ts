import { ProviderAPI } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Ollama';
import { OpenAIProvider, OpenAIConfig } from './OpenAI';
import { GenModelConfig, GenProvider } from './GenProvider';
import { EmbedModelConfig, EmbedProvider } from './EmbedProvider';

export const RegisteredProviders = ['OpenAI', 'Ollama'] as const;
export type BaseProviderConfigs = { "OpenAI": OpenAIConfig, "Ollama": OllamaConfig };
export const RegisteredGenProviders = ['OpenAI', 'Ollama'] as const;
export const RegisteredEmbedProviders = ['OpenAI', 'Ollama'] as const;

export type ProviderConfig = BaseProviderConfigs[keyof BaseProviderConfigs];
export type RegisteredProvider = (typeof RegisteredProviders)[number];
export type RegisteredGenProvider = (typeof RegisteredGenProviders)[number];
export type RegisteredEmbedProvider = (typeof RegisteredEmbedProviders)[number];

export type ProviderRegistryConfig = {
    [provider in RegisteredProvider]: Partial<{
        config: BaseProviderConfigs[provider];
        selEmbedModel: string;
        embedModels: Record<string, EmbedModelConfig>;
        selGenModel: string;
        genModels: Record<string, GenModelConfig>;
    }>;
};


export class ProviderRegistry {
    private baseProviders: { [provider in RegisteredProvider]: ProviderAPI<ProviderConfig> };
    private genProviders: { [provider in RegisteredGenProvider]: GenProvider<ProviderConfig> };
    private embedProviders: { [provider in RegisteredEmbedProvider]: EmbedProvider<ProviderConfig> };

    constructor() {
        this.baseProviders["OpenAI"] = new OpenAIProvider();
        this.baseProviders["Ollama"] = new OllamaProvider();
        for (const provider of RegisteredEmbedProviders)
            this.embedProviders[provider] = new EmbedProvider(this.baseProviders[provider]);
        for (const provider of RegisteredGenProviders)
            this.genProviders[provider] = new GenProvider(this.baseProviders[provider]);
    }

    async configure(config: Partial<ProviderRegistryConfig>) {
        for (const provider of RegisteredProviders) {
            if (!config[provider]) continue;
            if (config[provider].config) await this.baseProviders[provider].setup(config[provider].config);
            if (config[provider].embedModels) await this.embedProviders[provider].setModels(config[provider].embedModels);
            if (config[provider].selEmbedModel) await this.embedProviders[provider].setModel(config[provider].selEmbedModel);
            if (config[provider].genModels) await this.genProviders[provider].setModels(config[provider].genModels);
            if (config[provider].selGenModel) await this.genProviders[provider].setModel(config[provider].selGenModel);
        }
    }

    getProvider(providerName: RegisteredProvider): ProviderAPI<ProviderConfig> {
        return this.baseProviders[providerName];
    }

    getGenProvider(providerName: RegisteredGenProvider): GenProvider<ProviderConfig> {
        return this.genProviders[providerName];
    }

    getEmbedProvider(providerName: RegisteredEmbedProvider): EmbedProvider<ProviderConfig> {
        return this.embedProviders[providerName];
    }
}