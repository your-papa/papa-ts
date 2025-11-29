# LangGraph server example

This example shows how to expose the papa-ts agent over the [LangGraph CLI](https://docs.langchain.com/langsmith/cli#js).

## Usage

1. Copy `examples/langgraph/env.sample` to `examples/langgraph/.env` and fill in the provider credentials (e.g. `OPENAI_API_KEY` for OpenAI). This step is optional if you inject credentials directly in code (see below).
2. Install dependencies and build the library once: `npm install && npm run build`.
3. Start the server with the LangGraph CLI:

```
npx @langchain/langgraph-cli dev -c examples/langgraph/langgraph.json
```

This launches a local LangGraph server that serves the `privacy-agent` graph defined in `examples/langgraph/graph.ts`.

## Providing credentials without `.env`

In browser or locked-down environments you can supply provider credentials directly when configuring the registry or when selecting a model. Any `options` passed through `Agent.chooseModel()` are forwarded to the underlying LangChain model constructor.

```ts
const registry = new ProviderRegistry();
registry.useOpenAI({
  chatModels: {
    'gpt-4o-mini': {
      model: 'gpt-4o-mini',
      options: { apiKey: runtimeOpenAIApiKey },
    },
  },
});

const agent = new Agent({ registry });
await agent.chooseModel({
  provider: 'openai',
  chatModel: 'gpt-4o-mini',
  options: { apiKey: runtimeOpenAIApiKey },
});
```

Fetch the key from a secure backend (or other runtime source) before instantiating the agent and you can avoid relying on `.env` files entirely.

