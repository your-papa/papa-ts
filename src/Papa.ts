import Log, { LogLvl } from './Logging';
import { ProviderRegistry, ProviderRegistryConfig, RegisteredProvider } from './ProviderRegistry/ProviderRegistry';
import { BaseAssistant, PipeInput } from './Assistant/BaseAssistant';
import { createAssistant, Assistant, AssistantConfig } from './Assistant/AssistantFactory';

export interface PapaConfig {
    providers: Partial<ProviderRegistryConfig>;
    assistant: Assistant;
    assistantConfig: AssistantConfig;
    logLvl?: LogLvl;
}

export class Papa {
    private providerRegistry: ProviderRegistry;
    private assistant: BaseAssistant;

    private constructor(providerRegistry: ProviderRegistry, assistant: BaseAssistant) {
        this.providerRegistry = providerRegistry;
        this.assistant = assistant;
    }

    static async init(config: PapaConfig) {
        Log.setLogLevel(config.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        const providerRegistry = new ProviderRegistry();
        await providerRegistry.configure(config.providers);
        return new Papa(providerRegistry, await createAssistant(config.assistant, config.assistantConfig));
    }

    getProvider(providerName: RegisteredProvider) {
        return this.providerRegistry.getProvider(providerName);
    }

    getAssistant() {
        return this.assistant;
    }

    async setAssistant(assistant: Assistant, config: AssistantConfig) {
        this.assistant = await createAssistant(assistant, config);
    }

    run(input: PipeInput) {
        Log.info('Running RAG... Input:', input);
        this.assistant?.run(input);
    }

    stopRun() {
        Log.info('Stopping run...');
        this.assistant?.stopRun();
    }
}
