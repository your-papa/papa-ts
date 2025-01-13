import Log, { LogLvl } from './Logging';
import { ProviderRegistry, ProviderRegistryConfig } from './ProviderRegistry/ProviderRegistry';
import { BaseAssistant, PipeInput } from './AssistantFactory/BaseAssistant';
import { createAssistant, Assistant, AssistantConfigType } from './AssistantFactory/AssistantFactory';

export type PapaConfig<T extends Assistant> = {
    providers: Partial<ProviderRegistryConfig>;
    assistant?: { type: T; config: AssistantConfigType<T> };
    debugging?: {
        langsmithApiKey?: string;
        logLvl?: LogLvl;
    };
};

export class Papa {
    private providerRegistry: ProviderRegistry;
    private assistant?: BaseAssistant;
    private langsmithApiKey?: string;

    private constructor(providerRegistry: ProviderRegistry, assistant?: BaseAssistant, langsmithApiKey?: string) {
        this.providerRegistry = providerRegistry;
        this.assistant = assistant;
        this.langsmithApiKey = langsmithApiKey;
    }

    static async init<T extends Assistant>(config: PapaConfig<T>) {
        Log.setLogLevel(config.debugging?.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        const providerRegistry = new ProviderRegistry();
        await providerRegistry.configure(config.providers);
        const assistant = config.assistant
            ? await createAssistant(providerRegistry, config.assistant.type, config.assistant.config, config.debugging?.langsmithApiKey)
            : undefined;
        return new Papa(providerRegistry, assistant, config.debugging?.langsmithApiKey);
    }

    getProviderRegistry() {
        return this.providerRegistry;
    }

    getAssistant() {
        return this.assistant;
    }

    async setAssistant<T extends Assistant>(assistant: T, config: AssistantConfigType<T>) {
        this.assistant = await createAssistant(this.providerRegistry, assistant, config, this.langsmithApiKey);
    }

    run(input: PipeInput) {
        if (!this.assistant) throw new Error('Assistant is not set.');
        Log.info('Running... Input:', input);
        return this.assistant.run(input);
    }

    stopRun() {
        if (!this.assistant) throw new Error('Assistant is not set.');
        Log.info('Stopping run...');
        this.assistant.stopRun();
    }
}
