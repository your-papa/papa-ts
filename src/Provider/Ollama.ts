import { BaseProvider, type EmbedModelSettings, type GenModelSettings, type EmbedModels, type GenModels, ProviderSettings } from './BaseProvider';
import Log from '../Logging';
import { EmbedModel, GenModel } from '../Models';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { ChatOllama } from '@langchain/community/chat_models/ollama';

export const OLLAMADEFAULT: ProviderSettings<OllamaSettings> = {
    connectionArgs: {
        baseUrl: 'https://localhost:11434',
    },
    selectedEmbedModel: 'mxbai-embed-large',
    selectedGenModel: 'llama2',
    embedModels: {
        'nomic-embed-text': { similarityThreshold: 0.5 },
        'mxbai-embed-large': { similarityThreshold: 0.5 },
    },
    genModels: {
        llama2: { temperature: 0.5, contextWindow: 4096 },
        'llama2-uncensored': { temperature: 0.5, contextWindow: 4096 },
        mistral: { temperature: 0.5, contextWindow: 8000 },
        'mistral-openorca': { temperature: 0.5, contextWindow: 8000 },
        gemma: { temperature: 0.5, contextWindow: 8000 },
        mixtral: { temperature: 0.5, contextWindow: 32000 },
        'dolphin-mixtral': { temperature: 0.5, contextWindow: 32000 },
        phi: { temperature: 0.5, contextWindow: 2048 },
    },
};

export type OllamaSettings = {
    baseUrl: string;
};

export class OllamaProvider extends BaseProvider<OllamaSettings> {
    readonly isLocal = true;

    constructor(ollamaKwargs: ProviderSettings<OllamaSettings>) {
        super();
        Object.assign(this, ollamaKwargs);
    }

    async isSetuped(): Promise<boolean> {
        try {
            new URL(this.connectionArgs.baseUrl);
            const response = await fetch(this.connectionArgs.baseUrl + '/api/tags');
            if (response.status === 200) {
                return true;
            } else {
                Log.debug(`Unexpected status code: ${response.status}`);
                // errorState.set('ollama-not-running');
                return false;
            }
        } catch (error) {
            Log.debug('Ollama is not running or origins not correctly set', error);
            // errorState.set('ollama-not-running');
            return false;
        }
    }

    setConnectionArgs(connectionArgs: OllamaSettings): { connectionArgs: OllamaSettings } {
        let baseUrl = connectionArgs.baseUrl;
        baseUrl.trim();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        this.connectionArgs.baseUrl = baseUrl;
        return { connectionArgs: this.connectionArgs };
        // papaState.set('settings-change');
    }

    async getModels(): Promise<string[]> {
        try {
            const modelsRes = await fetch(this.connectionArgs.baseUrl + '/api/tags');
            const modelsData = await modelsRes.json();
            const models: string[] = modelsData.map((model: { name: string }) => model.name);
            return models.map((model: string) => model.replace(':latest', ''));
        } catch (error) {
            Log.debug('Ollama is not running', error);
            return [];
        }
    }

    createEmbedModel(k: number): EmbedModel {
        const langchainEmbedModel = new OllamaEmbeddings({ baseUrl: this.connectionArgs.baseUrl, model: this.selectedEmbedModel });
        return { lcModel: langchainEmbedModel, similarityThreshold: this.embedModels[this.selectedEmbedModel].similarityThreshold, k: k };
    }

    createGenModel(): GenModel {
        const langchainGenModel = new ChatOllama({
            baseUrl: this.connectionArgs.baseUrl,
            model: this.selectedGenModel,
            temperature: this.genModels[this.selectedGenModel].temperature,
        });
        return { lcModel: langchainGenModel, contextWindow: this.genModels[this.selectedGenModel].contextWindow };
    }

    async deleteOllamaModel(model: string): Promise<boolean> {
        try {
            const modelsRes = await fetch(`${this.connectionArgs.baseUrl}/api/pull`);
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
            const response = await fetch(`${this.connectionArgs.baseUrl}/api/pull`, {
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
