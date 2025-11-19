import { app } from 'electron';

import {
  Agent,
  ProviderRegistry,
  FsThreadStore,
  LangfuseTelemetry,
} from '../../src';

async function bootstrap() {
  const registry = new ProviderRegistry();
  registry.useOllama();

  const telemetry = new LangfuseTelemetry({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    environment: 'electron-demo',
  });

  const agent = new Agent({
    registry,
    telemetry,
    threadStore: new FsThreadStore({ directory: app.getPath('userData') }),
  });

  await agent.chooseModel({ provider: 'ollama', chatModel: 'llama3' });
  agent.setPrompt('You run inside an Electron app. Be concise.');

  const result = await agent.run({ query: 'Summarise privacy best practices.' });
  console.log(result.response);
}

app.whenReady().then(() => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  bootstrap();
});

