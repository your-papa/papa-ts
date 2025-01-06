import Log, { LogLvl } from './Logging';
import {
    ProviderRegistry,
    ProviderRegistryConfig,
    RegisteredEmbedProvider,
    RegisteredGenProvider,
    RegisteredProvider,
} from './ProviderRegistry/ProviderRegistry';
import { BaseAssistant, PipeInput } from './AssistantFactory/BaseAssistant';
import { createAssistant, Assistant, AssistantConfigType } from './AssistantFactory/AssistantFactory';

export type PapaConfig<T extends Assistant> = {
    providers: Partial<ProviderRegistryConfig>;
    assistant: T;
    assistantConfig: AssistantConfigType<T>;
    debugging?: {
        langsmithApiKey?: string;
        logLvl?: LogLvl;
    };
};

export class Papa {
    private providerRegistry: ProviderRegistry;
    private assistant: BaseAssistant;
    private langsmithApiKey?: string;

    private constructor(providerRegistry: ProviderRegistry, assistant: BaseAssistant, langsmithApiKey?: string) {
        this.providerRegistry = providerRegistry;
        this.assistant = assistant;
        this.langsmithApiKey = langsmithApiKey;
    }

    static async init<T extends Assistant>(config: PapaConfig<T>) {
        Log.setLogLevel(config.debugging?.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        const providerRegistry = new ProviderRegistry();
        await providerRegistry.configure(config.providers);
        const assistant = await createAssistant(providerRegistry, config.assistant, config.assistantConfig, config.debugging?.langsmithApiKey);
        return new Papa(providerRegistry, assistant);
    }

    getProvider(providerName: RegisteredProvider) {
        return this.providerRegistry.getProvider(providerName);
    }

    getGenProvider(providerName: RegisteredGenProvider) {
        return this.providerRegistry.getGenProvider(providerName);
    }
    getEmbedProvider(providerName: RegisteredEmbedProvider) {
        return this.providerRegistry.getEmbedProvider(providerName);
    }

    getAssistant() {
        return this.assistant;
    }

    async setAssistant<T extends Assistant>(assistant: T, config: AssistantConfigType<T>) {
        this.assistant = await createAssistant(this.providerRegistry, assistant, config, this.langsmithApiKey);
    }

    run(input: PipeInput) {
        Log.info('Running... Input:', input);
        return this.assistant.run(input);
    }

    stopRun() {
        Log.info('Stopping run...');
        this.assistant.stopRun();
    }
}
