export class ProviderRegistryError extends Error { }

export class ProviderNotFoundError extends ProviderRegistryError {
    constructor(provider: string) {
        super(`No provider registered with name "${provider}".`);
        this.name = 'ProviderNotFoundError';
    }
}

export class ModelNotFoundError extends ProviderRegistryError {
    constructor(provider: string, model: string, type: 'chat' | 'embedding') {
        super(`Model "${model}" not found for ${type} models in provider "${provider}".`);
        this.name = 'ModelNotFoundError';
    }
}

export class ProviderImportError extends ProviderRegistryError {
    constructor(provider: string, moduleName: string, cause?: unknown) {
        const hint = `Install the module with \`npm install ${moduleName}\` in the host application.`;
        const message = `Unable to load module "${moduleName}" for provider "${provider}". ${hint}`;
        super(message);
        this.name = 'ProviderImportError';
        if (cause instanceof Error) {
            this.stack = cause.stack;
        }
    }
}

