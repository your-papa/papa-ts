import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
    BuiltInProviderModelMap,
    BuiltInProviderModelMapEntry,
    BuiltInProviderOptions,
    ChatModelFactory,
    ProviderDefinition,
} from './types';
import { ProviderImportError } from './errors';
import { dynamicImport } from './dynamicImport';
import { createChatFactories, firstKey } from './helpers';

const DEFAULT_CHAT_ENTRIES: BuiltInProviderModelMap = {
    'claude-3-5-sonnet': 'claude-3-5-sonnet-latest',
    'claude-3-5-haiku': 'claude-3-5-haiku-latest',
};

export function createAnthropicProviderDefinition(options?: BuiltInProviderOptions): ProviderDefinition {
    const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;

    return {
        chatModels: createChatFactories(chatEntries, createAnthropicChatFactory),
        embeddingModels: {},
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
    };
}

function createAnthropicChatFactory(descriptor: BuiltInProviderModelMapEntry): ChatModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{ ChatAnthropic: new (config: Record<string, unknown>) => BaseChatModel }>(
                '@langchain/anthropic',
            );
            const ChatAnthropic = (
                mod as { ChatAnthropic: new (config: Record<string, unknown>) => BaseChatModel }
            ).ChatAnthropic;
            return new ChatAnthropic({ model: descriptor.model, ...(descriptor.options ?? {}), ...(options ?? {}) });
        } catch (error) {
            throw new ProviderImportError('anthropic', '@langchain/anthropic', error);
        }
    };
}

