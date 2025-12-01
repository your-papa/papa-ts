/**
 * Example showing how to consume Agent.streamTokens() with normalized messages.
 *
 * This demonstrates:
 * 1. Simple token streaming (default, clean API)
 * 2. Using normalized messages during streaming
 * 3. Incremental message updates
 * 4. Final result with complete message history
 */

import { Agent, ProviderRegistry, getMessageText, tool, type AgentStreamChunk } from '../../src';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: './examples/node/.env', override: true });


async function simpleStreaming() {
    const registry = new ProviderRegistry();
    await registry.useOpenAI();

    const agent = new Agent({ registry });
    await agent.chooseModel({ provider: 'openai', chatModel: 'gpt-4o-mini' });

    console.log('=== Simple Token Streaming (Default) ===\n');

    for await (const chunk of agent.streamTokens({
        query: 'Tell me a short joke',
        threadId: 'simple-thread',
    })) {
        switch (chunk.type) {
            case 'token':
                // Just print tokens as they arrive
                // No raw event object exposed by default
                process.stdout.write(chunk.token);
                break;

            case 'result':
                // Final result with normalized messages
                console.log('\n\n✅ Complete!');
                console.log(`Response: ${chunk.result.response}`);
                console.log(`Total messages: ${chunk.result.messages.length}`);
                break;
        }
    }
}

async function streamingWithMessages() {
    const registry = new ProviderRegistry();
    await registry.useOpenAI();

    const agent = new Agent({ registry });
    await agent.chooseModel({ provider: 'openai', chatModel: 'gpt-4o-mini' });

    console.log('\n\n=== Streaming with Normalized Messages ===\n');

    let currentMessages: Array<{ role: string; content: string }> = [];

    for await (const chunk of agent.streamTokens({
        query: 'What is 2+2? Then explain why.',
        threadId: 'messages-thread',
    })) {
        switch (chunk.type) {
            case 'token':
                // Print token
                process.stdout.write(chunk.token);

                // Update messages if available (incremental updates during streaming)
                if (chunk.messages && chunk.messages.length > 0) {
                    currentMessages = chunk.messages.map((msg) => ({
                        role: msg.role,
                        content: getMessageText(msg) ?? '',
                    }));
                }
                break;

            case 'result':
                // Final result has complete message history
                console.log('\n\n✅ Complete!');
                console.log('\n📝 Full conversation:');
                chunk.result.messages.forEach((msg, idx) => {
                    const text = getMessageText(msg);
                    console.log(`  ${idx + 1}. [${msg.role}]: ${text?.slice(0, 100)}${text && text.length > 100 ? '...' : ''}`);
                });
                break;
        }
    }
}

const fetchUrlTool = tool(
    async ({ url }) => {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'privacy-agent-node/1.0 (+https://example.com)',
            },
        });
        if (!response.ok) {
            throw new Error(`Request to ${url} failed with status ${response.status}`);
        }
        const text = await response.text();
        return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
    },
    {
        name: 'fetch_url',
        description:
            'Perform an HTTP GET to retrieve up-to-date information from a specific URL (e.g., https://wttr.in/Berlin?format=3).',
        schema: z.object({
            url: z
                .string()
                .url()
                .describe('Fully-qualified URL to fetch (https://...)'),
        }),
    },
);

async function streamingWithToolCalls() {
    const registry = new ProviderRegistry();
    await registry.useOpenAI();

    const agent = new Agent({ registry });
    await agent.chooseModel({ provider: 'openai', chatModel: 'gpt-4o-mini' });

    agent.bindTools([fetchUrlTool]);

    console.log('\n\n=== Streaming with Tool Calls ===\n');

    for await (const chunk of agent.streamTokens({
        query: 'What is the weather in Berlin?',
        threadId: 'tools-thread',
    })) {
        switch (chunk.type) {
            case 'token':
                process.stdout.write(chunk.token);

                // Check for tool calls in normalized messages
                if (chunk.messages) {
                    const lastMessage = chunk.messages[chunk.messages.length - 1];
                    if (lastMessage?.toolCalls && lastMessage.toolCalls.length > 0) {
                        console.log('\n\n🔧 Tool calls detected:');
                        lastMessage.toolCalls.forEach((toolCall) => {
                            console.log(`  - ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                        });
                    }
                }
                break;

            case 'result':
                console.log('\n\n✅ Complete!');
                // All messages are normalized, including tool messages
                chunk.result.messages.forEach((msg) => {
                    if (msg.toolCalls) {
                        console.log(`\n🔧 Tool calls in message:`);
                        msg.toolCalls.forEach((tc) => {
                            console.log(`  ${tc.name}: ${JSON.stringify(tc.arguments)}`);
                        });
                    }
                });
                break;
        }
    }
}

// Run examples
async function main() {
    try {
        // await simpleStreaming();
        // await streamingWithMessages();
        await streamingWithToolCalls(); // Uncomment if you have tools defined
    } catch (error) {
        console.error('Error:', error);
        process.exitCode = 1;
    }
}

main();

