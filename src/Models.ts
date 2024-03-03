import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export const OpenAIGenModels = {
    'gpt-3.5-turbo': {
        contextWindow: 4096,
        description: 'GPT-3.5 Turbo (4096 Tokens)',
    },
    'gpt-3.5-turbo-1106': {
        contextWindow: 16385,
        description: 'Latest GPT-3.5 Turbo (16385 Tokens)',
    },
    'gpt-4': {
        contextWindow: 8192,
        description: 'GPT-4 (8192 Tokens)',
    },
    'gpt-4-32k': {
        contextWindow: 32768,
        description: 'GPT-4 (32768 Tokens)',
    },
    'gpt-4-1106-preview': {
        contextWindow: 128000,
        description: 'Latest GPT-4 (128000 Tokens)',
    },
};

// R stands for Recommended
export const OllamaRGenModels = {
    llama2: {
        contextWindow: 4096,
        description: 'Llama-2 (4096 Tokens)',
    },
    'llama2-uncensored': {
        contextWindow: 4096,
        description: 'Llama-2 Uncensored (4096 Tokens)',
    },
    // mistral: {
    //     contextWindow: 8000,
    //     description: 'Mistral (8000 Tokens)',
    // },
    'mistral-openorca': {
        contextWindow: 8000,
        description: 'Mistral (8000 Tokens) with OpenOrca',
    },
    gemma: {
        contextWindow: 8000,
        description: 'Gemma (8000 Tokens)',
    },
    mixtral: {
        contextWindow: 32000,
        description: 'Mixtral (32000 Tokens)',
    },
    'dolphin-mixtral': {
        contextWindow: 32000,
        description: 'Dolphin Mixtral (32000 Tokens)',
    },
    phi: {
        contextWindow: 2048,
        description: 'Phi (2048 Tokens)',
    },
};

export const GenModels = {
    ...OpenAIGenModels,
    ...OllamaRGenModels,
};

export const OpenAIEmbedModels = {
    'text-embedding-ada-002': {
        vectorSize: 1536,
        contextWindow: 8191,
        description: 'Text Embedding ADA 002',
    },
};

export const OllamaEmbedModels = {
    llama2: {
        vectorSize: 4096,
        description: 'Llama-2 Embedding',
    },
    mistral: {
        vectorSize: 4096,
        description: 'Mistral Embedding',
    },
    'nomic-embed-text': {
        vectorSize: 768,
        description: 'Nomic Embedding',
        contextWindow: 8192,
    },
};

export const EmbedModels = {
    ...OpenAIEmbedModels,
    ...OllamaEmbedModels,
};

export const OpenAIGenModelNames = Object.keys(OpenAIGenModels);
export interface OpenAIGenModel {
    model: keyof typeof OpenAIGenModels;
    openAIApiKey: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}
export const isOpenAIGenModel = (model: OllamaRGenModel | OllamaOGenModel | OpenAIGenModel): model is OpenAIGenModel => {
    return OpenAIGenModelNames.includes(model.model);
};

export const OllamaRGenModelNames = Object.keys(OllamaRGenModels);
export interface OllamaRGenModel {
    model: keyof typeof OllamaRGenModels;
    baseUrl: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}
export const isOllamaRecommendedGenModel = (model: OllamaRGenModel | OllamaOGenModel | OpenAIGenModel): model is OllamaRGenModel => {
    return OllamaRGenModelNames.includes(model.model);
};

// O stands for Other
export interface OllamaOGenModel {
    model: string;
    baseUrl: string;
    temperature?: number;
    lcModel?: BaseChatModel;
    contextWindow?: number;
}
export type OllamaGenModel = OllamaRGenModel | OllamaOGenModel;

export const OpenAIEmbedModelNames = Object.keys(OpenAIEmbedModels);
export interface OpenAIEmbedModel {
    model: keyof typeof OpenAIEmbedModels;
    openAIApiKey: string;
    similarityThreshold?: number;
}
export const isOpenAIEmbedModel = (model: OllamaEmbedModel | OpenAIEmbedModel): model is OpenAIEmbedModel => {
    return OpenAIEmbedModelNames.includes(model.model);
};

export const OllamaEmbedModelNames = Object.keys(OllamaEmbedModels);
export interface OllamaEmbedModel {
    model: keyof typeof OllamaEmbedModels;
    baseUrl: string;
    similarityThreshold?: number;
}
export const isOllamaEmbedModel = (model: OllamaEmbedModel | OpenAIEmbedModel): model is OllamaEmbedModel => {
    return OllamaEmbedModelNames.includes(model.model);
};
