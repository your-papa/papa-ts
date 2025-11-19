/**
 * LangGraph server example.
 *
 * This file exposes a papa-ts agent as a LangGraph graph so it can be served
 * via the LangGraph CLI (`npx @langchain/langgraph-cli dev -c examples/langgraph/langgraph.json`).
 * See the JS CLI docs for more background: https://docs.langchain.com/langsmith/cli#js
 */

import 'dotenv/config';

import { z } from 'zod';
import { buildAgent, ProviderRegistry } from '../../src';
import { tool } from '@langchain/core/tools';

type SupportedProvider = 'openai' | 'sap-ai-core' | 'anthropic' | 'ollama';

const providerId = (process.env.LANGGRAPH_AGENT_PROVIDER ?? 'openai').toLowerCase() as SupportedProvider;
const modelName = process.env.LANGGRAPH_AGENT_MODEL ?? 'gpt-4o-mini';
const systemPrompt =
    process.env.LANGGRAPH_AGENT_SYSTEM_PROMPT ??
    'You are a privacy-first assistant served via LangGraph CLI.';

function createRegistry(): ProviderRegistry {
    const registry = new ProviderRegistry();
    switch (providerId) {
        case 'openai':
            registry.useOpenAI();
            break;
        case 'sap-ai-core':
            registry.useSapAICore();
            break;
        case 'anthropic':
            registry.useAnthropic();
            break;
        case 'ollama':
            registry.useOllama();
            break;
        default:
            throw new Error(
                `Unsupported provider "${providerId}". Extend examples/langgraph/graph.ts to register it.`,
            );
    }
    return registry;
}

export async function makeGraph(): Promise<ReturnType<typeof buildAgent>> {
    const registry = createRegistry();
    const model = await registry.getChatModel(providerId, modelName);
    return buildAgent({
        model,
        systemPrompt,
        tools: [webSearchTool, fetchUrlTool],
    });
}



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
