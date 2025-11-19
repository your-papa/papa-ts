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
    llama3: 'llama3',
};

const DEFAULT_EMBEDDING_ENTRIES: BuiltInProviderModelMap = {
    'nomic-embed-text': 'nomic-embed-text',
};

export function createOllamaProviderDefinition(options?: BuiltInProviderOptions): ProviderDefinition {
    const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;
    const embeddingEntries = options?.embeddingModels ?? DEFAULT_EMBEDDING_ENTRIES;

    return {
        chatModels: createChatFactories(chatEntries, createOllamaChatFactory),
        embeddingModels: createEmbeddingFactories(embeddingEntries, createOllamaEmbeddingFactory),
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
        defaultEmbeddingModel: options?.defaultEmbeddingModel ?? firstKey(embeddingEntries),
    };
}

function createOllamaChatFactory(descriptor: BuiltInProviderModelMapEntry): ChatModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{ ChatOllama: new (config: Record<string, unknown>) => BaseChatModel }>(
                '@langchain/ollama',
            );
            const ChatOllama = (mod as { ChatOllama: new (config: Record<string, unknown>) => BaseChatModel }).ChatOllama;
            return new ChatOllama({ model: descriptor.model, ...(descriptor.options ?? {}), ...(options ?? {}) });
        } catch (error) {
            throw new ProviderImportError('ollama', '@langchain/ollama', error);
        }
    };
}

function createOllamaEmbeddingFactory(descriptor: BuiltInProviderModelMapEntry): EmbeddingModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{
                OllamaEmbeddings: new (config: Record<string, unknown>) => EmbeddingsInterface;
            }>('@langchain/ollama');
            const OllamaEmbeddings = (
                mod as { OllamaEmbeddings: new (config: Record<string, unknown>) => EmbeddingsInterface }
            ).OllamaEmbeddings;
            return new OllamaEmbeddings({ model: descriptor.model, ...(descriptor.options ?? {}), ...(options ?? {}) });
        } catch (error) {
            throw new ProviderImportError('ollama', '@langchain/ollama', error);
        }
    };
}

