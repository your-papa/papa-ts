import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface OpenAIGenModel {
    model: string;
    openAIApiKey: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}
export const isOpenAIGenModel = (model: GenModel): model is OpenAIGenModel => {
    return (model as OpenAIGenModel).openAIApiKey !== undefined;
};

export interface OllamaGenModel {
    model: string;
    baseUrl: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}
export const isOllamaGenModel = (model: GenModel): model is OllamaGenModel => {
    return (model as OllamaGenModel).baseUrl !== undefined;
};

export interface OpenAIEmbedModel {
    model: string;
    openAIApiKey: string;
    similarityThreshold?: number;
}
export const isOpenAIEmbedModel = (model: EmbedModel): model is OpenAIEmbedModel => {
    return (model as OpenAIEmbedModel).openAIApiKey !== undefined;
};

export interface OllamaEmbedModel {
    model: string;
    baseUrl: string;
    similarityThreshold?: number;
}
export const isOllamaEmbedModel = (model: EmbedModel): model is OllamaEmbedModel => {
    return (model as OllamaEmbedModel).baseUrl !== undefined;
};

export type GenModel = OllamaGenModel | OpenAIGenModel;
export type EmbedModel = OllamaEmbedModel | OpenAIEmbedModel;
