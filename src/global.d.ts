import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';

declare module '@langchain/openai' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type OpenAIConfig = Record<string, any>;

  export class ChatOpenAI extends BaseChatModel {
    constructor(config?: OpenAIConfig);
  }

  export class OpenAIEmbeddings implements EmbeddingsInterface {
    constructor(config?: OpenAIConfig);
    embedDocuments(documents: string[]): Promise<number[][]>;
    embedQuery(document: string): Promise<number[]>;
  }
}

declare module '@langchain/anthropic' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnthropicConfig = Record<string, any>;

  export class ChatAnthropic extends BaseChatModel {
    constructor(config?: AnthropicConfig);
  }
}

declare module '@langchain/ollama' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type OllamaConfig = Record<string, any>;

  export class ChatOllama extends BaseChatModel {
    constructor(config?: OllamaConfig);
  }

  export class OllamaEmbeddings implements EmbeddingsInterface {
    constructor(config?: OllamaConfig);
    embedDocuments(documents: string[]): Promise<number[][]>;
    embedQuery(document: string): Promise<number[]>;
  }
}

