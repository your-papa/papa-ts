import { ProviderAPI } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Provider/Ollama';
import { OpenAIProvider, OpenAIConfig } from './Provider/OpenAI';
import { GenModelConfig, GenProvider } from './GenProvider';
import { EmbedModelConfig, EmbedProvider } from './EmbedProvider';
import { AnthropicConfig, AnthropicProvider } from './Provider/Anthropic';
import { CustomOpenAIConfig, CustomOpenAIProvider } from './Provider/CustomOpenAI';
import { IGenProvider, IEmbedProvider, isGenProvider, isEmbedProvider } from './BaseProvider';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

export const registeredProviders = ['OpenAI', 'CustomOpenAI', 'Ollama', 'Anthropic'] as const;
export type BaseProviderConfigs = { OpenAI: OpenAIConfig; CustomOpenAI: CustomOpenAIConfig; Ollama: OllamaConfig; Anthropic: AnthropicConfig };
export const registeredGenProviders = ['OpenAI', 'CustomOpenAI', 'Ollama', 'Anthropic'] as const;
export const registeredEmbedProviders = ['OpenAI', 'CustomOpenAI', 'Ollama'] as const;

export type ProviderConfig = BaseProviderConfigs[keyof BaseProviderConfigs];
export type RegisteredProvider = (typeof registeredProviders)[number];
export type RegisteredGenProvider = (typeof registeredGenProviders)[number];
export type RegisteredEmbedProvider = (typeof registeredEmbedProviders)[number];

export type Providers = OllamaProvider | OpenAIProvider | CustomOpenAIProvider | AnthropicProvider;
// Type constraints to ensure providers implement the correct interfaces
type GenProviderMap = {
    [K in RegisteredGenProvider]: ProviderAPI<BaseProviderConfigs[K]> & IGenProvider<BaseProviderConfigs[K], BaseChatModel>;
};

type EmbedProviderMap = {
    [K in RegisteredEmbedProvider]: ProviderAPI<BaseProviderConfigs[K]> & IEmbedProvider<BaseProviderConfigs[K], Embeddings>;
};

type ProviderAuthMap = {
    OpenAI: OpenAIConfig;
    Ollama: OllamaConfig;
    Anthropic: AnthropicConfig;
    CustomOpenAI: CustomOpenAIConfig;
};

export type ProviderRegistryConfig = {
    [provider in RegisteredProvider]: {
        config: BaseProviderConfigs[provider];
    };
};

export class ProviderRegistry {
    #baseProviders: { [provider in RegisteredProvider]: ProviderAPI<ProviderConfig> } = {} as any;

    createProvider = (provider: RegisteredProvider): ProviderAPI<ProviderConfig> => {
        switch (provider) {
            case 'OpenAI':
                return new OpenAIProvider();
            case 'CustomOpenAI':
                return new CustomOpenAIProvider();
            case 'Ollama':
                return new OllamaProvider();
            case 'Anthropic':
                return new AnthropicProvider();
            default:
                // This will cause a TypeScript error if any RegisteredProvider case is missing
                const _exhaustiveCheck: never = provider;
                throw new Error(`Unknown provider: ${provider}`);
        }
    };
    constructor() {
        for (const provider of registeredProviders) {
            this.#baseProviders[provider] = this.createProvider(provider);
        }
    }

    getProvider(providerName: RegisteredProvider): ProviderAPI<ProviderConfig> {
        return this.#baseProviders[providerName];
    }

    getGenProvider<T extends RegisteredGenProvider>(providerName: T): GenProviderMap[T] {
        // Type system guarantees this provider implements IGenProvider
        return this.#baseProviders[providerName] as GenProviderMap[T];
    }

    getEmbedProvider<T extends RegisteredEmbedProvider>(providerName: T): EmbedProviderMap[T] {
        // Type system guarantees this provider implements IEmbedProvider
        return this.#baseProviders[providerName] as EmbedProviderMap[T];
    }
}
