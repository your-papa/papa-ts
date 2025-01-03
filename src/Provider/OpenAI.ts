import Log from '../Logging';
import { ProviderAPI } from './BaseProvider';

export type OpenAIConfig = {
    apiKey: string;
};

export class OpenAIProvider extends ProviderAPI<OpenAIConfig> {
    readonly isLocal = false;

    async setup(config: OpenAIConfig): Promise<boolean> {
        this.connectionConfig = config;
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.connectionConfig.apiKey}`,
                },
            });
            this.isSetupComplete = response.status === 200;
        } catch (error) {
            Log.debug('notice.openai_key');
            this.isSetupComplete = false;
        }
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch(`https://api.openai.com/v1/models`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.connectionConfig.apiKey}`,
                },
            });
            const modelJson = await modelRes.json();
            const modelData = modelJson.data;
            return modelData.map((model: any) => model.id);
        } catch (error) {
            Log.debug('OpenAI is not running', error);
            return [];
        }
    }
}
