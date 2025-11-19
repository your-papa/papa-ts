import { createAgent } from 'langchain';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { BaseCheckpointSaver, CheckpointTuple } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';

import type { ProviderRegistry, ModelOptions } from '../providers/ProviderRegistry';
import type { Telemetry } from '../telemetry/Telemetry';
import {
    createSnapshot,
    type ThreadMessage,
    type ThreadSnapshot,
    type ThreadStore,
} from '../memory/ThreadStore';
import { debugLog } from '../utils/logger';

export interface ChooseModelParams {
    provider: string;
    chatModel?: string;
    options?: ModelOptions;
}

export interface AgentRunOptions {
    query: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
    configurable?: Record<string, unknown>;
}

export interface AgentResult {
    runId: string;
    threadId: string;
    durationMs: number;
    messages: ThreadMessage[];
    response?: unknown;
    raw: unknown;
}

export interface AgentOptions {
    registry: ProviderRegistry;
    telemetry?: Telemetry;
    threadStore?: ThreadStore;
    checkpointer?: BaseCheckpointSaver;
    defaultPrompt?: string;
}

type AgentRunnable = ReturnType<typeof createAgent>; // invoke(), stream(), etc.

interface SelectedModel {
    provider: string;
    name: string;
    instance: BaseChatModel;
    options?: ModelOptions;
}

export class Agent {
    private prompt: string;
    private tools: readonly unknown[] = [];
    private selectedModel?: SelectedModel;
    private agentRunnable?: AgentRunnable;
    private readonly checkpointer: BaseCheckpointSaver;
    private readonly telemetry?: Telemetry;
    private readonly threadStore?: ThreadStore;
    private readonly registry: ProviderRegistry;
    private dirty = true;

    constructor(options: AgentOptions) {
        this.registry = options.registry;
        this.telemetry = options.telemetry;
        this.threadStore = options.threadStore;
        this.checkpointer = options.checkpointer ?? new MemorySaver();
        this.prompt = options.defaultPrompt ?? 'You are a privacy-focused assistant.';
        debugLog('agent.init', {
            hasTelemetry: Boolean(this.telemetry),
            hasThreadStore: Boolean(this.threadStore),
            checkpointer: this.checkpointer.constructor?.name ?? 'unknown',
        });
    }

    setPrompt(prompt: string): void {
        this.prompt = prompt;
        this.dirty = true;
    }

    bindTools(tools: readonly unknown[]): void {
        this.tools = tools;
        this.dirty = true;
    }

    async chooseModel(params: ChooseModelParams): Promise<void> {
        const { provider, chatModel, options } = params;
        const instance = await this.registry.getChatModel(provider, chatModel, options);
        const modelName = chatModel ?? this.registry.listChatModels(provider)[0];
        if (!modelName) {
            throw new Error(`No chat models registered for provider "${provider}".`);
        }
        this.selectedModel = {
            provider,
            name: modelName,
            instance,
            options,
        };
        debugLog('agent.chooseModel', { provider, modelName, options });
        this.dirty = true;
    }

    async run(options: AgentRunOptions): Promise<AgentResult> {
        const { query } = options;
        if (!this.selectedModel) {
            throw new Error('No model selected. Call chooseModel() before run().');
        }

        if (!query || query.trim().length === 0) {
            throw new Error('Query must be a non-empty string.');
        }

        const agent = await this.ensureAgent();
        const runId = this.generateId();
        const threadId = options.threadId ?? runId;
        const startedAt = new Date();
        debugLog('agent.run.start', {
            runId,
            threadId,
            provider: this.selectedModel.provider,
            model: this.selectedModel.name,
            queryPreview: query.slice(0, 200),
        });

        const callbacks = this.telemetry?.getCallbacks?.();

        const invokeConfig: RunnableConfig = {
            configurable: {
                thread_id: threadId,
                ...(options.configurable ?? {}),
            },
            metadata: options.metadata,
            callbacks: callbacks ?? undefined,
        } as RunnableConfig;

        const rawResult = await agent.invoke(
            {
                messages: [
                    {
                        role: 'user',
                        content: query,
                    },
                ],
            },
            invokeConfig,
        );

        const finishedAt = new Date();
        const messages = this.extractMessagesFromResult(rawResult);
        if (this.threadStore) {
            await this.threadStore.write(
                createSnapshot({
                    threadId,
                    messages,
                    metadata: {
                        lastRunId: runId,
                        model: this.selectedModel.name,
                    },
                }),
            );
            debugLog('agent.threadStore.write', { threadId, lastRunId: runId, messageCount: messages.length });
        }

        const result: AgentResult = {
            runId,
            threadId,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            messages,
            response: this.extractResponse(messages),
            raw: rawResult,
        };

        await this.telemetry?.onRunComplete?.(result);
        debugLog('agent.run.complete', { runId, durationMs: result.durationMs, responsePreview: typeof result.response === 'string' ? (result.response as string).slice(0, 200) : undefined });

        return result;
    }

    async getThreadHistory(threadId: string): Promise<ThreadSnapshot | undefined> {
        if (this.threadStore) {
            return this.threadStore.read(threadId);
        }

        if (this.checkpointer instanceof MemorySaver) {
            const tuple = await this.checkpointer.getTuple({ configurable: { thread_id: threadId } });
            if (!tuple) {
                return undefined;
            }
            const messages = this.extractMessagesFromCheckpoint(tuple);
            return createSnapshot({ threadId, messages });
        }

        return undefined;
    }


    private async ensureAgent(): Promise<AgentRunnable> {
        if (!this.selectedModel) {
            throw new Error('No model selected.');
        }

        if (this.agentRunnable && !this.dirty) {
            return this.agentRunnable;
        }

        this.agentRunnable = createAgent({
            model: this.selectedModel.instance,
            tools: Array.isArray(this.tools) ? [...this.tools] : [],
            systemPrompt: this.prompt,
            checkpointer: this.checkpointer,
        });
        this.dirty = false;
        return this.agentRunnable;
    }

    private extractMessagesFromResult(result: unknown): ThreadMessage[] {
        if (!result || typeof result !== 'object' || !('messages' in result)) {
            return [];
        }
        const messages = (result as { messages?: unknown }).messages;
        if (!Array.isArray(messages)) {
            return [];
        }
        return this.normalizeMessages(messages);
    }

    private extractMessagesFromCheckpoint(tuple: CheckpointTuple): ThreadMessage[] {
        const channelValues = tuple.checkpoint?.channel_values as Record<string, unknown> | undefined;
        if (!channelValues) {
            return [];
        }
        const messages = channelValues.messages;
        if (!Array.isArray(messages)) {
            return [];
        }
        return this.normalizeMessages(messages);
    }

    private normalizeMessages(messages: unknown[]): ThreadMessage[] {
        return messages.map((message) => {
            if (message && typeof message === 'object') {
                const role = typeof (message as { role?: unknown }).role === 'string' ? (message as { role: string }).role : 'unknown';
                const toolCallId = typeof (message as { tool_call_id?: unknown }).tool_call_id === 'string'
                    ? (message as { tool_call_id: string }).tool_call_id
                    : undefined;
                const name = typeof (message as { name?: unknown }).name === 'string' ? (message as { name: string }).name : undefined;
                return {
                    role,
                    content: (message as { content?: unknown }).content ?? message,
                    toolCallId,
                    name,
                    metadata: typeof (message as { metadata?: unknown }).metadata === 'object'
                        ? ((message as { metadata: Record<string, unknown> }).metadata)
                        : undefined,
                } satisfies ThreadMessage;
            }
            return {
                role: 'unknown',
                content: message,
            } satisfies ThreadMessage;
        });
    }

    private extractResponse(messages: ThreadMessage[]): unknown {
        if (messages.length === 0) {
            return undefined;
        }
        const last = messages[messages.length - 1];
        return last.content;
    }

    private generateId(): string {
        if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
            return globalThis.crypto.randomUUID();
        }
        return `run_${Math.random().toString(36).slice(2, 10)}`;
    }
}
