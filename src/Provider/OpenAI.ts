import Log from '../Logging';
import { ProviderAPI } from '../BaseProvider';

export type OpenAIConfig = {
    apiKey: string;
};

export class OpenAIProvider extends ProviderAPI<OpenAIConfig> {
    readonly isLocal = false;
    readonly name = 'OpenAI';

    async setup(config: OpenAIConfig): Promise<boolean> {
        this.connectionConfig = config;
        this.isSetupComplete = (await this.getModels()).length > 0;
        if (!this.isSetupComplete) Log.debug('OpenAI is not running');
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.connectionConfig.apiKey}`,
                },
            });
            if (!modelRes.ok) throw new Error('Failed to fetch models');
            const { data } = await modelRes.json();
            return data.map((model: any) => model.id);
        } catch (error) {
            Log.debug('OpenAI is not running', error);
            return [];
        }
    }
}
