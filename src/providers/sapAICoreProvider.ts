import { AzureOpenAiChatClient, AzureOpenAiEmbeddingClient } from '@sap-ai-sdk/langchain';
import type {
    ChatModelFactory,
    EmbeddingModelFactory,
    ProviderDefinition,
    SapAICoreModelEntry,
    SapAICoreProviderOptions,
} from './types';
import { ProviderImportError } from './errors';
import { firstKey } from './helpers';

const DEFAULT_CHAT_ENTRIES: Record<string, SapAICoreModelEntry> = {
    'gpt-4o': { model: 'gpt-4o' },
    'gpt-5': { model: 'gpt-5' },
    'gpt-4.1': { model: 'gpt-4.1' },
};

const DEFAULT_EMBEDDING_ENTRIES: Record<string, SapAICoreModelEntry> = {
    'text-embedding-3-small': { model: 'text-embedding-3-small' },
};

export function createSapAICoreProviderDefinition(options?: SapAICoreProviderOptions): ProviderDefinition {
    const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;
    const embeddingEntries = options?.embeddingModels ?? DEFAULT_EMBEDDING_ENTRIES;

    return {
        chatModels: createSapAICoreChatFactories(chatEntries),
        embeddingModels: createSapAICoreEmbeddingFactories(embeddingEntries),
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
        defaultEmbeddingModel: options?.defaultEmbeddingModel ?? firstKey(embeddingEntries),
    };
}

function createSapAICoreChatFactories(entries: Record<string, SapAICoreModelEntry>): Record<string, ChatModelFactory> {
    return Object.entries(entries).reduce<Record<string, ChatModelFactory>>((acc, [alias, descriptor]) => {
        acc[alias] = createSapAICoreChatFactory(alias, descriptor);
        return acc;
    }, {});
}

function createSapAICoreEmbeddingFactories(
    entries: Record<string, SapAICoreModelEntry>,
): Record<string, EmbeddingModelFactory> {
    return Object.entries(entries).reduce<Record<string, EmbeddingModelFactory>>((acc, [alias, descriptor]) => {
        acc[alias] = createSapAICoreEmbeddingFactory(alias, descriptor);
        return acc;
    }, {});
}

function createSapAICoreChatFactory(alias: string, descriptor: SapAICoreModelEntry): ChatModelFactory {
    return async (options) => {
        try {
            if (!AzureOpenAiChatClient) {
                throw new Error('AzureOpenAiChatClient export missing');
            }

            const clientOptions = {
                modelName: descriptor.model ?? alias,
                ...(descriptor.options ?? {}),
                ...(options ?? {}),
            };

            return new AzureOpenAiChatClient(clientOptions);
        } catch (error) {
            throw new ProviderImportError('sap-ai-core', '@sap-ai-sdk/langchain', error);
        }
    };
}

function createSapAICoreEmbeddingFactory(alias: string, descriptor: SapAICoreModelEntry): EmbeddingModelFactory {
    return async (options) => {
        try {
            if (!AzureOpenAiEmbeddingClient) {
                throw new Error('AzureOpenAiEmbeddingClient export missing');
            }

            const clientOptions = {
                modelName: descriptor.model ?? alias,
                ...(descriptor.options ?? {}),
                ...(options ?? {}),
            };

            return new AzureOpenAiEmbeddingClient(clientOptions);
        } catch (error) {
            throw new ProviderImportError('sap-ai-core', '@sap-ai-sdk/langchain', error);
        }
    };
}
