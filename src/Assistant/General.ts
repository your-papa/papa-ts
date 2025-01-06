import { RunnableSequence } from '@langchain/core/runnables';
import { GenModel } from '../ProviderRegistry/GenProvider';
import { BaseAssistant, AssistantResponse, PipeInput } from './BaseAssistant';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Language, Prompts } from '../Prompts';
import { applyPatch } from 'fast-json-patch';

export type GeneralAssistantConfig = {
    genModel: GenModel;
    lang?: Language;
};

export class GeneralAssistant extends BaseAssistant {
    constructor(config: GeneralAssistantConfig) {
        super(config.genModel);
        this.lang = config.lang ?? 'en';
    }

    run(input: PipeInput): AsyncGenerator<AssistantResponse> {
        const pipe = RunnableSequence.from([
            {
                query: (input: PipeInput) => input.userQuery,
                chatHistory: (input: PipeInput) => input.chatHistory,
            },
            PromptTemplate.fromTemplate(Prompts[this.lang].conversation),
            this.genModel.lc,
            new StringOutputParser(),
        ]).withConfig({ runName: 'Normal Chat Pipe' });

        return this.streamProcessor(pipe.streamLog(input, this.tracer ? { callbacks: [this.tracer] } : undefined));
    }

    protected async *streamProcessor(responseStream: AsyncGenerator<any>): AsyncGenerator<AssistantResponse> {
        let pipeOutput: any = {};
        let generatedText = '';
        let sbResponse: AssistantResponse = { status: 'startup' };
        for await (const response of responseStream) {
            if (this.stopRunFlag) {
                this.stopRunFlag = false;
                yield { status: 'stopped', content: generatedText };
                return;
            }
            pipeOutput = applyPatch(pipeOutput, response.ops).newDocument;
            // Log.info('Stream Log', structuredClone(pipeOutput));
            if (pipeOutput.streamed_output.join('') !== '') {
                generatedText = pipeOutput.streamed_output.join('');
                sbResponse = { status: 'generating', content: generatedText };
            }
            yield sbResponse;
        }
    }
}
