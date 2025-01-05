import Log from '../Logging';
import { ProviderAPI } from '../BaseProvider';

export type CustomOpenAIConfig = {
    baseUrl: string;
    apiKey: string;
};

export class CustomOpenAIProvider extends ProviderAPI<CustomOpenAIConfig> {
    readonly isLocal = false;
    readonly name = 'CustomOpenAI';

    async setup(config: CustomOpenAIConfig): Promise<boolean> {
        const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
        this.connectionConfig = { ...config, baseUrl };
        this.isSetupComplete = (await this.getModels()).length > 0;
        if (!this.isSetupComplete) Log.debug('OpenAI is not running');
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch(`${this.connectionConfig.baseUrl}api/models`, {
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
