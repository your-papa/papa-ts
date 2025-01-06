import { ProviderAPI } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Provider/Ollama';
import { OpenAIProvider, OpenAIConfig } from './Provider/OpenAI';
import { GenModelConfig, GenProvider } from './GenProvider';
import { EmbedModelConfig, EmbedProvider } from './EmbedProvider';
import { AnthropicConfig, AnthropicProvider } from './Provider/Anthropic';
import { CustomOpenAIConfig, CustomOpenAIProvider } from './Provider/CustomOpenAI';

export const RegisteredProviders = ['OpenAI', 'CustomOpenAI', 'Ollama', 'Anthropic'] as const;
export type BaseProviderConfigs = { "OpenAI": OpenAIConfig, "CustomOpenAI": CustomOpenAIConfig, "Ollama": OllamaConfig, "Anthropic": AnthropicConfig };
export const RegisteredGenProviders = ['OpenAI', 'CustomOpenAI', 'Ollama', 'Anthropic'] as const;
export const RegisteredEmbedProviders = ['OpenAI', 'CustomOpenAI', 'Ollama'] as const;

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
    private baseProviders: { [provider in RegisteredProvider]: ProviderAPI<ProviderConfig> } = {} as any;
    private genProviders: { [provider in RegisteredGenProvider]: GenProvider<ProviderConfig> } = {} as any;
    private embedProviders: { [provider in RegisteredEmbedProvider]: EmbedProvider<ProviderConfig> } = {} as any;

    constructor() {
        this.baseProviders["OpenAI"] = new OpenAIProvider();
        this.baseProviders["CustomOpenAI"] = new CustomOpenAIProvider();
        this.baseProviders["Ollama"] = new OllamaProvider();
        this.baseProviders["Anthropic"] = new AnthropicProvider();
        for (const provider of RegisteredEmbedProviders)
            this.embedProviders[provider] = new EmbedProvider(this.baseProviders[provider]);
        for (const provider of RegisteredGenProviders)
            this.genProviders[provider] = new GenProvider(this.baseProviders[provider]);
    }

    async configure(config: Partial<ProviderRegistryConfig>) {
        for (const provider of RegisteredProviders)
            if (config[provider]?.config) await this.baseProviders[provider].setup(config[provider].config);
        for (const provider of RegisteredEmbedProviders) {
            if (config[provider]?.embedModels) await this.embedProviders[provider].registerModels(config[provider].embedModels);
            if (config[provider]?.selEmbedModel) await this.embedProviders[provider].setModel(config[provider].selEmbedModel);
        }
        for (const provider of RegisteredGenProviders) {
            if (config[provider]?.genModels) await this.genProviders[provider].registerModels(config[provider].genModels);
            if (config[provider]?.selGenModel) await this.genProviders[provider].setModel(config[provider].selGenModel);
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