import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import type { LangChainOrchestrationModuleConfig } from '@sap-ai-sdk/langchain';

export type ModelOptions = Record<string, unknown>;

export type ChatModelFactory = (options?: ModelOptions) => Promise<BaseChatModel>;

export type EmbeddingModelFactory = (options?: ModelOptions) => Promise<EmbeddingsInterface>;

export interface ProviderDefinition {
    chatModels?: Record<string, ChatModelFactory>;
    embeddingModels?: Record<string, EmbeddingModelFactory>;
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}

export interface BuiltInProviderModelMapEntry {
    model: string;
    options?: ModelOptions;
}

export type BuiltInProviderModelMap =
    | Record<string, string>
    | Record<string, BuiltInProviderModelMapEntry>;

export interface BuiltInProviderOptions {
    chatModels?: BuiltInProviderModelMap;
    embeddingModels?: BuiltInProviderModelMap;
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}

export interface SapAICoreModelEntry extends BuiltInProviderModelMapEntry {
    config?: LangChainOrchestrationModuleConfig;
    langchainOptions?: ModelOptions;
}

export interface SapAICoreProviderOptions {
    chatModels?: Record<string, SapAICoreModelEntry>;
    defaultChatModel?: string;
}

