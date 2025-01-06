import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { Language, Prompts } from './Prompts';
import { GenModel, GenModelFilled } from '../ProviderRegistry/GenProvider';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { getTracer } from './Langsmith';

export type AssistantResponseStatus = 'startup' | 'retrieving' | 'reducing' | 'generating' | 'stopped';
export interface AssistantResponse {
    status: AssistantResponseStatus;
    content?: string;
}

export type PipeInput = {
    userQuery: string;
    chatHistory: string;
    lang: Language;
};

export abstract class BaseAssistant {
    protected genModel: GenModelFilled;
    protected lang: Language = 'en';
    protected stopRunFlag = false;
    protected tracer?: LangChainTracer;

    constructor(genModel: GenModelFilled, langsmithApiKey?: string) {
        this.genModel = genModel;
        if (langsmithApiKey) this.tracer = getTracer(langsmithApiKey);
    }

    abstract run(input: PipeInput): AsyncGenerator<AssistantResponse>;
    stopRun() {
        this.stopRunFlag = true;
    }

    async createTitleFromChatHistory(lang: Language, chatHistory: string) {
        return RunnableSequence.from([PromptTemplate.fromTemplate(Prompts[lang].createTitle), this.genModel.lc, new StringOutputParser()]).invoke({
            chatHistory,
        });
    }
}
