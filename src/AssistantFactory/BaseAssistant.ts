import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { Language, Prompts } from './Prompts';
import { GenModel, GenModelConfig, GenModelFilled } from '../ProviderRegistry/GenProvider';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { getTracer } from './Langsmith';
import { ProviderRegistry, RegisteredGenProvider } from '../ProviderRegistry/ProviderRegistry';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type AssistantResponseStatus = 'startup' | 'retrieving' | 'reducing' | 'generating' | 'stopped';
export interface AssistantResponse {
    status: AssistantResponseStatus;
    content?: string;
}

export type PipeInput = {
    modelConfig: {
        provider: RegisteredGenProvider;
        model: string;
        modelConfig: GenModelConfig;
    };
    userQuery: string;
    chatHistory: string;
    lang: Language;
};

export abstract class BaseAssistant {
    protected providerRegistry: ProviderRegistry;
    protected lang: Language = 'en';
    protected stopRunFlag = false;
    protected tracer?: LangChainTracer;

    constructor(providerRegistry: ProviderRegistry, langsmithApiKey?: string) {
        this.providerRegistry = providerRegistry;
        if (langsmithApiKey) this.tracer = getTracer(langsmithApiKey);
    }

    getLCInstance({ provider, model, modelConfig }: PipeInput['modelConfig']): BaseChatModel {
        return this.providerRegistry.getGenProvider(provider).getGenLCInstance(model, modelConfig);
    }

    async generateTitleFromInitialMessage(input: PipeInput) {
        const firstMessage = input.userQuery;
        return RunnableSequence.from([
            PromptTemplate.fromTemplate(Prompts[this.lang].createTitle),
            this.getLCInstance(input.modelConfig),
            new StringOutputParser(),
        ]).invoke({
            firstMessage,
        });
    }
}
