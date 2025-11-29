/**
 * Node.js streaming example showcasing Agent.streamTokens().
 *
 * Usage:
 *   1. Set OPENAI_API_KEY (or credentials for your chosen provider).
 *   2. Optionally set STREAM_PROVIDER / STREAM_MODEL env vars or edit below defaults.
 *   3. Run: npx tsx examples/node/streaming.ts "Your question here"
 *
 * The script will print incremental tokens as they arrive and finish with the
 * aggregated AgentResult once the run completes.
 */

import dotenv from 'dotenv';

import { Agent, ProviderRegistry } from '../../src';

dotenv.config({ path: './examples/node/.env', override: true });

async function main(): Promise<void> {
    const registry = new ProviderRegistry().useOpenAI().useSapAICore();

    const agent = new Agent({
        registry,
    });

    const provider = (process.env.STREAM_PROVIDER ?? 'openai').toLowerCase();
    const model = process.env.STREAM_MODEL ?? (provider === 'openai' ? 'gpt-4o-mini' : undefined);

    await agent.chooseModel({
        provider,
        chatModel: model,
    });

    agent.setPrompt(
        'You are a concise assistant. Stream partial thoughts to keep the user informed, then provide a short summary at the end.',
    );

    const query =
        process.argv.slice(2).join(' ') || 'Give me two fun facts about the Northern Lights.';

    const abortController = new AbortController();

    // Optional: cancel after 2 minutes to avoid runaway costs in demos.
    const timeout = setTimeout(() => abortController.abort(), 2 * 60 * 1000);

    let aggregated = '';

    console.log(`\n🧠 Streaming response for: "${query}"\n`);

    try {
        for await (const chunk of agent.streamTokens({
            query,
            threadId: 'node-streaming-thread',
            includeEvents: true,
            signal: abortController.signal,
            metadata: {
                example: 'node-streaming',
            },
        })) {
            switch (chunk.type) {
                case 'token': {
                    aggregated += chunk.token;
                    process.stdout.write(chunk.token);
                    break;
                }
                case 'event': {
                    const isStreamEvent = chunk.event.event.endsWith('_stream');
                    if (!isStreamEvent) {
                        console.debug(
                            `\n[event] ${chunk.event.event} (${chunk.event.name}) run=${chunk.event.run_id}`,
                        );
                    }
                    break;
                }
                case 'result': {
                    console.log('\n\n✅ Final agent response:', chunk.result.response);
                    console.log('\n🧾 Stored messages:', chunk.result.messages.length);
                    break;
                }
                default:
                    break;
            }
        }
    } catch (error) {
        if (abortController.signal.aborted) {
            console.error('\n⏹️ Streaming aborted by user/timeout.');
        } else {
            console.error('\n❌ Streaming failed:', error);
        }
    } finally {
        clearTimeout(timeout);
    }

    console.log('\n\n---\nFull assembled text:\n', aggregated.trim());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});


