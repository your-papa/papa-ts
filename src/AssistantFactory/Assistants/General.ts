import { RunnableSequence } from '@langchain/core/runnables';
import { GenModel, GenModelConfig, GenModelFilled, GenProvider } from '../../ProviderRegistry/GenProvider';
import { BaseAssistant, AssistantResponse, PipeInput } from '../BaseAssistant';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Language, Prompts } from '../Prompts';
import { applyPatch } from 'fast-json-patch';
import { ProviderRegistry, RegisteredGenProvider } from '../../ProviderRegistry/ProviderRegistry';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export class GeneralAssistant extends BaseAssistant {
    constructor(providerRegistry: ProviderRegistry, config: { lang?: Language }, langsmithApiKey?: string) {
        super(providerRegistry, langsmithApiKey);
        this.lang = config.lang ?? 'en';
    }

    run(input: PipeInput): [AsyncGenerator<AssistantResponse>, AbortController] {
        const genLcInstance = this.getLCInstance(input.modelConfig);
        const pipe = RunnableSequence.from([
            (input: PipeInput) => ({
                query: input.userQuery,
                chatHistory: input.chatHistory,
            }),
            PromptTemplate.fromTemplate(Prompts[this.lang].conversation),
            genLcInstance,
            new StringOutputParser(),
        ]).withConfig({ runName: 'Normal Chat Pipe' });

        const controller = new AbortController();
        const stream = pipe.streamLog(input, {
            signal: controller.signal,
            ...(this.tracer ? { callbacks: [this.tracer] } : {}),
        });
        return [this.streamProcessor(stream), controller];
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
