import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import { Language, Prompts } from '../Prompts';
import { GenModel } from '../ProviderRegistry/GenProvider';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';

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
    protected genModel: GenModel;
    protected lang: Language = 'en';
    protected stopRunFlag = false;
    protected tracer?: LangChainTracer;
    // this.tracer = getTracer(config.langsmithApiKey)

    constructor(genModel: GenModel) {
        this.genModel = genModel;
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
