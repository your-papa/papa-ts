import Log from '../Logging';
import { EmbedModel, GenModel } from '../Models';
import { BaseProvider, ProviderSettings } from './BaseProvider';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export const OPENAIDEFAULT: ProviderSettings<OpenAISettings> = {
    connectionArgs: {
        apiKey: '',
    },
    selectedEmbedModel: 'text-embedding-3-large',
    selectedGenModel: 'gpt-4o-mini',
    embedModels: {
        'text-embedding-ada-002': { similarityThreshold: 0.75 },
        'text-embedding-3-large': { similarityThreshold: 0.5 },
        'text-embedding-3-small': { similarityThreshold: 0.5 },
    },
    genModels: {
        'gpt-3.5-turbo': { temperature: 0.5, contextWindow: 16385 },
        'gpt-4': { temperature: 0.5, contextWindow: 8192 },
        'gpt-4-32k': { temperature: 0.5, contextWindow: 32768 },
        'gpt-4-turbo-preview': { temperature: 0.5, contextWindow: 128000 },
        'gpt-4o-mini': { temperature: 0.5, contextWindow: 8192 },
    },
};

export type OpenAISettings = {
    apiKey: string;
};

export class OpenAIProvider extends BaseProvider<OpenAISettings> {
    readonly isLocal = false;

    constructor(openAIKwargs: ProviderSettings<OpenAISettings>) {
        super();
        Object.assign(this, openAIKwargs);
    }

    async isSetuped(): Promise<boolean> {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.connectionArgs.apiKey}`,
                },
            });
            return response.status === 200;
        } catch (error) {
            Log.debug('notice.openai_key');
            return false;
        }
    }

    async getModels(): Promise<string[]> {
        try {
            const modelRes = await fetch(`https://api.openai.com/v1/models`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.connectionArgs.apiKey}`,
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

    createEmbedModel(k: number): EmbedModel {
        const langChainModel = new OpenAIEmbeddings({ openAIApiKey: this.connectionArgs.apiKey, modelName: this.selectedEmbedModel, batchSize: 2048 });
        return { lcModel: langChainModel, similarityThreshold: this.embedModels[this.selectedEmbedModel].similarityThreshold, k };
    }

    createGenModel(): GenModel {
        const langChainModel = new ChatOpenAI({
            openAIApiKey: this.connectionArgs.apiKey,
            modelName: this.selectedGenModel,
            temperature: this.genModels[this.selectedGenModel].temperature,
            streaming: true,
        });
        return { lcModel: langChainModel, contextWindow: this.genModels[this.selectedGenModel].contextWindow };
    }
}
