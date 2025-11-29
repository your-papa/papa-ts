export {
    ProviderRegistry,
    ProviderRegistryError,
    ProviderNotFoundError,
    ModelNotFoundError,
    ProviderImportError,
    type BuiltInProviderModelMap,
    type BuiltInProviderOptions,
    type ChatModelFactory,
    type EmbeddingModelFactory,
    type ModelOptions,
} from './providers/ProviderRegistry';

// Re-export LangChain's tool helper so consumers don't need to depend on
// @langchain/core directly when defining tools for papa-ts agents.
// This keeps the public API small while avoiding an extra direct dependency
// in downstream projects.
export { tool } from '@langchain/core/tools';

export {
    Agent,
    type AgentRunOptions,
    type AgentResult,
    type AgentOptions,
    type AgentStreamOptions,
    type AgentStreamChunk,
    type ChooseModelParams,
    type ThreadHistory,
} from './agent/Agent';
export { buildAgent, type BuildAgentParams } from './agent/build';

export {
    NullTelemetry,
    type Telemetry,
} from './telemetry/Telemetry';
export { LangfuseTelemetry, type LangfuseTelemetryOptions } from './telemetry/LangfuseTelemetry';
export { LangSmithTelemetry, type LangSmithTelemetryOptions } from './telemetry/LangsmithTelemetry';

export {
    createSnapshot,
    type ThreadStore,
    type ThreadMessage,
    type ThreadSnapshot,
    type ThreadSnapshotInit,
} from './memory/ThreadStore';
export { InMemoryThreadStore } from './memory/InMemoryThreadStore';
export { LocalStorageThreadStore, type LocalStorageThreadStoreOptions } from './memory/LocalStorageThreadStore';
export { IndexedDBThreadStore, type IndexedDBThreadStoreOptions } from './memory/IndexedDBThreadStore';
export { FsThreadStore, type FsThreadStoreOptions } from './memory/FsThreadStore';

export {
    LocalStorageCheckpointSaver,
    type LocalStorageCheckpointSaverOptions,
} from './checkpoint/LocalStorageCheckpointSaver';

