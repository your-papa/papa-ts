import Log, { LogLvl } from './Logging';
import { ProviderRegistry } from './ProviderRegistry/ProviderRegistry';
import { BaseAssistant, PipeInput } from './AssistantFactory/BaseAssistant';
import { GeneralAssistant } from './AssistantFactory/Assistants/General';

export type PapaConfig = {
    debugging: {
        langsmithApiKey?: string;
        logLvl?: LogLvl;
    };
};

export class Papa {
    providerRegistry: ProviderRegistry;
    private assistant?: BaseAssistant;
    private langsmithApiKey?: string;

    constructor(config: PapaConfig) {
        Log.setLogLevel(config.debugging?.logLvl ?? LogLvl.INFO);
        Log.info('Initializing...');
        this.providerRegistry = new ProviderRegistry();
        this.langsmithApiKey = config.debugging.langsmithApiKey;
    }

    generateTitle(input: PipeInput) {
        const assistant = new GeneralAssistant(this.providerRegistry, { lang: 'en' }, this.langsmithApiKey);
        return assistant.generateTitleFromInitialMessage(input);
    }

    run(input: PipeInput) {
        Log.info('Running... Input:', input);
        const assistant = new GeneralAssistant(this.providerRegistry, { lang: 'en' }, this.langsmithApiKey);
        return assistant.run(input);
    }
}
