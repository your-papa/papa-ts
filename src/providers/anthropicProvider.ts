import { ChatAnthropic } from '@langchain/anthropic';
import type {
    BuiltInProviderModelMap,
    BuiltInProviderModelMapEntry,
    BuiltInProviderOptions,
    ChatModelFactory,
    ProviderDefinition,
} from './types';
import { ProviderImportError } from './errors';
import { createChatFactories, firstKey } from './helpers';

const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_DEFAULT_VERSION = '2023-06-01';

export async function createAnthropicProviderDefinition(options?: BuiltInProviderOptions): Promise<ProviderDefinition> {
    const chatEntries = await resolveAnthropicChatEntries(options);

    return {
        chatModels: createChatFactories(chatEntries, (descriptor) => createAnthropicChatFactory(descriptor, options)),
        embeddingModels: {},
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
    };
}

function createAnthropicChatFactory(
    descriptor: BuiltInProviderModelMapEntry,
    providerOptions?: BuiltInProviderOptions,
): ChatModelFactory {
    return async (options) => {
        try {
            return new ChatAnthropic({
                model: descriptor.model,
                ...buildAnthropicClientOptions(providerOptions),
                ...(descriptor.options ?? {}),
                ...(options ?? {}),
            });
        } catch (error) {
            throw new ProviderImportError('anthropic', '@langchain/anthropic', error);
        }
    };
}

async function resolveAnthropicChatEntries(options?: BuiltInProviderOptions): Promise<BuiltInProviderModelMap> {
    if (options?.chatModels) {
        return options.chatModels;
    }
    return fetchAnthropicChatModels(options);
}

async function fetchAnthropicChatModels(options?: BuiltInProviderOptions): Promise<BuiltInProviderModelMap> {
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Anthropic model discovery requires an API key. Set ANTHROPIC_API_KEY or pass options.apiKey.');
    }

    const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
        throw new Error(
            'Global fetch implementation missing. Provide options.fetchImpl to createAnthropicProviderDefinition.',
        );
    }

    const baseUrl = sanitizeBaseUrl(options?.baseUrl ?? process.env.ANTHROPIC_API_URL ?? ANTHROPIC_DEFAULT_BASE_URL);
    const apiVersion = options?.apiVersion ?? process.env.ANTHROPIC_API_VERSION ?? ANTHROPIC_DEFAULT_VERSION;

    const response = await fetchImpl(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'anthropic-version': apiVersion,
            ...(options?.headers ?? {}),
        },
    });

    if (!response.ok) {
        const errorBody = await safeReadText(response);
        throw new Error(
            `Anthropic model discovery failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
        );
    }

    const payload = (await response.json()) as AnthropicModelResponse;
    const resources = Array.isArray(payload.data) ? payload.data : [];
    if (!resources.length) {
        throw new Error('Anthropic did not return any models for the provided credentials.');
    }

    return resources.reduce<BuiltInProviderModelMap>((acc, resource) => {
        const id = typeof resource?.id === 'string' ? resource.id.trim() : undefined;
        if (id) {
            acc[id] = id;
        }
        return acc;
    }, {});
}

function sanitizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

function buildAnthropicClientOptions(options?: BuiltInProviderOptions): Record<string, unknown> {
    const clientOptions: Record<string, unknown> = {};
    if (options?.apiKey) {
        clientOptions.apiKey = options.apiKey;
        clientOptions.anthropicApiKey = options.apiKey;
    }
    if (options?.baseUrl) {
        clientOptions.anthropicApiUrl = options.baseUrl;
    }
    return clientOptions;
}

async function safeReadText(response: Response): Promise<string | undefined> {
    try {
        return await response.text();
    } catch {
        return undefined;
    }
}

interface AnthropicModelResponse {
    data?: Array<{ id?: string }>;
}

