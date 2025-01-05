import Log from '../Logging';
import { ProviderAPI } from './BaseProvider';

export type AnthropicConfig = {
    apiKey: string;
};

export class AnthropicProvider extends ProviderAPI<AnthropicConfig> {
    readonly isLocal = false;

    async setup(config: AnthropicConfig): Promise<boolean> {
        this.connectionConfig = config;
        try {
            const response = await fetch('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    "x-api-key": `${this.connectionConfig.apiKey}`,
                    "anthropic-version": "2023-06-01"
                },
            });
            this.isSetupComplete = response.status === 200;
        } catch (error) {
            Log.debug('notice.anthropic_key');
            this.isSetupComplete = false;
        }
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch(`https://api.anthropic.com/v1/models`, {
                method: 'GET',
                headers: {
                    "x-api-key": `${this.connectionConfig.apiKey}`,
                    "anthropic-version": "2023-06-01"
                },
            });
            const modelJson = await modelRes.json();
            const modelData = modelJson.data;
            return modelData.map((model: any) => model.id);
        } catch (error) {
            Log.debug('Anthropic is not running', error);
            return [];
        }
    }
}