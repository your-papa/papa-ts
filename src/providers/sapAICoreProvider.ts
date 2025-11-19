import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { LangChainOrchestrationModuleConfig } from '@sap-ai-sdk/langchain';
import type {
    ChatModelFactory,
    ProviderDefinition,
    SapAICoreModelEntry,
    SapAICoreProviderOptions,
} from './types';
import { ProviderImportError } from './errors';
import { dynamicImport } from './dynamicImport';
import { firstKey } from './helpers';

const DEFAULT_CHAT_ENTRIES: Record<string, SapAICoreModelEntry> = {
    'gpt-5': { model: 'gpt-5' },
};

export function createSapAICoreProviderDefinition(options?: SapAICoreProviderOptions): ProviderDefinition {
    const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;

    return {
        chatModels: Object.entries(chatEntries).reduce<Record<string, ChatModelFactory>>((acc, [alias, descriptor]) => {
            acc[alias] = createSapAICoreChatFactory(alias, descriptor);
            return acc;
        }, {}),
        embeddingModels: {},
        defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
    };
}

function createSapAICoreChatFactory(alias: string, descriptor: SapAICoreModelEntry): ChatModelFactory {
    return async (options) => {
        try {
            const mod = await dynamicImport<{
                OrchestrationClient: new (
                    config: LangChainOrchestrationModuleConfig,
                    langchainOptions?: Record<string, unknown>,
                ) => BaseChatModel;
            }>('@sap-ai-sdk/langchain');

            const orchestrationConfig: LangChainOrchestrationModuleConfig =
                descriptor.config ??
                ({
                    promptTemplating: {
                        model: {
                            name: descriptor.model ?? alias,
                        },
                    },
                } as LangChainOrchestrationModuleConfig);

            const langchainOptions = {
                ...(descriptor.options ?? {}),
                ...(descriptor.langchainOptions ?? {}),
                ...(options ?? {}),
            };

            return new mod.OrchestrationClient(orchestrationConfig, langchainOptions);
        } catch (error) {
            throw new ProviderImportError('sap-ai-core', '@sap-ai-sdk/langchain', error);
        }
    };
}

