import Log from '../../Logging';
import { IEmbedProvider, IGenProvider, ProviderAPI } from '../BaseProvider';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';

export type CustomOpenAIConfig = {
    baseUrl: string;
    apiKey: string;
};

export class CustomOpenAIProvider
    extends ProviderAPI<CustomOpenAIConfig>
    implements IGenProvider<CustomOpenAIConfig, ChatOpenAI>, IEmbedProvider<CustomOpenAIConfig, OpenAIEmbeddings>
{
    readonly isLocal = false;
    readonly name = 'CustomOpenAI';
    #genLCInstance: ChatOpenAI | null = null;
    #embedLCInstance: OpenAIEmbeddings | null = null;

    async setup(config: CustomOpenAIConfig): Promise<boolean> {
        const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
        this.connectionConfig = { ...config, baseUrl };
        this.isSetupComplete = (await this.getModels()).length > 0;
        if (!this.isSetupComplete) Log.error('Custom OpenAI API is not accessible. Please check your API key');
        else {
            // Configure LC instances with new config
            this.configureGenInstance(this.connectionConfig);
            this.configureEmbedInstance(this.connectionConfig);
        }
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
            Log.error('Custom OpenAI API is not accessible. Please check your API key', error);
            return [];
        }
    }

    configureGenInstance(config: CustomOpenAIConfig): void {
        if (!this.#genLCInstance) {
            this.#genLCInstance = new ChatOpenAI({
                openAIApiKey: config.apiKey,
                configuration: {
                    baseURL: config.baseUrl,
                },
            });
            return;
        }
        Object.assign(this.#genLCInstance, {
            openAIApiKey: config.apiKey,
            configuration: {
                baseURL: config.baseUrl,
            },
        });
    }

    configureEmbedInstance(config: CustomOpenAIConfig): void {
        if (!this.#embedLCInstance) {
            this.#embedLCInstance = new OpenAIEmbeddings({
                openAIApiKey: config.apiKey,
                configuration: {
                    baseURL: config.baseUrl,
                },
            });
            return;
        }
        Object.assign(this.#embedLCInstance, {
            openAIApiKey: config.apiKey,
            configuration: {
                baseURL: config.baseUrl,
            },
        });
    }

    getGenLCInstance(modelName: string): ChatOpenAI {
        if (!this.#genLCInstance) {
            throw new Error('Provider not set up. Call setup() first.');
        }

        try {
            // Only update if model changed
            if (this.#genLCInstance.modelName !== modelName) {
                this.#genLCInstance.modelName = modelName;
            }
            return this.#genLCInstance;
        } catch (error) {
            Log.error(`Error setting model ${modelName} for CustomOpenAI gen instance:`, error);
            throw new Error(`Model ${modelName} not available or invalid`);
        }
    }

    getEmbedLCInstance(modelName: string): OpenAIEmbeddings {
        if (!this.#embedLCInstance) {
            throw new Error('Provider not set up. Call setup() first.');
        }

        try {
            // Only update if model changed
            if (this.#embedLCInstance.modelName !== modelName) {
                this.#embedLCInstance.modelName = modelName;
            }
            return this.#embedLCInstance;
        } catch (error) {
            Log.error(`Error setting model ${modelName} for CustomOpenAI embed instance:`, error);
            throw new Error(`Model ${modelName} not available or invalid`);
        }
    }
}
