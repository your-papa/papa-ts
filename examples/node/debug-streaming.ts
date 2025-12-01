/**
 * Debug script to inspect streaming event structure
 */

import dotenv from 'dotenv';
import { Agent, ProviderRegistry, tool } from '../../src';
import { z } from 'zod';

dotenv.config({ path: './examples/node/.env', override: true });

const fetchUrlTool = tool(
    async ({ url }) => {
        const response = await fetch(url);
        const text = await response.text();
        return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
    },
    {
        name: 'fetch_url',
        description: 'Fetch content from a URL',
        schema: z.object({
            url: z.string().url(),
        }),
    },
);

async function main() {
    const registry = new ProviderRegistry();
    await registry.useOpenAI();

    const agent = new Agent({ registry });
    await agent.chooseModel({ provider: 'openai', chatModel: 'gpt-4o-mini' });
    agent.bindTools([fetchUrlTool]);

    console.log('=== Debugging Streaming Events ===\n');

    for await (const chunk of agent.streamTokens({
        query: 'What is the weather in Berlin?',
        threadId: 'debug-thread',
    })) {
        if (chunk.type === 'token') {
            if (chunk.token) {
                process.stdout.write(chunk.token);
            }
            
            if (chunk.messages && chunk.messages.length > 0) {
                console.log('\n\n📨 Messages detected in chunk:');
                chunk.messages.forEach((msg, idx) => {
                    console.log(`  ${idx + 1}. [${msg.role}]`);
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        console.log(`     🔧 Tool calls: ${msg.toolCalls.length}`);
                        msg.toolCalls.forEach((tc) => {
                            console.log(`        - ${tc.name}(${JSON.stringify(tc.arguments)})`);
                        });
                    }
                });
            }
        } else if (chunk.type === 'result') {
            console.log('\n\n✅ Final result:');
            console.log(`Total messages: ${chunk.result.messages.length}`);
            chunk.result.messages.forEach((msg, idx) => {
                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    console.log(`  ${idx + 1}. [${msg.role}] has ${msg.toolCalls.length} tool calls`);
                }
            });
        }
    }
}

main().catch(console.error);

