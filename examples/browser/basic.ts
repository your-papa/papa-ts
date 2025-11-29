/*
 * Browser usage example.
 *
 * This snippet assumes that you bundle the library with a tool like Vite or Webpack
 * and provide the required provider-specific API keys at runtime (for example via
 * environment variables injected during build or fetched from a secure backend).
 */

import {
  Agent,
  ProviderRegistry,
  IndexedDBThreadStore,
  LocalStorageCheckpointSaver,
} from '../../src';

async function main() {
  const registry = new ProviderRegistry();
  await registry.useOpenAI();

  const agent = new Agent({
    registry,
    threadStore: new IndexedDBThreadStore({ dbName: 'privacy-agent' }),
    checkpointer: new LocalStorageCheckpointSaver({ prefix: 'privacy-agent' }),
  });

  await agent.chooseModel({ provider: 'openai', chatModel: 'gpt-4o-mini' });
  agent.setPrompt('You are a privacy-preserving assistant.');

  const result = await agent.run({ query: 'Hello from the browser!', threadId: 'demo-thread' });
  console.log(result.response);
}

// Only run when executed in a browser context.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

