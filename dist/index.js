// src/providers/errors.ts
var ProviderRegistryError = class extends Error {
};
var ProviderNotFoundError = class extends ProviderRegistryError {
  constructor(provider) {
    super(`No provider registered with name "${provider}".`);
    this.name = "ProviderNotFoundError";
  }
};
var ModelNotFoundError = class extends ProviderRegistryError {
  constructor(provider, model, type) {
    super(`Model "${model}" not found for ${type} models in provider "${provider}".`);
    this.name = "ModelNotFoundError";
  }
};
var ProviderImportError = class extends ProviderRegistryError {
  constructor(provider, moduleName, cause) {
    const hint = `Install the module with \`npm install ${moduleName}\` in the host application.`;
    const message = `Unable to load module "${moduleName}" for provider "${provider}". ${hint}`;
    super(message);
    this.name = "ProviderImportError";
    if (cause instanceof Error) {
      this.stack = cause.stack;
    }
  }
};

// src/providers/helpers.ts
function firstKey(value) {
  if (!value) {
    return void 0;
  }
  const [first] = Object.keys(value);
  return first;
}
function normalizeDescriptor(value) {
  if (typeof value === "string") {
    return { model: value };
  }
  return value;
}
function createChatFactories(entries, factoryCreator) {
  return Object.entries(entries).reduce((acc, [alias, descriptor]) => {
    const normalized = normalizeDescriptor(descriptor);
    acc[alias] = factoryCreator(normalized);
    return acc;
  }, {});
}
function createEmbeddingFactories(entries, factoryCreator) {
  return Object.entries(entries).reduce((acc, [alias, descriptor]) => {
    const normalized = normalizeDescriptor(descriptor);
    acc[alias] = factoryCreator(normalized);
    return acc;
  }, {});
}

// src/providers/dynamicImport.ts
var dynamicImport = new Function("modulePath", "return import(modulePath);");

// src/providers/openaiProvider.ts
var DEFAULT_CHAT_ENTRIES = {
  "gpt-4o": "gpt-4o",
  "gpt-5": "gpt-5",
  "gpt-4o-mini": "gpt-4o-mini"
};
var DEFAULT_EMBEDDING_ENTRIES = {
  "text-embedding-3-large": "text-embedding-3-large",
  "text-embedding-3-small": "text-embedding-3-small"
};
function createOpenAIProviderDefinition(options) {
  const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES;
  const embeddingEntries = options?.embeddingModels ?? DEFAULT_EMBEDDING_ENTRIES;
  return {
    chatModels: createChatFactories(chatEntries, createOpenAIChatFactory),
    embeddingModels: createEmbeddingFactories(embeddingEntries, createOpenAIEmbeddingFactory),
    defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
    defaultEmbeddingModel: options?.defaultEmbeddingModel ?? firstKey(embeddingEntries)
  };
}
function createOpenAIChatFactory(descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport(
        "@langchain/openai"
      );
      const ChatOpenAI = mod.ChatOpenAI;
      return new ChatOpenAI({ model: descriptor.model, ...descriptor.options ?? {}, ...options ?? {} });
    } catch (error) {
      throw new ProviderImportError("openai", "@langchain/openai", error);
    }
  };
}
function createOpenAIEmbeddingFactory(descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport(
        "@langchain/openai"
      );
      const OpenAIEmbeddings = mod.OpenAIEmbeddings;
      return new OpenAIEmbeddings({ model: descriptor.model, ...descriptor.options ?? {}, ...options ?? {} });
    } catch (error) {
      throw new ProviderImportError("openai", "@langchain/openai", error);
    }
  };
}

// src/providers/anthropicProvider.ts
var DEFAULT_CHAT_ENTRIES2 = {
  "claude-3-5-sonnet": "claude-3-5-sonnet-latest",
  "claude-3-5-haiku": "claude-3-5-haiku-latest"
};
function createAnthropicProviderDefinition(options) {
  const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES2;
  return {
    chatModels: createChatFactories(chatEntries, createAnthropicChatFactory),
    embeddingModels: {},
    defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries)
  };
}
function createAnthropicChatFactory(descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport(
        "@langchain/anthropic"
      );
      const ChatAnthropic = mod.ChatAnthropic;
      return new ChatAnthropic({ model: descriptor.model, ...descriptor.options ?? {}, ...options ?? {} });
    } catch (error) {
      throw new ProviderImportError("anthropic", "@langchain/anthropic", error);
    }
  };
}

// src/providers/ollamaProvider.ts
var DEFAULT_CHAT_ENTRIES3 = {
  llama3: "llama3"
};
var DEFAULT_EMBEDDING_ENTRIES2 = {
  "nomic-embed-text": "nomic-embed-text"
};
function createOllamaProviderDefinition(options) {
  const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES3;
  const embeddingEntries = options?.embeddingModels ?? DEFAULT_EMBEDDING_ENTRIES2;
  return {
    chatModels: createChatFactories(chatEntries, createOllamaChatFactory),
    embeddingModels: createEmbeddingFactories(embeddingEntries, createOllamaEmbeddingFactory),
    defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries),
    defaultEmbeddingModel: options?.defaultEmbeddingModel ?? firstKey(embeddingEntries)
  };
}
function createOllamaChatFactory(descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport(
        "@langchain/ollama"
      );
      const ChatOllama = mod.ChatOllama;
      return new ChatOllama({ model: descriptor.model, ...descriptor.options ?? {}, ...options ?? {} });
    } catch (error) {
      throw new ProviderImportError("ollama", "@langchain/ollama", error);
    }
  };
}
function createOllamaEmbeddingFactory(descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport("@langchain/ollama");
      const OllamaEmbeddings = mod.OllamaEmbeddings;
      return new OllamaEmbeddings({ model: descriptor.model, ...descriptor.options ?? {}, ...options ?? {} });
    } catch (error) {
      throw new ProviderImportError("ollama", "@langchain/ollama", error);
    }
  };
}

// src/providers/sapAICoreProvider.ts
var DEFAULT_CHAT_ENTRIES4 = {
  "gpt-5": { model: "gpt-5" }
};
function createSapAICoreProviderDefinition(options) {
  const chatEntries = options?.chatModels ?? DEFAULT_CHAT_ENTRIES4;
  return {
    chatModels: Object.entries(chatEntries).reduce((acc, [alias, descriptor]) => {
      acc[alias] = createSapAICoreChatFactory(alias, descriptor);
      return acc;
    }, {}),
    embeddingModels: {},
    defaultChatModel: options?.defaultChatModel ?? firstKey(chatEntries)
  };
}
function createSapAICoreChatFactory(alias, descriptor) {
  return async (options) => {
    try {
      const mod = await dynamicImport("@sap-ai-sdk/langchain");
      const orchestrationConfig = descriptor.config ?? {
        promptTemplating: {
          model: {
            name: descriptor.model ?? alias
          }
        }
      };
      const langchainOptions = {
        ...descriptor.options ?? {},
        ...descriptor.langchainOptions ?? {},
        ...options ?? {}
      };
      return new mod.OrchestrationClient(orchestrationConfig, langchainOptions);
    } catch (error) {
      throw new ProviderImportError("sap-ai-core", "@sap-ai-sdk/langchain", error);
    }
  };
}

// src/providers/ProviderRegistry.ts
var ProviderRegistry = class _ProviderRegistry {
  providers = /* @__PURE__ */ new Map();
  registerProvider(name, definition) {
    const key = _ProviderRegistry.normalizeName(name);
    const existing = this.providers.get(key) ?? {
      chatModels: {},
      embeddingModels: {},
      defaultChatModel: void 0,
      defaultEmbeddingModel: void 0
    };
    const chatModels = {
      ...existing.chatModels,
      ...definition.chatModels ?? {}
    };
    const embeddingModels = {
      ...existing.embeddingModels,
      ...definition.embeddingModels ?? {}
    };
    const mergedDefinition = {
      chatModels,
      embeddingModels,
      defaultChatModel: definition.defaultChatModel ?? existing.defaultChatModel ?? firstKey(chatModels),
      defaultEmbeddingModel: definition.defaultEmbeddingModel ?? existing.defaultEmbeddingModel ?? firstKey(embeddingModels)
    };
    this.providers.set(key, mergedDefinition);
    return this;
  }
  hasProvider(name) {
    return this.providers.has(_ProviderRegistry.normalizeName(name));
  }
  listProviders() {
    return Array.from(this.providers.keys());
  }
  listChatModels(provider) {
    return Object.keys(this.getProvider(provider).chatModels);
  }
  listEmbeddingModels(provider) {
    return Object.keys(this.getProvider(provider).embeddingModels);
  }
  async getChatModel(provider, model, options) {
    const providerDef = this.getProvider(provider);
    const modelName = model ?? providerDef.defaultChatModel;
    if (!modelName) {
      throw new ModelNotFoundError(provider, "(default)", "chat");
    }
    const factory = providerDef.chatModels[modelName];
    if (!factory) {
      throw new ModelNotFoundError(provider, modelName, "chat");
    }
    return factory(options);
  }
  async getEmbeddingModel(provider, model, options) {
    const providerDef = this.getProvider(provider);
    const modelName = model ?? providerDef.defaultEmbeddingModel;
    if (!modelName) {
      throw new ModelNotFoundError(provider, "(default)", "embedding");
    }
    const factory = providerDef.embeddingModels[modelName];
    if (!factory) {
      throw new ModelNotFoundError(provider, modelName, "embedding");
    }
    return factory(options);
  }
  useOpenAI(options) {
    return this.registerProvider("openai", createOpenAIProviderDefinition(options));
  }
  useAnthropic(options) {
    return this.registerProvider("anthropic", createAnthropicProviderDefinition(options));
  }
  useOllama(options) {
    return this.registerProvider("ollama", createOllamaProviderDefinition(options));
  }
  useSapAICore(options) {
    return this.registerProvider("sap-ai-core", createSapAICoreProviderDefinition(options));
  }
  getProvider(name) {
    const key = _ProviderRegistry.normalizeName(name);
    const provider = this.providers.get(key);
    if (!provider) {
      throw new ProviderNotFoundError(name);
    }
    return provider;
  }
  static normalizeName(name) {
    return name.trim().toLowerCase();
  }
};

// src/agent/Agent.ts
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

// src/memory/ThreadStore.ts
function createSnapshot(params) {
  const { threadId, messages, metadata, updatedAt } = params;
  return {
    threadId,
    messages,
    metadata,
    updatedAt: updatedAt ?? Date.now()
  };
}

// src/utils/logger.ts
function resolveFlagValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return void 0;
}
var globalFlag = typeof globalThis !== "undefined" ? globalThis.PRIVACY_AGENT_DEBUG : void 0;
var envFlag = (() => {
  if (typeof globalThis === "undefined") {
    return void 0;
  }
  const maybeProcess = globalThis.process;
  return maybeProcess?.env?.PRIVACY_AGENT_DEBUG;
})();
var isDebugEnabled = resolveFlagValue(globalFlag) ?? resolveFlagValue(envFlag) ?? false;
function debugLog(scope, details) {
  if (!isDebugEnabled) {
    return;
  }
  const globalConsole = typeof globalThis !== "undefined" ? globalThis.console : void 0;
  const logFn = globalConsole && typeof globalConsole.debug === "function" ? globalConsole.debug.bind(globalConsole) : globalConsole?.log?.bind(globalConsole);
  if (!logFn) {
    return;
  }
  const payload = typeof details === "string" ? details : JSON.stringify(details, (_, value) => value, 2);
  logFn(`[privacy-agent][${(/* @__PURE__ */ new Date()).toISOString()}][${scope}]`, payload);
}

// src/agent/Agent.ts
var Agent = class {
  prompt;
  tools = [];
  selectedModel;
  agentRunnable;
  checkpointer;
  telemetry;
  threadStore;
  registry;
  dirty = true;
  constructor(options) {
    this.registry = options.registry;
    this.telemetry = options.telemetry;
    this.threadStore = options.threadStore;
    this.checkpointer = options.checkpointer ?? new MemorySaver();
    this.prompt = options.defaultPrompt ?? "You are a privacy-focused assistant.";
    debugLog("agent.init", {
      hasTelemetry: Boolean(this.telemetry),
      hasThreadStore: Boolean(this.threadStore),
      checkpointer: this.checkpointer.constructor?.name ?? "unknown"
    });
  }
  setPrompt(prompt) {
    this.prompt = prompt;
    this.dirty = true;
  }
  bindTools(tools) {
    this.tools = tools;
    this.dirty = true;
  }
  async chooseModel(params) {
    const { provider, chatModel, options } = params;
    const instance = await this.registry.getChatModel(provider, chatModel, options);
    const modelName = chatModel ?? this.registry.listChatModels(provider)[0];
    if (!modelName) {
      throw new Error(`No chat models registered for provider "${provider}".`);
    }
    this.selectedModel = {
      provider,
      name: modelName,
      instance,
      options
    };
    debugLog("agent.chooseModel", { provider, modelName, options });
    this.dirty = true;
  }
  async run(options) {
    const { query } = options;
    if (!this.selectedModel) {
      throw new Error("No model selected. Call chooseModel() before run().");
    }
    if (!query || query.trim().length === 0) {
      throw new Error("Query must be a non-empty string.");
    }
    const agent = await this.ensureAgent();
    const runId = this.generateId();
    const threadId = options.threadId ?? runId;
    const startedAt = /* @__PURE__ */ new Date();
    debugLog("agent.run.start", {
      runId,
      threadId,
      provider: this.selectedModel.provider,
      model: this.selectedModel.name,
      queryPreview: query.slice(0, 200)
    });
    const callbacks = this.telemetry?.getCallbacks?.();
    const invokeConfig = {
      configurable: {
        thread_id: threadId,
        ...options.configurable ?? {}
      },
      metadata: options.metadata,
      callbacks: callbacks ?? void 0
    };
    const rawResult = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: query
          }
        ]
      },
      invokeConfig
    );
    const finishedAt = /* @__PURE__ */ new Date();
    const messages = this.extractMessagesFromResult(rawResult);
    if (this.threadStore) {
      await this.threadStore.write(
        createSnapshot({
          threadId,
          messages,
          metadata: {
            lastRunId: runId,
            model: this.selectedModel.name
          }
        })
      );
      debugLog("agent.threadStore.write", { threadId, lastRunId: runId, messageCount: messages.length });
    }
    const result = {
      runId,
      threadId,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      messages,
      response: this.extractResponse(messages),
      raw: rawResult
    };
    await this.telemetry?.onRunComplete?.(result);
    debugLog("agent.run.complete", { runId, durationMs: result.durationMs, responsePreview: typeof result.response === "string" ? result.response.slice(0, 200) : void 0 });
    return result;
  }
  async getThreadHistory(threadId) {
    if (this.threadStore) {
      return this.threadStore.read(threadId);
    }
    if (this.checkpointer instanceof MemorySaver) {
      const tuple = await this.checkpointer.getTuple({ configurable: { thread_id: threadId } });
      if (!tuple) {
        return void 0;
      }
      const messages = this.extractMessagesFromCheckpoint(tuple);
      return createSnapshot({ threadId, messages });
    }
    return void 0;
  }
  async ensureAgent() {
    if (!this.selectedModel) {
      throw new Error("No model selected.");
    }
    if (this.agentRunnable && !this.dirty) {
      return this.agentRunnable;
    }
    this.agentRunnable = createAgent({
      model: this.selectedModel.instance,
      tools: Array.isArray(this.tools) ? [...this.tools] : [],
      systemPrompt: this.prompt,
      checkpointer: this.checkpointer
    });
    this.dirty = false;
    return this.agentRunnable;
  }
  extractMessagesFromResult(result) {
    if (!result || typeof result !== "object" || !("messages" in result)) {
      return [];
    }
    const messages = result.messages;
    if (!Array.isArray(messages)) {
      return [];
    }
    return this.normalizeMessages(messages);
  }
  extractMessagesFromCheckpoint(tuple) {
    const channelValues = tuple.checkpoint?.channel_values;
    if (!channelValues) {
      return [];
    }
    const messages = channelValues.messages;
    if (!Array.isArray(messages)) {
      return [];
    }
    return this.normalizeMessages(messages);
  }
  normalizeMessages(messages) {
    return messages.map((message) => {
      if (message && typeof message === "object") {
        const role = typeof message.role === "string" ? message.role : "unknown";
        const toolCallId = typeof message.tool_call_id === "string" ? message.tool_call_id : void 0;
        const name = typeof message.name === "string" ? message.name : void 0;
        return {
          role,
          content: message.content ?? message,
          toolCallId,
          name,
          metadata: typeof message.metadata === "object" ? message.metadata : void 0
        };
      }
      return {
        role: "unknown",
        content: message
      };
    });
  }
  extractResponse(messages) {
    if (messages.length === 0) {
      return void 0;
    }
    const last = messages[messages.length - 1];
    return last.content;
  }
  generateId() {
    if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
      return globalThis.crypto.randomUUID();
    }
    return `run_${Math.random().toString(36).slice(2, 10)}`;
  }
};

// src/agent/build.ts
import { createAgent as createAgent2 } from "langchain";
import { MemorySaver as MemorySaver2 } from "@langchain/langgraph";
function buildAgent(params) {
  const { model, tools = [], systemPrompt, checkpointer } = params;
  const toolList = Array.isArray(tools) ? [...tools] : [];
  return createAgent2({
    model,
    tools: toolList,
    systemPrompt,
    checkpointer: checkpointer ?? new MemorySaver2()
  });
}

// src/telemetry/Telemetry.ts
var NullTelemetry = class {
  getCallbacks() {
    return void 0;
  }
};

// src/telemetry/LangfuseTelemetry.ts
import { CallbackHandler } from "@langfuse/langchain";
var LangfuseTelemetry = class {
  handler;
  flushOnComplete;
  constructor(options) {
    const { flushOnComplete = false, ...handlerOptions } = options ?? {};
    this.handler = new CallbackHandler(handlerOptions);
    this.flushOnComplete = flushOnComplete;
  }
  getCallbacks() {
    return [this.handler];
  }
  async onRunComplete() {
    if (!this.flushOnComplete) {
      return;
    }
    const maybeFlush = this.handler.flush;
    if (typeof maybeFlush === "function") {
      await maybeFlush.call(this.handler);
    }
  }
};

// src/telemetry/LangsmithTelemetry.ts
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
var LangSmithTelemetry = class {
  tracer;
  flushOnComplete;
  constructor(options) {
    const { flushOnComplete = false, ...fields } = options ?? {};
    this.tracer = new LangChainTracer(fields);
    this.flushOnComplete = flushOnComplete;
  }
  getCallbacks() {
    return [this.tracer];
  }
  async onRunComplete() {
    if (!this.flushOnComplete) {
      return;
    }
    const maybeFlush = this.tracer.flush;
    if (typeof maybeFlush === "function") {
      await maybeFlush.call(this.tracer);
    }
  }
};

// src/memory/InMemoryThreadStore.ts
var InMemoryThreadStore = class {
  store = /* @__PURE__ */ new Map();
  async read(threadId) {
    return this.store.get(threadId);
  }
  async write(snapshot) {
    this.store.set(snapshot.threadId, createSnapshot(snapshot));
  }
  async delete(threadId) {
    this.store.delete(threadId);
  }
  async list() {
    return Array.from(this.store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async clear() {
    this.store.clear();
  }
};

// src/memory/LocalStorageThreadStore.ts
var LocalStorageThreadStore = class {
  prefix;
  storage;
  constructor(options) {
    this.prefix = options?.prefix ?? "papa-agent-thread";
    const storage = options?.storage ?? (typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : void 0);
    if (!storage) {
      throw new Error("localStorage is not available in the current environment.");
    }
    this.storage = storage;
  }
  async read(threadId) {
    const raw = this.storage.getItem(this.key(threadId));
    if (!raw) {
      return void 0;
    }
    return this.safeParse(raw);
  }
  async write(snapshot) {
    const normalized = createSnapshot(snapshot);
    this.storage.setItem(this.key(normalized.threadId), JSON.stringify(normalized));
  }
  async delete(threadId) {
    this.storage.removeItem(this.key(threadId));
  }
  async list() {
    const entries = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key || !key.startsWith(this.prefix)) {
        continue;
      }
      const value = this.storage.getItem(key);
      if (!value) {
        continue;
      }
      const snapshot = this.safeParse(value);
      if (snapshot) {
        entries.push(snapshot);
      }
    }
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async clear() {
    const keys = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => this.storage.removeItem(key));
  }
  key(threadId) {
    return `${this.prefix}:${threadId}`;
  }
  safeParse(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.threadId !== "string" || !Array.isArray(parsed.messages)) {
        return void 0;
      }
      return parsed;
    } catch {
      return void 0;
    }
  }
};

// src/memory/IndexedDBThreadStore.ts
var DEFAULT_DB_NAME = "papa-agent-threads";
var DEFAULT_STORE_NAME = "threads";
var IndexedDBThreadStore = class {
  dbName;
  storeName;
  dbPromise;
  constructor(options) {
    if (typeof globalThis.indexedDB === "undefined") {
      throw new Error("indexedDB is not available in this environment.");
    }
    this.dbName = options?.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options?.storeName ?? DEFAULT_STORE_NAME;
  }
  async read(threadId) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(threadId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async write(snapshot) {
    const db = await this.openDb();
    const normalized = createSnapshot(snapshot);
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(normalized);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  async delete(threadId) {
    const db = await this.openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(threadId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  async list() {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = Array.isArray(request.result) ? request.result : [];
        resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
      };
    });
  }
  async clear() {
    const db = await this.openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  async openDb() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open(this.dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: "threadId" });
          }
        };
      });
    }
    return this.dbPromise;
  }
};

// src/memory/FsThreadStore.ts
var FsThreadStore = class {
  directory;
  extension;
  fsModule;
  pathModule;
  initPromise;
  constructor(options) {
    this.directory = options.directory;
    this.extension = options.fileExtension ?? ".json";
  }
  async read(threadId) {
    try {
      const { fs, path } = await this.loadNodeModules();
      const file = this.filePath(path, threadId);
      const contents = await fs.readFile(file, "utf8");
      return JSON.parse(contents);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return void 0;
      }
      throw error;
    }
  }
  async write(snapshot) {
    const normalized = createSnapshot(snapshot);
    const { fs, path } = await this.loadNodeModules();
    await this.ensureDirectory(fs);
    const file = this.filePath(path, normalized.threadId);
    await fs.writeFile(file, JSON.stringify(normalized), "utf8");
  }
  async delete(threadId) {
    try {
      const { fs, path } = await this.loadNodeModules();
      await fs.unlink(this.filePath(path, threadId));
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }
  }
  async list() {
    const { fs, path } = await this.loadNodeModules();
    await this.ensureDirectory(fs);
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(this.extension)) {
        continue;
      }
      const file = path.join(this.directory, entry.name);
      try {
        const contents = await fs.readFile(file, "utf8");
        const snapshot = JSON.parse(contents);
        if (snapshot.threadId) {
          snapshots.push(snapshot);
        }
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          throw error;
        }
      }
    }
    return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async clear() {
    const { fs, path } = await this.loadNodeModules();
    await this.ensureDirectory(fs);
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    await Promise.all(
      entries.filter((entry) => entry.isFile() && entry.name.endsWith(this.extension)).map((entry) => fs.unlink(path.join(this.directory, entry.name)).catch((error) => {
        if (!this.isNotFoundError(error)) {
          throw error;
        }
      }))
    );
  }
  async loadNodeModules() {
    if (!this.fsModule || !this.pathModule) {
      const [fs, path] = await Promise.all([import("fs/promises"), import("path")]);
      this.fsModule = fs;
      this.pathModule = path;
    }
    return { fs: this.fsModule, path: this.pathModule };
  }
  async ensureDirectory(fs) {
    if (!this.initPromise) {
      this.initPromise = fs.mkdir(this.directory, { recursive: true }).then(() => void 0);
    }
    await this.initPromise;
    await fs.mkdir(this.directory, { recursive: true }).catch((error) => {
      if (!this.isEexistError(error)) {
        throw error;
      }
    });
  }
  filePath(path, threadId) {
    const safeName = encodeURIComponent(threadId);
    return path.join(this.directory, `${safeName}${this.extension}`);
  }
  isNotFoundError(error) {
    return this.hasCode(error, "ENOENT");
  }
  isEexistError(error) {
    return this.hasCode(error, "EEXIST");
  }
  hasCode(error, code) {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }
};
export {
  Agent,
  FsThreadStore,
  InMemoryThreadStore,
  IndexedDBThreadStore,
  LangSmithTelemetry,
  LangfuseTelemetry,
  LocalStorageThreadStore,
  ModelNotFoundError,
  NullTelemetry,
  ProviderImportError,
  ProviderNotFoundError,
  ProviderRegistry,
  ProviderRegistryError,
  buildAgent,
  createSnapshot
};
//# sourceMappingURL=index.js.map