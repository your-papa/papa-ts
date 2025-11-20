import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type {
    BuiltInProviderModelMap,
    BuiltInProviderModelMapEntry,
    BuiltInProviderOptions,
    ChatModelFactory,
    EmbeddingModelFactory,
    ProviderDefinition,
} from './types';
import { ProviderImportError } from './errors';
import { dynamicImport } from './dynamicImport';
import { createChatFactories, createEmbeddingFactories, firstKey } from './helpers';

const DEFAULT_CHAT_ENTRIES: BuiltInProviderModelMap = {
    'gpt-4o': 'gpt-4o',
    'gpt-4.1': 'gpt-4.1',
    'gpt-5': 'gpt-5',
    'gpt-4o-mini': 'gpt-4o-mini',
};

const DEFAULT_EMBEDDING_ENTRIES: BuiltInProviderModelMap = {
    'text-embedding-3-large': 'text-embedding-3-large',
    'text-embedding-3-small': 'text-embedding-3-small',
};

export function createOpenAIProviderDefinition(options?: BuiltInProviderOptions): ProviderDefinition {
    const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;
    const embeddingEntries = options?.embeddingModels ?? DEFAULT_EMBEDDING_ENTRIES;

    return {
        chatModels: createChatFactories(chatEntries, createOpenAIChatFactory),
        embeddingModels: createEmbeddingFactories(embeddingEntries, createOpenAIEmbeddingFactory),
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
        defaultEmbeddingModel: options?.defaultEmbeddingModel ?? firstKey(embeddingEntries),
    };
}

function createOpenAIChatFactory(descriptor: BuiltInProviderModelMapEntry): ChatModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{ ChatOpenAI: new (config: Record<string, unknown>) => BaseChatModel }>(
                '@langchain/openai',
            );
            const ChatOpenAI = (mod as { ChatOpenAI: new (config: Record<string, unknown>) => BaseChatModel }).ChatOpenAI;
            return new ChatOpenAI({ model: descriptor.model, ...(descriptor.options ?? {}), ...(options ?? {}) });
        } catch (error) {
            throw new ProviderImportError('openai', '@langchain/openai', error);
        }
    };
}

function createOpenAIEmbeddingFactory(descriptor: BuiltInProviderModelMapEntry): EmbeddingModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{ OpenAIEmbeddings: new (config: Record<string, unknown>) => EmbeddingsInterface }>(
                '@langchain/openai',
            );
            const OpenAIEmbeddings = (
                mod as { OpenAIEmbeddings: new (config: Record<string, unknown>) => EmbeddingsInterface }
            ).OpenAIEmbeddings;
            return new OpenAIEmbeddings({ model: descriptor.model, ...(descriptor.options ?? {}), ...(options ?? {}) });
        } catch (error) {
            throw new ProviderImportError('openai', '@langchain/openai', error);
        }
    };
}

