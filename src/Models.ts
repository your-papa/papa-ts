export const OpenAIGenModels = {
    'gpt-3.5-turbo': {
        maxTokens: 4096,
        description: 'GPT-3.5 Turbo (4096 Tokens)',
    },
    'gpt-3.5-turbo-1106': {
        maxTokens: 16385,
        description: 'Latest GPT-3.5 Turbo (16385 Tokens)',
    },
    'gpt-4': {
        maxTokens: 8192,
        description: 'GPT-4 (8192 Tokens)',
    },
    'gpt-4-32k': {
        maxTokens: 32768,
        description: 'GPT-4 (32768 Tokens)',
    },
    'gpt-4-1106-preview': {
        maxTokens: 128000,
        description: 'Latest GPT-4 (128000 Tokens)',
    },
};

export const OpenAIEmbedModels = {
    'text-embedding-ada-002': {
        vectorSize: 1536,
        maxTokens: 8191,
        description: 'Text Embedding ADA 002',
    },
};

export const OllamaGenModels = {
    llama2: {
        maxTokens: 4096,
        description: 'Llama-2 (4096 Tokens)',
    },
    mistral: {
        maxTokens: 8000,
        description: 'Mistral (8000 Tokens)',
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
};

export const OpenAIGenModelNames = Object.keys(OpenAIGenModels) as (keyof typeof OpenAIGenModels)[];
export interface OpenAIGenModel {
    modelName: keyof typeof OpenAIGenModels;
    openAIApiKey: string;
    temperature?: number;
}
export const isOpenAIGenModel = (model: any): model is OpenAIGenModel => {
    return OpenAIGenModelNames.includes(model.modelName);
};

export const OpenAIEmbedModelNames = Object.keys(OpenAIEmbedModels) as (keyof typeof OpenAIEmbedModels)[];
export interface OpenAIEmbedModel {
    modelName: keyof typeof OpenAIEmbedModels;
    openAIApiKey: string;
}
export const isOpenAIEmbedModel = (model: any): model is OpenAIEmbedModel => {
    return OpenAIEmbedModelNames.includes(model.modelName);
};

export const OllamaGenModelNames = Object.keys(OllamaGenModels) as (keyof typeof OllamaGenModels)[];
export interface OllamaGenModel {
    model: keyof typeof OllamaGenModels;
    baseUrl: string;
    temperature?: number;
}
export const isOllamaGenModel = (model: any): model is OllamaGenModel => {
    return OllamaGenModelNames.includes(model.model);
};

export const OllamaEmbedModelNames = Object.keys(OllamaEmbedModels) as (keyof typeof OllamaEmbedModels)[];
export interface OllamaEmbedModel {
    model: keyof typeof OllamaEmbedModels;
    baseUrl: string;
}
export const isOllamaEmbedModel = (model: any): model is OllamaEmbedModel => {
    return OllamaEmbedModelNames.includes(model.model);
};
