import { BaseProvider } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Ollama/BaseOllama';
import { OpenAIProvider, OpenAIConfig } from './OpenAI/BaseOpenAI';
import { OpenAIGen, OpenAIGenModel } from './OpenAI/GenOpenAI';
import { OllamaGen, OllamaGenModel } from './Ollama/GenOllama';
import { OpenAIEmbed, OpenAIEmbedModel } from './OpenAI/EmbedOpenAI';
import { OllamaEmbed, OllamaEmbedModel } from './Ollama/EmbedOllama';

export type ProviderConfig = OpenAIConfig | OllamaConfig;
export const registeredProviders = ['OpenAI', 'Ollama'];
export type RegisteredProvider = typeof registeredProviders[number];

export type GenModelName = OpenAIGenModel | OllamaGenModel;
export type EmbedModelName = OpenAIEmbedModel | OllamaEmbedModel;


export function createProvider(providerName: RegisteredProvider, config: ProviderConfig): BaseProvider<ProviderConfig> {
    if (providerName === 'OpenAI') {
        return new OpenAIProvider(config as OpenAIConfig);
    } else if (providerName === 'Ollama') {
        return new OllamaProvider(config as OllamaConfig);
    } else {
        throw new Error('Base Provider not found');
    }
}

export function createEmbedProvider(providerName: RegisteredProvider, provider: BaseProvider<ProviderConfig>) {
    if (providerName === 'OpenAI') {
        return new OpenAIEmbed(provider as BaseProvider<OpenAIConfig>);
    } else if (providerName === 'Ollama') {
        return new OllamaEmbed(provider as BaseProvider<OllamaConfig>);
    } else {
        throw new Error('Embed Provider not found');
    }
}

export function createGenProvider(providerName: RegisteredProvider, provider: BaseProvider<ProviderConfig>) {
    if (providerName === 'OpenAI') {
        return new OpenAIGen(provider as BaseProvider<OpenAIConfig>);
    } else if (providerName === 'Ollama') {
        return new OllamaGen(provider as BaseProvider<OllamaConfig>);
    } else {
        throw new Error('Gen Provider not found');
    }
}
