# LangGraph server example

This example shows how to expose the papa-ts agent over the [LangGraph CLI](https://docs.langchain.com/langsmith/cli#js).

## Usage

1. Copy `examples/langgraph/env.sample` to `examples/langgraph/.env` and fill in the provider credentials (e.g. `OPENAI_API_KEY` for OpenAI).
2. Install dependencies and build the library once: `npm install && npm run build`.
3. Start the server with the LangGraph CLI:

```
npx @langchain/langgraph-cli dev -c examples/langgraph/langgraph.json
```

This launches a local LangGraph server that serves the `privacy-agent` graph defined in `examples/langgraph/graph.ts`.


