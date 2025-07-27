import { IEmbedProvider, IGenProvider, ProviderAPI } from '../BaseProvider';
import Log from '../../Logging';
import { OllamaEmbeddings } from '@langchain/ollama';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';
import { GenModelConfig } from '../GenProvider';

export type OllamaConfig = {
    baseUrl: string;
};

export class OllamaProvider
    extends ProviderAPI<OllamaConfig>
    implements IGenProvider<OllamaConfig, ChatOllama>, IEmbedProvider<OllamaConfig, OllamaEmbeddings>
{
    readonly isLocal = true;
    readonly name = 'Ollama';
    #genLCInstance: ChatOllama | null = null;
    #embedLCInstance!: OllamaEmbeddings;

    async setup(config: OllamaConfig): Promise<boolean> {
        this.connectionConfig = config;
        try {
            new URL(this.connectionConfig.baseUrl);
            const response = await fetch(this.connectionConfig.baseUrl + '/api/tags');
            if (response.status === 200) {
                this.isSetupComplete = true;
                // Configure LC instances with new config
                this.configureGenInstance(this.connectionConfig);
                this.configureEmbedInstance(this.connectionConfig);
            } else {
                Log.error(`Unexpected status code: ${response.status}`);
                // errorState.set('ollama-not-running');
                this.isSetupComplete = false;
            }
        } catch (error) {
            Log.error('Ollama is not running or origins not correctly set', error);
            // errorState.set('ollama-not-running');
            this.isSetupComplete = false;
        }
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelsRes = await fetch(this.connectionConfig.baseUrl + '/api/tags');
            const data = await modelsRes.json();
            const modelsData = data.models;
            const models: string[] = modelsData.map((model: { name: string }) => model.name);
            return models.map((model: string) => model.replace(':latest', ''));
        } catch (error) {
            Log.error('Ollama is not running', error);
            return [];
        }
    }

    configureGenInstance(config: OllamaConfig): void {
        if (!this.#genLCInstance) {
            this.#genLCInstance = new ChatOllama({ ...config });
            return;
        }
        Object.assign(this.#genLCInstance, config);
    }

    configureEmbedInstance(config: OllamaConfig): void {
        if (!this.#embedLCInstance) {
            this.#embedLCInstance = new OllamaEmbeddings({ ...config });
            return;
        }
        Object.assign(this.#embedLCInstance, config);
    }

    getGenLCInstance(modelName: string, genModelConfig: GenModelConfig): ChatOllama {
        if (!this.#genLCInstance) {
            throw new Error('Provider not set up. Call setup() first.');
        }

        try {
            // Only update if model changed
            if (this.#genLCInstance.model !== modelName) {
                this.#genLCInstance.model = modelName;
                this.#genLCInstance.temperature = genModelConfig.temperature;
            }
            return this.#genLCInstance;
        } catch (error) {
            Log.error(`Error setting model ${modelName} for Ollama gen instance:`, error);
            throw new Error(`Model ${modelName} not available or invalid`);
        }
    }

    getEmbedLCInstance(modelName: string): OllamaEmbeddings {
        if (!this.#embedLCInstance) {
            throw new Error('Provider not set up. Call setup() first.');
        }

        try {
            // Only update if model changed
            if (this.#embedLCInstance.model !== modelName) {
                this.#embedLCInstance.model = modelName;
            }
            return this.#embedLCInstance;
        } catch (error) {
            Log.error(`Error setting model ${modelName} for Ollama embed instance:`, error);
            throw new Error(`Model ${modelName} not available or invalid`);
        }
    }

    async deleteOllamaModel(model: string): Promise<boolean> {
        try {
            const modelsRes = await fetch(`${this.connectionConfig.baseUrl}/api/pull`);
            if (modelsRes.status === 404) {
                Log.debug('No models installed');
                return false;
            } else if (modelsRes.status === 200) {
                Log.debug('Model deleted');
                return true;
            }
            return false;
        } catch (error) {
            Log.debug('Ollama is not running', error);
            return false;
        }
    }

    async *pullOllamaModel(model: string, abortController: AbortController) {
        Log.info('Pulling model from Ollama', model);
        try {
            const response = await fetch(`${this.connectionConfig.baseUrl}/api/pull`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ name: model }),
                signal: abortController.signal,
            });

            if (!response.ok || response.body == null) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break; // Exit the loop when no more data

                const chunkText = decoder.decode(value, { stream: true });
                buffer += chunkText;

                // Process buffer if it contains line-delimited JSON objects
                const lines = buffer.split('\n');
                buffer = lines.pop()!; // Keep the last partial line in the buffer

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const json = JSON.parse(line);
                            yield json; // Yield parsed JSON
                        } catch (error) {
                            yield { error: 'Failed to parse line', line };
                        }
                    }
                }
            }
        } catch (error) {
            if (abortController.signal.aborted) {
                Log.debug('Stream was aborted');
            } else {
                yield { error: error }; // Yield error if not aborted
            }
        }
    }
}
