import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { EmbeddingsInterface } from '@langchain/core/embeddings';
import { LangChainOrchestrationModuleConfig } from '@sap-ai-sdk/langchain';
import { BaseCheckpointSaver, AnnotationRoot } from '@langchain/langgraph';
import { Callbacks } from '@langchain/core/callbacks/manager';
import * as langchain from 'langchain';
import { LangChainTracerFields } from '@langchain/core/tracers/tracer_langchain';

type ModelOptions = Record<string, unknown>;
type ChatModelFactory = (options?: ModelOptions) => Promise<BaseChatModel>;
type EmbeddingModelFactory = (options?: ModelOptions) => Promise<EmbeddingsInterface>;
interface ProviderDefinition {
    chatModels?: Record<string, ChatModelFactory>;
    embeddingModels?: Record<string, EmbeddingModelFactory>;
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}
interface BuiltInProviderModelMapEntry {
    model: string;
    options?: ModelOptions;
}
type BuiltInProviderModelMap = Record<string, string> | Record<string, BuiltInProviderModelMapEntry>;
interface BuiltInProviderOptions {
    chatModels?: BuiltInProviderModelMap;
    embeddingModels?: BuiltInProviderModelMap;
    defaultChatModel?: string;
    defaultEmbeddingModel?: string;
}
interface SapAICoreModelEntry extends BuiltInProviderModelMapEntry {
    config?: LangChainOrchestrationModuleConfig;
    langchainOptions?: ModelOptions;
}
interface SapAICoreProviderOptions {
    chatModels?: Record<string, SapAICoreModelEntry>;
    defaultChatModel?: string;
}

declare class ProviderRegistryError extends Error {
}
declare class ProviderNotFoundError extends ProviderRegistryError {
    constructor(provider: string);
}
declare class ModelNotFoundError extends ProviderRegistryError {
    constructor(provider: string, model: string, type: 'chat' | 'embedding');
}
declare class ProviderImportError extends ProviderRegistryError {
    constructor(provider: string, moduleName: string, cause?: unknown);
}

declare class ProviderRegistry {
    private readonly providers;
    registerProvider(name: string, definition: ProviderDefinition): this;
    hasProvider(name: string): boolean;
    listProviders(): string[];
    listChatModels(provider: string): string[];
    listEmbeddingModels(provider: string): string[];
    getChatModel(provider: string, model?: string, options?: ModelOptions): Promise<BaseChatModel>;
    getEmbeddingModel(provider: string, model?: string, options?: ModelOptions): Promise<EmbeddingsInterface>;
    useOpenAI(options?: BuiltInProviderOptions): this;
    useAnthropic(options?: BuiltInProviderOptions): this;
    useOllama(options?: BuiltInProviderOptions): this;
    useSapAICore(options?: SapAICoreProviderOptions): this;
    private getProvider;
    private static normalizeName;
}

interface Telemetry {
    getCallbacks(): Callbacks | undefined;
    onRunComplete?(result: AgentResult): Promise<void> | void;
}
declare class NullTelemetry implements Telemetry {
    getCallbacks(): undefined;
}

interface ThreadMessage {
    role: string;
    content: unknown;
    toolCallId?: string;
    name?: string;
    metadata?: Record<string, unknown>;
}
interface ThreadSnapshot {
    threadId: string;
    messages: ThreadMessage[];
    metadata?: Record<string, unknown>;
    updatedAt: number;
}
interface ThreadStore {
    read(threadId: string): Promise<ThreadSnapshot | undefined>;
    write(snapshot: ThreadSnapshot): Promise<void>;
    delete(threadId: string): Promise<void>;
    list(): Promise<ThreadSnapshot[]>;
    clear(): Promise<void>;
}
declare function createSnapshot(params: {
    threadId: string;
    messages: ThreadMessage[];
    metadata?: Record<string, unknown>;
    updatedAt?: number;
}): ThreadSnapshot;

interface ChooseModelParams {
    provider: string;
    chatModel?: string;
    options?: ModelOptions;
}
interface AgentRunOptions {
    query: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
    configurable?: Record<string, unknown>;
}
interface AgentResult {
    runId: string;
    threadId: string;
    durationMs: number;
    messages: ThreadMessage[];
    response?: unknown;
    raw: unknown;
}
interface AgentOptions {
    registry: ProviderRegistry;
    telemetry?: Telemetry;
    threadStore?: ThreadStore;
    checkpointer?: BaseCheckpointSaver;
    defaultPrompt?: string;
}
declare class Agent {
    private prompt;
    private tools;
    private selectedModel?;
    private agentRunnable?;
    private readonly checkpointer;
    private readonly telemetry?;
    private readonly threadStore?;
    private readonly registry;
    private dirty;
    constructor(options: AgentOptions);
    setPrompt(prompt: string): void;
    bindTools(tools: readonly unknown[]): void;
    chooseModel(params: ChooseModelParams): Promise<void>;
    run(options: AgentRunOptions): Promise<AgentResult>;
    getThreadHistory(threadId: string): Promise<ThreadSnapshot | undefined>;
    private ensureAgent;
    private extractMessagesFromResult;
    private extractMessagesFromCheckpoint;
    private normalizeMessages;
    private extractResponse;
    private generateId;
}

type AnyAnnotationRoot = AnnotationRoot<any>;//# sourceMappingURL=types.d.ts.map

interface BuildAgentParams {
    model: BaseChatModel;
    tools?: readonly unknown[];
    systemPrompt?: string;
    checkpointer?: BaseCheckpointSaver;
}
declare function buildAgent(params: BuildAgentParams): langchain.ReactAgent<langchain.ResponseFormatUndefined, undefined, AnyAnnotationRoot, readonly langchain.AgentMiddleware<any, any, any>[]>;

interface LangfuseTelemetryOptions {
    /** Optional user identifier to attach to traces. */
    userId?: string;
    /** Optional session identifier to group traces. */
    sessionId?: string;
    /** Optional tags forwarded to Langfuse. */
    tags?: string[];
    /** Optional version of the application emitting traces. */
    version?: string;
    /** Additional metadata stored alongside each trace. */
    traceMetadata?: Record<string, unknown>;
    /** When true, call `flush` on the handler after each run (useful in short-lived scripts). */
    flushOnComplete?: boolean;
}
declare class LangfuseTelemetry implements Telemetry {
    private readonly handler;
    private readonly flushOnComplete;
    constructor(options?: LangfuseTelemetryOptions);
    getCallbacks(): Callbacks;
    onRunComplete(): Promise<void>;
}

interface LangSmithTelemetryOptions extends LangChainTracerFields {
    /**
     * Flush spans to LangSmith after each run. This is mainly useful in short-lived
     * scripts (such as tests) where the Node.js process may exit immediately.
     */
    flushOnComplete?: boolean;
}
declare class LangSmithTelemetry implements Telemetry {
    private readonly tracer;
    private readonly flushOnComplete;
    constructor(options?: LangSmithTelemetryOptions);
    getCallbacks(): Callbacks;
    onRunComplete(): Promise<void>;
}

declare class InMemoryThreadStore implements ThreadStore {
    private readonly store;
    read(threadId: string): Promise<ThreadSnapshot | undefined>;
    write(snapshot: ThreadSnapshot): Promise<void>;
    delete(threadId: string): Promise<void>;
    list(): Promise<ThreadSnapshot[]>;
    clear(): Promise<void>;
}

interface LocalStorageThreadStoreOptions {
    prefix?: string;
    storage?: Storage;
}
declare class LocalStorageThreadStore implements ThreadStore {
    private readonly prefix;
    private readonly storage;
    constructor(options?: LocalStorageThreadStoreOptions);
    read(threadId: string): Promise<ThreadSnapshot | undefined>;
    write(snapshot: ThreadSnapshot): Promise<void>;
    delete(threadId: string): Promise<void>;
    list(): Promise<ThreadSnapshot[]>;
    clear(): Promise<void>;
    private key;
    private safeParse;
}

interface IndexedDBThreadStoreOptions {
    dbName?: string;
    storeName?: string;
}
declare class IndexedDBThreadStore implements ThreadStore {
    private readonly dbName;
    private readonly storeName;
    private dbPromise?;
    constructor(options?: IndexedDBThreadStoreOptions);
    read(threadId: string): Promise<ThreadSnapshot | undefined>;
    write(snapshot: ThreadSnapshot): Promise<void>;
    delete(threadId: string): Promise<void>;
    list(): Promise<ThreadSnapshot[]>;
    clear(): Promise<void>;
    private openDb;
}

interface FsThreadStoreOptions {
    directory: string;
    fileExtension?: string;
}
declare class FsThreadStore implements ThreadStore {
    private readonly directory;
    private readonly extension;
    private fsModule?;
    private pathModule?;
    private initPromise?;
    constructor(options: FsThreadStoreOptions);
    read(threadId: string): Promise<ThreadSnapshot | undefined>;
    write(snapshot: ThreadSnapshot): Promise<void>;
    delete(threadId: string): Promise<void>;
    list(): Promise<ThreadSnapshot[]>;
    clear(): Promise<void>;
    private loadNodeModules;
    private ensureDirectory;
    private filePath;
    private isNotFoundError;
    private isEexistError;
    private hasCode;
}

export { Agent, type AgentOptions, type AgentResult, type AgentRunOptions, type BuildAgentParams, type BuiltInProviderModelMap, type BuiltInProviderOptions, type ChatModelFactory, type ChooseModelParams, type EmbeddingModelFactory, FsThreadStore, type FsThreadStoreOptions, InMemoryThreadStore, IndexedDBThreadStore, type IndexedDBThreadStoreOptions, LangSmithTelemetry, type LangSmithTelemetryOptions, LangfuseTelemetry, type LangfuseTelemetryOptions, LocalStorageThreadStore, type LocalStorageThreadStoreOptions, ModelNotFoundError, type ModelOptions, NullTelemetry, ProviderImportError, ProviderNotFoundError, ProviderRegistry, ProviderRegistryError, type Telemetry, type ThreadMessage, type ThreadSnapshot, type ThreadStore, buildAgent, createSnapshot };
