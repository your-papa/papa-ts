import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('langchain', () => ({
    createAgent: vi.fn(),
}));

import { createAgent } from 'langchain';

import { Agent } from '../src/agent/Agent';
import { ProviderRegistry } from '../src/providers/ProviderRegistry';
import { InMemoryThreadStore } from '../src/memory/InMemoryThreadStore';
import { createSnapshot } from '../src/memory/ThreadStore';
import type { Telemetry } from '../src/telemetry/Telemetry';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentResult } from '../src/agent/Agent';
import type { CheckpointTuple } from '@langchain/langgraph';

class MockTelemetry implements Telemetry {
    callbacks = [];
    runCompletes: AgentResult[] = [];

    getCallbacks() {
        return this.callbacks;
    }

    async onRunComplete(result: AgentResult): Promise<void> {
        this.runCompletes.push(result);
    }
}

describe('Agent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs with mocked createAgent and records telemetry + memory', async () => {
        const registry = new ProviderRegistry();
        await registry.registerProvider('mock', {
            chatModels: {
                default: async () => ({}) as unknown as BaseChatModel,
            },
            defaultChatModel: 'default',
        });

        const telemetry = new MockTelemetry();
        const threadStore = new InMemoryThreadStore();

        const invokeMock = vi.fn(async (_input, _config: RunnableConfig) => {
            return {
                messages: [
                    {
                        role: 'assistant',
                        content: 'hello world',
                    },
                ],
            };
        });

        (createAgent as unknown as vi.Mock).mockReturnValue({ invoke: invokeMock });

        const agent = new Agent({ registry, telemetry, threadStore });
        await agent.chooseModel({ provider: 'mock' });
        agent.setPrompt('You are helpful.');
        agent.bindTools([
            {
                name: 'TestTool',
            },
        ]);

        const result = await agent.run({ query: 'Hello?' });

        expect(result.response).toEqual('hello world');
        expect(result.messages).toHaveLength(1);
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(telemetry.runCompletes).toHaveLength(1);

        const metadata = await threadStore.read(result.threadId);
        expect(metadata?.metadata?.lastRunId).toEqual(result.runId);
        expect(metadata?.metadata?.model).toEqual('default');
    });

    it('streams tokens and emits final result chunks', async () => {
        const registry = new ProviderRegistry();
        await registry.registerProvider('mock', {
            chatModels: {
                default: async () => ({}) as unknown as BaseChatModel,
            },
            defaultChatModel: 'default',
        });

        const telemetry = new MockTelemetry();
        const threadStore = new InMemoryThreadStore();

        const events = [
            {
                event: 'on_chat_model_stream',
                name: 'MockChatModel',
                run_id: 'run_1',
                metadata: {},
                data: {
                    chunk: {
                        content: 'hel',
                    },
                },
            },
            {
                event: 'on_chat_model_stream',
                name: 'MockChatModel',
                run_id: 'run_1',
                metadata: {},
                data: {
                    chunk: {
                        content: 'lo',
                    },
                },
            },
            {
                event: 'on_chain_end',
                name: 'AgentExecutor',
                run_id: 'run_2',
                metadata: {},
                data: {
                    output: {
                        messages: [
                            {
                                role: 'assistant',
                                content: 'done streaming',
                            },
                        ],
                    },
                },
            },
        ];

        const streamEventsMock = vi.fn(() => ({
            async *[Symbol.asyncIterator]() {
                for (const event of events) {
                    yield event;
                }
            },
        }));

        (createAgent as unknown as vi.Mock).mockReturnValue({ streamEvents: streamEventsMock });

        const agent = new Agent({ registry, telemetry, threadStore });
        await agent.chooseModel({ provider: 'mock' });

        const observed: unknown[] = [];
        for await (const chunk of agent.streamTokens({ query: 'stream me' })) {
            observed.push(chunk);
        }

        expect(streamEventsMock).toHaveBeenCalledTimes(1);

        const tokenChunks = observed.filter((chunk) => (chunk as { type?: string }).type === 'token') as Array<{
            type: string;
            token: string;
        }>;
        // Filter out empty tokens (emitted when messages update without new tokens)
        const nonEmptyTokens = tokenChunks.map((chunk) => chunk.token).filter((t) => t.length > 0);
        expect(nonEmptyTokens).toEqual(['hel', 'lo']);

        const resultChunk = observed.find((chunk) => (chunk as { type?: string }).type === 'result') as {
            result: AgentResult;
        };
        expect(resultChunk.result.response).toEqual('done streaming');
        expect(telemetry.runCompletes).toHaveLength(1);

        const metadata = await threadStore.read(resultChunk.result.threadId);
        expect(metadata?.metadata?.lastRunId).toEqual(resultChunk.result.runId);
        expect(metadata?.metadata?.model).toEqual('default');
    });

    it('combines thread metadata with checkpoint messages when fetching history', async () => {
        const registry = new ProviderRegistry();
        await registry.registerProvider('mock', {
            chatModels: {
                default: async () => ({}) as unknown as BaseChatModel,
            },
            defaultChatModel: 'default',
        });

        const telemetry = new MockTelemetry();
        const threadStore = new InMemoryThreadStore();
        await threadStore.write(
            createSnapshot({
                threadId: 'thread-123',
                title: 'Test thread',
                metadata: { topic: 'demo' },
            }),
        );

        (createAgent as unknown as vi.Mock).mockReturnValue({
            invoke: vi.fn(),
        });

        const agent = new Agent({ registry, telemetry, threadStore });
        await agent.chooseModel({ provider: 'mock' });

        const checkpointer = (agent as unknown as { checkpointer: { getTuple: (config: RunnableConfig) => Promise<CheckpointTuple | undefined> } }).checkpointer;
        const now = new Date().toISOString();
        vi.spyOn(checkpointer, 'getTuple').mockResolvedValue({
            config: { configurable: { thread_id: 'thread-123', checkpoint_id: 'chk_1', checkpoint_ns: '' } },
            checkpoint: {
                v: 4,
                id: 'chk_1',
                ts: now,
                channel_values: {
                    messages: [
                        {
                            role: 'assistant',
                            content: 'restored from checkpoint',
                        },
                    ],
                },
                channel_versions: {},
                versions_seen: {},
            },
            metadata: {},
            pendingWrites: [],
        });

        const history = await agent.getThreadHistory('thread-123');
        expect(history).toBeDefined();
        expect(history?.metadata?.topic).toEqual('demo');
        expect(history?.messages).toHaveLength(1);
        expect(history?.messages[0].content[0]).toEqual({ type: 'text', text: 'restored from checkpoint' });
    });

    it('generates a title for a thread', async () => {
        const registry = new ProviderRegistry();
        const mockInvoke = vi.fn().mockResolvedValue({
            content: 'Generated Title',
        });

        await registry.registerProvider('mock', {
            chatModels: {
                default: async () =>
                    ({
                        invoke: mockInvoke,
                    }) as unknown as BaseChatModel,
            },
            defaultChatModel: 'default',
        });

        const telemetry = new MockTelemetry();
        const threadStore = new InMemoryThreadStore();
        const agent = new Agent({ registry, telemetry, threadStore });
        await agent.chooseModel({ provider: 'mock' });

        const threadId = 'thread-123';

        // Spy on getThreadHistory to return messages since we mocked createAgent
        // and the underlying checkpointer won't be updated by the mock.
        vi.spyOn(agent, 'getThreadHistory').mockResolvedValue({
            threadId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                { id: '1', role: 'user', content: [{ type: 'text', text: 'Hello' }] },
                { id: '2', role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] },
            ],
        });

        // Write initial metadata to store (optional, but good for consistency)
        await threadStore.write(createSnapshot({ threadId, createdAt: Date.now() }));

        // Now generate title
        const title = await agent.generateTitle(threadId);

        expect(title).toBe('Generated Title');
        expect(mockInvoke).toHaveBeenCalled();

        // Verify it's stored
        const snapshot = await threadStore.read(threadId);
        expect(snapshot?.title).toBe('Generated Title');
    });
});

