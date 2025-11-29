## Changelog

All notable changes to `papa-ts` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2025-11-29

### Added

- **Thread message normalization**: Introduced a canonical `ThreadMessage` schema and helper utilities (`normalizeThreadMessages`, `getMessageText`) that flatten LangChain constructors (chunks, tool calls, metadata) into a stable, client-friendly shape.

### Changed

- `Agent` now emits/hydrates normalized messages everywhere (results, history, metadata previews), ensuring consistent roles/timestamps/tool-call surfaces regardless of the underlying checkpoint format.

## [2.3.0] - 2025-11-29

### Breaking

- **ThreadStore metadata-only contract**: `ThreadSnapshot` no longer contains `messages`. All thread stores (in-memory, FS, IndexedDB, localStorage) now persist only thread metadata (`threadId`, `title`, timestamps, custom metadata). Consumers should rely on LangGraph checkpoint savers for conversation history.
- **Thread history API**: `Agent.getThreadHistory()` now returns a `ThreadHistory` object that merges thread metadata with messages loaded from the configured checkpointer. Downstream code should update type references accordingly.

### Added

- **LocalStorageCheckpointSaver**: New `LocalStorageCheckpointSaver` implementation lets browser environments persist LangGraph checkpoints and pending writes using `localStorage`. Exported via the public API and wired into the browser example.
- **Enhanced metadata helpers**: `createSnapshot` now normalizes metadata/timestamps on input, simplifying upgrades from previous formats.

### Changed

- **Agent persistence flow**: The agent now writes only metadata (last run id, model, message preview/role) to the configured `ThreadStore` while leaving messages to the checkpoint saver. Fetching history automatically stitches checkpoint messages with stored metadata.
- **Thread store implementations/tests**: Updated file system, IndexedDB, localStorage, and in-memory stores plus tests and examples to the metadata-only model to avoid mismatches and lost `role` fields.

## [2.2.0] - 2025-11-29

### Breaking

- **Async provider registration**: `ProviderRegistry.registerProvider()` and `useOpenAI()/useAnthropic()/useOllama()/useSapAICore()` now return promises so they can await dynamic model discovery. Callers must `await` these methods before choosing models.

### Added

- **Dynamic model discovery**: Built-in providers now query their respective APIs (OpenAI, Anthropic, Ollama, SAP AI Core) to list available chat/embedding models instead of relying on hard-coded defaults. Override the discovery by passing explicit `chatModels` / `embeddingModels` if needed.

### Changed

- **Provider configuration surface**: Extended provider options to accept API keys, base URLs, headers, API versions, and custom `fetch` implementations to support discovery across environments.
- **Examples/tests**: Updated sample scripts, LangGraph graph, and tests to await provider registration and showcase the new behavior.

---

## [2.1.0] - 2025-11-29

### Added

- **Agent token streaming**: Expose `Agent.streamTokens()` so clients can display live model tokens (with optional raw events) while still receiving the final `AgentResult`.
- **Node streaming example**: Add `examples/node/streaming.ts`, a runnable script that prints live tokens using the new streaming API.

---

## [2.0.3] - 2025-11-29

### Added

- **Static LangChain provider imports**: Promote `@langchain/openai`, `@langchain/anthropic`, `@langchain/ollama`, and `@sap-ai-sdk/langchain` to direct, statically imported dependencies so bundlers (including Obsidian) always include them without dynamic `import()` fallbacks.
- **Dynamic loader removal**: Drop the bespoke `dynamicImport` helper for simpler, more reliable provider initialization across runtimes.

---

## [2.0.2] - 2025-11-29

### Added

- **Tool helper re-export**: Re-export LangChain's `tool` helper from the main `papa-ts` entrypoint so downstream consumers can define tools without importing `@langchain/core` directly.

---

## [2.0.1] - 2025-11-29

### Added

- **SAP AI Core embedding support**: Add default embedding models and factories for SAP AI Core via `@sap-ai-sdk/langchain`.

### Changed

- **SAP AI Core chat integration**: Migrate to `AzureOpenAiChatClient` / `AzureOpenAiEmbeddingClient` usage for a more direct and flexible integration.
- **Node example**: Update `examples/node/tools.ts` to demonstrate using SAP AI Core as the provider (with `gpt-5`) instead of OpenAI as the default.

---

## [2.0.0] - 2025-11-20

### Breaking Changes

- **Complete architecture rewrite**: The assistant backend has been rewritten from scratch to support the new v2 architecture.
- **Provider management**: Provider setup and configuration flow has changed; existing integrations will likely need configuration updates.

### Added

- **Agentic assistant**: New `Agent` abstraction and agentic assistant implementation.
- **Improved provider registry**: Centralized `ProviderRegistry` for managing OpenAI, Anthropic, Ollama, SAP AI Core and other providers.
- **Telemetry integrations**: LangSmith and Langfuse telemetry helpers for tracing and observability.
- **Better configuration handling**: Enhanced model and provider configuration types, including support for new API keys and environment variables.

### Changed

- **Project structure**: Source code reorganized under `src/agent`, `src/providers`, `src/memory`, and `src/telemetry`.
- **Build output**: Library is now built via `tsup` targeting both ESM and CJS with bundled type definitions.
- **Testing setup**: Tests migrated to `vitest` with improved test utilities.

### Fixed

- **Environment handling**: More robust handling of environment variables for provider API keys.

---

## [0.5.x] - 2024-xx-xx

Pre-v2 series with the original architecture and provider implementations.


