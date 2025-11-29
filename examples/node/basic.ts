/**
 * Minimal Node.js example that runs the privacy-first agent library directly with `node`.
 *
 * Usage:
 *   1. Export the required provider credentials (e.g. OPENAI_API_KEY)
 *   2. Optionally export Langfuse/LangSmith keys
 *   3. Run with `npx tsx examples/node/basic.ts` or compile first and execute with `node`
 */

import path from 'node:path';
import dotenv from 'dotenv';

import {
    Agent,
    ProviderRegistry,
    FsThreadStore,
    LangSmithTelemetry,
    LangfuseTelemetry,
} from '../../src';

dotenv.config({ path: './examples/node/.env', override: true })

async function main(): Promise<void> {
    // Configure providers (extend as needed)
    const registry = new ProviderRegistry();
    await registry.useSapAICore();
    await registry.useOpenAI();

    // Choose whichever telemetry backend you prefer (or omit for no tracing)
    const telemetry =
        process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_PROJECT
            ? new LangSmithTelemetry({
                projectName: process.env.LANGSMITH_PROJECT,
                flushOnComplete: true,
            })
            : process.env.LANGFUSE_PUBLIC_KEY
                ? new LangfuseTelemetry({ sessionId: 'node-demo', flushOnComplete: true })
                : undefined;

    const agent = new Agent({
        registry,
        telemetry,
        threadStore: new FsThreadStore({
            directory: path.join(process.cwd(), '.agent-threads'),
        }),
    });

    await agent.chooseModel({
        provider: 'openai',
        chatModel: 'gpt-5',
    });

    agent.setPrompt('You are a helpful, privacy-focused assistant.');

    const result = await agent.run({
        query: 'who is nicolas kohl',
        threadId: 'node-demo-thread',
    });

    console.log('Assistant response:', result.response);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

