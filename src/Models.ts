import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';

export interface OpenAIGenModel {
    model: string;
    openAIApiKey: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}

export interface OllamaGenModel {
    model: string;
    baseUrl: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}

export interface OpenAIEmbedModel {
    model: string;
    openAIApiKey: string;
    similarityThreshold?: number;
    k?: number;
}

export interface OllamaEmbedModel {
    lcModel: BaseChatModel;
    similarityThreshold: number;
    k: number;
}

export type GenModel = {
    lcModel: BaseChatModel;
    contextWindow: number;
};
export type EmbedModel = {
    lcModel: Embeddings;
    similarityThreshold: number;
    k: number;
};
