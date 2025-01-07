import { test, expect, beforeEach, jest } from '@jest/globals';
import { ProviderRegistry, ProviderRegistryConfig, RegisteredProvider } from '../src/ProviderRegistry/ProviderRegistry';
import { OpenAIProvider } from '../src/ProviderRegistry/Provider/OpenAI';
import { CustomOpenAIProvider } from '../src/ProviderRegistry/Provider/CustomOpenAI';
import { OllamaProvider } from '../src/ProviderRegistry/Provider/Ollama';
import { AnthropicProvider } from '../src/ProviderRegistry/Provider/Anthropic';

let providerRegistry: ProviderRegistry;

beforeEach(() => {
	providerRegistry = new ProviderRegistry();
});

test('constructor initializes providers correctly', () => {
	expect(providerRegistry.getProvider('OpenAI')).toBeInstanceOf(OpenAIProvider);
	expect(providerRegistry.getProvider('CustomOpenAI')).toBeInstanceOf(CustomOpenAIProvider);
	expect(providerRegistry.getProvider('Ollama')).toBeInstanceOf(OllamaProvider);
	expect(providerRegistry.getProvider('Anthropic')).toBeInstanceOf(AnthropicProvider);
});

test('configure sets up providers with given config', async () => {
	const config: Partial<ProviderRegistryConfig> = {
		OpenAI: { config: { apiKey: 'test-key' } },
	};
	const setupSpy = jest.spyOn(OpenAIProvider.prototype, 'setup');
	await providerRegistry.configure(config);
	expect(setupSpy).toHaveBeenCalledWith(config.OpenAI?.config);
});

test('getProvider returns the correct provider', () => {
	const provider = providerRegistry.getProvider('OpenAI');
	expect(provider).toBeInstanceOf(OpenAIProvider);
});

test('getGenProvider returns the correct gen provider', () => {
	const genProvider = providerRegistry.getGenProvider('OpenAI');
	expect(genProvider).toBeDefined();
});

test('getEmbedProvider returns the correct embed provider', () => {
	const embedProvider = providerRegistry.getEmbedProvider('OpenAI');
	expect(embedProvider).toBeDefined();
});

// TODO test configure with embedModels and genModels
