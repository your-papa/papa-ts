import { ProviderAPI } from '../BaseProvider';
import Log from '../../Logging';

export type OllamaConfig = {
    baseUrl: string;
};
export class OllamaProvider extends ProviderAPI<OllamaConfig> {
    readonly isLocal = true;
    readonly name = 'Ollama';

    async setup(config: OllamaConfig): Promise<boolean> {
        this.connectionConfig = config;
        try {
            new URL(this.connectionConfig.baseUrl);
            const response = await fetch(this.connectionConfig.baseUrl + '/api/tags');
            if (response.status === 200) {
                this.isSetupComplete = true;
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

    setConnectionConfig(connectionArgs: OllamaConfig): { connectionArgs: OllamaConfig } {
        let baseUrl = connectionArgs.baseUrl;
        baseUrl.trim();
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        this.connectionConfig.baseUrl = baseUrl;
        return { connectionArgs: this.connectionConfig };
        // papaState.set('settings-change');
    }

    async getModels(): Promise<string[]> {
        try {
            const modelsRes = await fetch(this.connectionConfig.baseUrl + '/api/tags');
            const modelsData = await modelsRes.json();
            const models: string[] = modelsData.map((model: { name: string }) => model.name);
            return models.map((model: string) => model.replace(':latest', ''));
        } catch (error) {
            Log.error('Ollama is not running', error);
            return [];
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
