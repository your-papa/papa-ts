## Changelog

All notable changes to `papa-ts` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.3] - 2025-11-29

### Changed

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


