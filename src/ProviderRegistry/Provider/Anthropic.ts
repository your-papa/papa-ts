import Log from '../../Logging';
import { IGenProvider, ProviderAPI } from '../BaseProvider';
import { ChatAnthropic } from '@langchain/anthropic';

export type AnthropicConfig = {
    apiKey: string;
};

export class AnthropicProvider extends ProviderAPI<AnthropicConfig> implements IGenProvider<AnthropicConfig, ChatAnthropic> {
    readonly isLocal = false;
    readonly name = 'Anthropic';
    #genLCInstance: ChatAnthropic | null = null;

    async setup(config: AnthropicConfig): Promise<boolean> {
        this.connectionConfig = config;
        this.isSetupComplete = (await this.getModels()).length > 0;
        if (!this.isSetupComplete) Log.error('Anthropic API is not accessible. Please check your API key');
        else {
            // Configure LC instances with new config
            this.configureGenInstance(this.connectionConfig);
        }
        return this.isSetupComplete;
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch('https://api.anthropic.com/v1/models', {
                method: 'GET',
                headers: {
                    'x-api-key': `${this.connectionConfig.apiKey}`,
                    'anthropic-version': '2023-06-01',
                },
            });
            if (!modelRes.ok) throw new Error('Failed to fetch models');
            const { data } = await modelRes.json();
            return data.map((model: any) => model.id);
        } catch (error) {
            Log.error('Anthropic API is not accessible. Please check your API key', error);
            return [];
        }
    }

    configureGenInstance(config: AnthropicConfig): void {
        if (!this.#genLCInstance) {
            this.#genLCInstance = new ChatAnthropic({ ...config });
            return;
        }
        Object.assign(this.#genLCInstance, config);
    }

    getGenLCInstance(modelName: string): ChatAnthropic {
        if (!this.#genLCInstance) {
            throw new Error('Provider not set up. Call setup() first.');
        }

        try {
            // Only update if model changed
            if (this.#genLCInstance.model !== modelName) {
                this.#genLCInstance.model = modelName;
            }
            return this.#genLCInstance;
        } catch (error) {
            Log.error(`Error setting model ${modelName} for Anthropic gen instance:`, error);
            throw new Error(`Model ${modelName} not available or invalid`);
        }
    }
}
