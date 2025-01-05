import Log from '../Logging';
import { ProviderAPI } from '../BaseProvider';

export type AnthropicConfig = {
    apiKey: string;
};

export class AnthropicProvider extends ProviderAPI<AnthropicConfig> {
    readonly isLocal = false;
    readonly name = 'Anthropic';

    async setup(config: AnthropicConfig): Promise<boolean> {
        this.connectionConfig = config;
        this.isSetupComplete = (await this.getModels()).length > 0;
        if (!this.isSetupComplete) Log.debug('Anthropic is not running');
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    "x-api-key": `${this.connectionConfig.apiKey}`,
                    "anthropic-version": "2023-06-01"
                },
            });
            if (!modelRes.ok) throw new Error('Failed to fetch models');
            const { data } = await modelRes.json();
            return data.map((model: any) => model.id);
        } catch (error) {
            Log.debug('Anthropic is not running', error);
            return [];
        }
    }
}
