import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type {
    BuiltInProviderOptions,
    ChatModelFactory,
    EmbeddingModelFactory,
    ModelOptions,
    ProviderDefinition,
    SapAICoreProviderOptions,
} from './types';
import { ModelNotFoundError, ProviderNotFoundError } from './errors';
import { firstKey } from './helpers';
import { createOpenAIProviderDefinition } from './openaiProvider';
import { createAnthropicProviderDefinition } from './anthropicProvider';
import { createOllamaProviderDefinition } from './ollamaProvider';
import { createSapAICoreProviderDefinition } from './sapAICoreProvider';

interface InternalProviderDefinition {
    chatModels: Record<string, ChatModelFactory>;
    embeddingModels: Record<string, EmbeddingModelFactory>;
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}

export class ProviderRegistry {
    private readonly providers = new Map<string, InternalProviderDefinition>();

    registerProvider(name: string, definition: ProviderDefinition): this {
        const key = ProviderRegistry.normalizeName(name);
        const existing = this.providers.get(key) ?? {
            chatModels: {},
            embeddingModels: {},
            defaultChatModel: undefined,
            defaultEmbeddingModel: undefined,
        } satisfies InternalProviderDefinition;

        const chatModels: Record<string, ChatModelFactory> = {
            ...existing.chatModels,
            ...(definition.chatModels ?? {}),
        };

        const embeddingModels: Record<string, EmbeddingModelFactory> = {
            ...existing.embeddingModels,
            ...(definition.embeddingModels ?? {}),
        };

        const mergedDefinition: InternalProviderDefinition = {
            chatModels,
            embeddingModels,
            defaultChatModel: definition.defaultChatModel ?? existing.defaultChatModel ?? firstKey(chatModels),
            defaultEmbeddingModel: definition.defaultEmbeddingModel ?? existing.defaultEmbeddingModel ?? firstKey(embeddingModels),
        };

        this.providers.set(key, mergedDefinition);
        return this;
    }

    hasProvider(name: string): boolean {
        return this.providers.has(ProviderRegistry.normalizeName(name));
    }

    listProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    listChatModels(provider: string): string[] {
        return Object.keys(this.getProvider(provider).chatModels);
    }

    listEmbeddingModels(provider: string): string[] {
        return Object.keys(this.getProvider(provider).embeddingModels);
    }

    async getChatModel(provider: string, model?: string, options?: ModelOptions): Promise<BaseChatModel> {
        const providerDef = this.getProvider(provider);
        const modelName = model ?? providerDef.defaultChatModel;
        if (!modelName) {
            throw new ModelNotFoundError(provider, '(default)', 'chat');
        }
        const factory = providerDef.chatModels[modelName];
        if (!factory) {
            throw new ModelNotFoundError(provider, modelName, 'chat');
        }
        return factory(options);
    }

    async getEmbeddingModel(provider: string, model?: string, options?: ModelOptions): Promise<EmbeddingsInterface> {
        const providerDef = this.getProvider(provider);
        const modelName = model ?? providerDef.defaultEmbeddingModel;
        if (!modelName) {
            throw new ModelNotFoundError(provider, '(default)', 'embedding');
        }
        const factory = providerDef.embeddingModels[modelName];
        if (!factory) {
            throw new ModelNotFoundError(provider, modelName, 'embedding');
        }
        return factory(options);
    }

    useOpenAI(options?: BuiltInProviderOptions): this {
        return this.registerProvider('openai', createOpenAIProviderDefinition(options));
    }

    useAnthropic(options?: BuiltInProviderOptions): this {
        return this.registerProvider('anthropic', createAnthropicProviderDefinition(options));
    }

    useOllama(options?: BuiltInProviderOptions): this {
        return this.registerProvider('ollama', createOllamaProviderDefinition(options));
    }

    useSapAICore(options?: SapAICoreProviderOptions): this {
        return this.registerProvider('sap-ai-core', createSapAICoreProviderDefinition(options));
    }

    private getProvider(name: string): InternalProviderDefinition {
        const key = ProviderRegistry.normalizeName(name);
        const provider = this.providers.get(key);
        if (!provider) {
            throw new ProviderNotFoundError(name);
        }
        return provider;
    }

    private static normalizeName(name: string): string {
        return name.trim().toLowerCase();
    }
}

export type {
    ModelOptions,
    ChatModelFactory,
    EmbeddingModelFactory,
    ProviderDefinition,
    BuiltInProviderOptions,
    BuiltInProviderModelMap,
    BuiltInProviderModelMapEntry,
    SapAICoreModelEntry,
    SapAICoreProviderOptions,
} from './types';

export {
    ProviderRegistryError,
    ProviderNotFoundError,
    ModelNotFoundError,
    ProviderImportError,
} from './errors';
