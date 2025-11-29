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

const SAP_AI_CORE_DEFAULT_BASE_URL = 'https://api.ai.sap.com/v1';

export async function createSapAICoreProviderDefinition(options?: SapAICoreProviderOptions): Promise<ProviderDefinition> {
    const { chatEntries, embeddingEntries } = await resolveSapAICoreEntries(options);

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

async function resolveSapAICoreEntries(
    options?: SapAICoreProviderOptions,
): Promise<{ chatEntries: Record<string, SapAICoreModelEntry>; embeddingEntries: Record<string, SapAICoreModelEntry> }> {
    const providedChat = options?.chatModels;
    const providedEmbedding = options?.embeddingModels;

    if (providedChat && providedEmbedding) {
        return { chatEntries: providedChat, embeddingEntries: providedEmbedding };
    }

    const discovered = await fetchSapAICoreModels(options);
    return {
        chatEntries: providedChat ?? discovered.chatModels,
        embeddingEntries: providedEmbedding ?? discovered.embeddingModels,
    };
}

async function fetchSapAICoreModels(
    options?: SapAICoreProviderOptions,
): Promise<{ chatModels: Record<string, SapAICoreModelEntry>; embeddingModels: Record<string, SapAICoreModelEntry> }> {
    const apiKey = options?.apiKey ?? process.env.SAP_AI_API_KEY ?? process.env.SAP_AI_CORE_API_KEY;
    if (!apiKey) {
        throw new Error(
            'SAP AI Core model discovery requires an API key. Set SAP_AI_API_KEY or pass options.apiKey with a valid token.',
        );
    }

    const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('Global fetch implementation missing. Provide options.fetchImpl to createSapAICoreProviderDefinition.');
    }

    const baseUrl = sanitizeBaseUrl(options?.baseUrl ?? process.env.SAP_AI_API_BASE_URL ?? SAP_AI_CORE_DEFAULT_BASE_URL);
    const response = await fetchImpl(`${baseUrl}/foundation-models`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
            ...(options?.headers ?? {}),
        },
    });

    if (!response.ok) {
        const errorBody = await safeReadText(response);
        throw new Error(
            `SAP AI Core model discovery failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
        );
    }

    const payload = (await response.json()) as SapAiCoreFoundationResponse;
    const items = extractFoundationModels(payload);

    if (!items.length) {
        throw new Error('SAP AI Core did not return any foundation models for the provided credentials.');
    }

    const chatModels: Record<string, SapAICoreModelEntry> = {};
    const embeddingModels: Record<string, SapAICoreModelEntry> = {};

    for (const item of items) {
        const name = getModelName(item);
        if (!name) {
            continue;
        }

        const entry: SapAICoreModelEntry = { model: name };
        if (looksLikeEmbeddingModel(name, item)) {
            embeddingModels[name] = entry;
        } else {
            chatModels[name] = entry;
        }
    }

    if (!Object.keys(chatModels).length) {
        throw new Error('SAP AI Core did not return any chat-compatible models. Provide options.chatModels to override.');
    }

    return { chatModels, embeddingModels };
}

function sanitizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

function extractFoundationModels(payload: SapAiCoreFoundationResponse): Array<Record<string, unknown>> {
    if (Array.isArray(payload.value)) {
        return payload.value;
    }
    if (Array.isArray(payload.items)) {
        return payload.items;
    }
    if (Array.isArray(payload.models)) {
        return payload.models;
    }
    return [];
}

function getModelName(model: Record<string, unknown>): string | undefined {
    const nameLike = model.name ?? model.id ?? model.modelName ?? model.model;
    if (typeof nameLike === 'string' && nameLike.trim().length > 0) {
        return nameLike.trim();
    }
    return undefined;
}

function looksLikeEmbeddingModel(name: string, model: Record<string, unknown>): boolean {
    const normalized = name.toLowerCase();
    if (normalized.includes('embed') || normalized.includes('embedding')) {
        return true;
    }

    const capabilities = extractCapabilities(model);
    return capabilities?.some((capability) => capability.includes('embedding') || capability.includes('vector')) ?? false;
}

function extractCapabilities(model: Record<string, unknown>): string[] | undefined {
    const capabilityField = model.capabilities ?? model.capability ?? model.tasks;
    if (!capabilityField) {
        return undefined;
    }

    if (Array.isArray(capabilityField)) {
        return capabilityField
            .map((value) => (typeof value === 'string' ? value.toLowerCase() : undefined))
            .filter((value): value is string => Boolean(value));
    }

    if (typeof capabilityField === 'string') {
        return [capabilityField.toLowerCase()];
    }

    return undefined;
}

async function safeReadText(response: Response): Promise<string | undefined> {
    try {
        return await response.text();
    } catch {
        return undefined;
    }
}

interface SapAiCoreFoundationResponse {
    value?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
    models?: Array<Record<string, unknown>>;
}
