import { test, expect, beforeEach, jest } from '@jest/globals';
import { Papa } from './Papa';
import { OllamaProvider } from './Provider/Ollama';

let papa: Papa;

beforeEach(() => {
	papa = new Papa();
});

test('init initializes Papa with given data', async () => {
	await papa.init({
		providers: {
			// Ollama: {
			// 	config: { baseUrl: 'http://localhost:11434' },
			// 	selEmbedModel: 'nomic-text-embed',
			// 	genModels: {
			// 		llama2: { temperature: 0.5, contextWindow: 4096 },
			// 		'llama2-uncensored': { temperature: 0.5, contextWindow: 4096 },
			// 		mistral: { temperature: 0.5, contextWindow: 8000 },
			// 		'mistral-openorca': { temperature: 0.5, contextWindow: 8000 },
			// 		gemma: { temperature: 0.5, contextWindow: 8000 },
			// 		mixtral: { temperature: 0.5, contextWindow: 32000 },
			// 		'dolphin-mixtral': { temperature: 0.5, contextWindow: 32000 },
			// 		phi: { temperature: 0.5, contextWindow: 2048 },
			// 	},
			// 	embedModels: {
			// 		'nomic-embed-text': { similarityThreshold: 0.5 },
			// 		'mxbai-embed-large': { similarityThreshold: 0.5 },
			// 	},
			// 	selGenModel: 'llama2',
			// },
			OpenAI: {
				config: { apiKey: '' },
				selEmbedModel: 'text-embedding-3-small',
				embedModels: {
					'text-embedding-ada-002': { similarityThreshold: 0.75 },
					'text-embedding-3-large': { similarityThreshold: 0.5 },
					'text-embedding-3-small': { similarityThreshold: 0.5 },
				},
				selGenModel: 'gpt-4o-mini',
				genModels: {
					'gpt-3.5-turbo': { temperature: 0.5, contextWindow: 16385 },
					'gpt-4': { temperature: 0.5, contextWindow: 8192 },
					'gpt-4o-mini': { temperature: 0.5, contextWindow: 8192 },
				},
			},
		},
		selEmbedProvider: 'OpenAI',
		selGenProvider: 'OpenAI',
	});
	const responseStream = papa.run({ isRAG: false, userQuery: "Hello, how are you?", chatHistory: "", lang: "en" });
	let content = '';
	for await (const response of responseStream) {
		// runState.set(response.status);
		content = response.content ?? '';
	}
	console.log('Response content:', content);
	expect(content).not.toBe('');
}, 10000);

test('pull ollama model', async () => {
	await papa.init({
		providers: {
			Ollama: {
				config: { baseUrl: 'http://localhost:11434' },
			},
		},
		selGenProvider: 'Ollama',
	});

	const ollamaProvider = papa.getProvider('Ollama') as OllamaProvider;

	let progress = 0;
	let total = 0;
	for await (const chunk of ollamaProvider.pullOllamaModel('llama2', new AbortController())) {
		if (chunk.total) total = chunk.total;
		if (chunk.completed) progress = Math.floor((chunk.completed / total) * 100);
	};
	if (progress === 100) console.log('Model pulled successfully');

	await papa.configure({ providers: { Ollama: { genModels: { llama2: { temperature: 0.5, contextWindow: 4096 } }, selGenModel: "llama2" } } });
	const responseStream = papa.run({ isRAG: false, userQuery: "Hello, how are you?", chatHistory: "", lang: "en" });

	let content = '';
	for await (const response of responseStream) {
		content = response.content ?? '';
	}
	console.log('Response content:', content);
	expect(content).not.toBe('');
}, 60000);
