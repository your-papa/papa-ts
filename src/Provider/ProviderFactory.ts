import { BaseProvider } from './BaseProvider';
import { OllamaProvider, OllamaConfig } from './Ollama/BaseOllama';
import { OpenAIProvider, OpenAIConfig } from './OpenAI/BaseOpenAI';
import { OpenAIGen, OpenAIGenModel } from './OpenAI/GenOpenAI';
import { OllamaGen, OllamaGenModel } from './Ollama/GenOllama';
import { OpenAIEmbed, OpenAIEmbedModel } from './OpenAI/EmbedOpenAI';
import { OllamaEmbed, OllamaEmbedModel } from './Ollama/EmbedOllama';

export type ProviderConfig = OpenAIConfig | OllamaConfig;
export const RegisteredProviders = ['OpenAI', 'Ollama'] as const;
export type RegisteredProvider = (typeof RegisteredProviders)[number];

export type GenModelName = OpenAIGenModel | OllamaGenModel;
export type EmbedModelName = OpenAIEmbedModel | OllamaEmbedModel;


export async function createProvider(providerName: RegisteredProvider, config: ProviderConfig): Promise<BaseProvider<ProviderConfig>> {
    if (providerName === 'OpenAI') {
        const openaiProvider = new OpenAIProvider(config as OpenAIConfig);
        await openaiProvider.setup();
        return openaiProvider;
    } else if (providerName === 'Ollama') {
        const ollamaProvider = new OllamaProvider(config as OllamaConfig);
        await ollamaProvider.setup();
        return ollamaProvider;
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
