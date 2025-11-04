import { RunnableSequence } from '@langchain/core/runnables';
import { GenModel, GenModelConfig, GenModelFilled, GenProvider } from '../../ProviderRegistry/GenProvider';
import { BaseAssistant, AssistantResponse, PipeInput } from '../BaseAssistant';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { Language, Prompts } from '../Prompts';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { applyPatch } from 'fast-json-patch';
import { ProviderRegistry, RegisteredGenProvider } from '../../ProviderRegistry/ProviderRegistry';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export class GeneralAssistant extends BaseAssistant {
    constructor(providerRegistry: ProviderRegistry, config: { lang?: Language }, langsmithApiKey?: string) {
        super(providerRegistry, langsmithApiKey);
        this.lang = config.lang ?? 'en';
    }

    run(input: PipeInput): [IterableReadableStream<StreamEvent>, AbortController] {
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

        const stream = pipe.streamEvents(input, {
            version: 'v2', // Always use "v2" for new projects with streamEvents
            signal: controller.signal,
            // Callbacks are passed to the config directly for streamEvents
            ...(this.tracer ? { callbacks: [this.tracer] } : {}),
        });
        return [stream, controller];
    }

    protected streamProcessor<T>(iterable: AsyncIterable<RunLogPatch>, abortController?: AbortController, returnTimeoutMs = 200): AsyncIterable<T> {
        return {
            [Symbol.asyncIterator]() {
                const inner: AsyncIterator<T, any, any> = (iterable as any)[Symbol.asyncIterator]();
                let closed = false;

                const safeAbort = () => {
                    try {
                        abortController?.abort();
                    } catch {}
                };

                return {
                    async next(value?: any): Promise<IteratorResult<T>> {
                        if (closed) return { done: true, value: undefined as any };
                        return (inner as any).next(value);
                    },
                    async return(value?: any): Promise<IteratorResult<T>> {
                        closed = true;
                        safeAbort();
                        if (typeof (inner as any).return === 'function') {
                            await Promise.race([(inner as any).return(value), new Promise<void>((r) => setTimeout(r, returnTimeoutMs))]).catch(() => {});
                        }
                        return { done: true, value: undefined as any };
                    },
                    async throw(err?: any): Promise<IteratorResult<T>> {
                        closed = true;
                        safeAbort();
                        if (typeof (inner as any).throw === 'function') {
                            return (inner as any).throw(err);
                        }
                        throw err;
                    },
                    [Symbol.asyncIterator]() {
                        return this;
                    },
                };
            },
        };
    }
}
