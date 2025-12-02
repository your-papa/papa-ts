/**
 * Node.js example showcasing tool-enabled agents with live internet access.
 *
 * Usage:
 *   1. Set OPENAI_API_KEY (or any other provider credentials you prefer).
 *   2. Optionally set LangSmith or Langfuse keys for telemetry.
 *   3. Run: npx tsx examples/node/tools.ts
 */

import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

import {
    Agent,
    ProviderRegistry,
    FsThreadStore,
    LangSmithTelemetry,
    LangfuseTelemetry,
    tool,
} from '../../src';


dotenv.config({ path: './examples/node/.env', override: true })

const WEB_SEARCH_ENDPOINT =
    'https://duckduckgo.com/?q=%QUERY%&format=json&no_redirect=1&no_html=1&skip_disambig=1';

const webSearchTool = tool(
    async ({ query }) => {
        const url = WEB_SEARCH_ENDPOINT.replace('%QUERY%', encodeURIComponent(query));
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`DuckDuckGo request failed with status ${response.status}`);
        }
        const data = (await response.json()) as {
            AbstractText?: string;
            RelatedTopics?: Array<{ Text?: string }>;
            Answer?: string;
            Heading?: string;
        };

        const snippets = [
            data.Answer,
            data.AbstractText,
            data.Heading ? `${data.Heading}: ${data.AbstractText ?? ''}` : undefined,
            ...(data.RelatedTopics?.map((topic) => topic.Text).filter(Boolean) ?? []),
        ].filter((value): value is string => Boolean(value));

        return (
            snippets.slice(0, 3).join('\n\n') ||
            'No concise answer found. Try refining the query or use the fetch_url tool for a specific site.'
        );
    },
    {
        name: 'web_search',
        description:
            'Look up real-time information via DuckDuckGo instant answers. Use for broad discovery, then fetch details via fetch_url.',
        schema: z.object({
            query: z.string().describe('Search query to send to DuckDuckGo'),
        }),
    },
);

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

async function main(): Promise<void> {

    const registry = new ProviderRegistry();
    // await registry.useOpenAI();
    await registry.useSapAICore();

    let telemetry =
        process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_PROJECT
            ? new LangSmithTelemetry({
                projectName: process.env.LANGSMITH_PROJECT,
                flushOnComplete: true,
            })
            : process.env.LANGFUSE_PUBLIC_KEY
                ? new LangfuseTelemetry({
                    publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
                    secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
                    baseUrl: process.env.LANGFUSE_BASE_URL ?? '',
                    flushOnComplete: true,
                })
                : undefined;

    const agent = new Agent({
        registry,
        telemetry,
        threadStore: new FsThreadStore({
            directory: path.join(process.cwd(), '.agent-threads'),
        }),
    });

    await agent.chooseModel({
        provider: 'sap-ai-core',
        chatModel: 'gpt-5',
    });

    agent.setPrompt(
        'You are a privacy-aware Node.js assistant. Use web_search for discovery and fetch_url for precise, real-time data (e.g., weather endpoints like https://wttr.in).',
    );
    agent.bindTools([webSearchTool, fetchUrlTool]);

    const result = await agent.run({
        query: 'What is the weather today in Berlin?',
        threadId: 'node-tools-thread',
    });

    console.log('Assistant response with tooling:', result.response);
    console.dir(result.raw, { depth: 4 });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

