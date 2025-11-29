import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('langchain', () => ({
    createAgent: vi.fn(),
}));

import { createAgent } from 'langchain';

import { Agent } from '../src/agent/Agent';
import { ProviderRegistry } from '../src/providers/ProviderRegistry';
import { InMemoryThreadStore } from '../src/memory/InMemoryThreadStore';
import type { Telemetry } from '../src/telemetry/Telemetry';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentResult } from '../src/agent/Agent';

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
        registry.registerProvider('mock', {
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

        const history = await threadStore.read(result.threadId);
        expect(history?.messages[0].content).toEqual('hello world');
    });

    it('streams tokens and emits final result chunks', async () => {
        const registry = new ProviderRegistry();
        registry.registerProvider('mock', {
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
        for await (const chunk of agent.streamTokens({ query: 'stream me', includeEvents: true })) {
            observed.push(chunk);
        }

        expect(streamEventsMock).toHaveBeenCalledTimes(1);

        const tokenChunks = observed.filter((chunk) => (chunk as { type?: string }).type === 'token') as Array<{
            type: string;
            token: string;
        }>;
        expect(tokenChunks.map((chunk) => chunk.token)).toEqual(['hel', 'lo']);

        const resultChunk = observed.find((chunk) => (chunk as { type?: string }).type === 'result') as {
            result: AgentResult;
        };
        expect(resultChunk.result.response).toEqual('done streaming');
        expect(telemetry.runCompletes).toHaveLength(1);

        const history = await threadStore.read(resultChunk.result.threadId);
        expect(history?.messages[0].content).toEqual('done streaming');
    });
});

