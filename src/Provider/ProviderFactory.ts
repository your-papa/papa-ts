import { BaseProvider, ProviderSettings } from './BaseProvider';
import { OpenAIProvider, OpenAISettings } from './OpenAI';
import { OllamaProvider, OllamaSettings } from './Ollama';

type Settings = OpenAISettings | OllamaSettings;

export function providerFactory(provider: string, args: ProviderSettings<Settings>): BaseProvider<Settings> {
    if (provider === 'OpenAI') {
        return new OpenAIProvider(args as ProviderSettings<OpenAISettings>);
    } else if (provider === 'Ollama') {
        return new OllamaProvider(args as ProviderSettings<OllamaSettings>);
    } else {
        throw new Error('Provider not found');
    }
}

export class EmbedProvider {
    constructor(private provider: BaseProvider<Settings>) {}

    async getModels(): Promise<string[]> {
        const models = await this.provider.getModels();
        const embedModels = this.provider.getEmbedModels();
        return models.filter((model) => model in embedModels);
    }
    getSelectedModel(): string {
        return this.provider.getSelEmbedModel();
    }

    async isSetuped(): Promise<boolean> {
        return this.provider.isSetuped();
    }

    setSelectedModel(model: string) {
        this.provider.setSelEmbedModel(model);
    }
}

export class GenProvider {
    constructor(private provider: BaseProvider<Settings>) {}
    async getModels() {
        const models = await this.provider.getModels();
        const genModels = this.provider.getGenModels();
        return models.filter((model) => model in genModels);
    }
    getSelectedModel(): string {
        return this.provider.getSelGenModel();
    }

    async isSetuped(): Promise<boolean> {
        return this.provider.isSetuped();
    }

    setSelectedModel(model: string) {
        this.provider.setSelGenModel(model);
    }
}
