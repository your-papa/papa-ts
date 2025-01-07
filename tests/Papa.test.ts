import 'fake-indexeddb/auto'; // TODO figure out why setupFiles does not work

import { test, expect } from '@jest/globals';
import { Papa } from '../src';
import { RAGAssistant } from '../src/AssistantFactory/Assistants/RAG';

let papa: Papa;

beforeAll(async () => {
    papa = await Papa.init({
        providers: {
            OpenAI: {
                config: {
                    apiKey: process.env.OPENAIAPI_KEY ?? '',
                },
                genModels: { 'gpt-4o-mini': { temperature: 0.5, contextWindow: 8192 } },
                embedModels: { 'text-embedding-3-small': { similarityThreshold: 0.5 } },
            },
        },
    });
});

test('run plain assistant', async () => {
    await papa.setAssistant('plain', { genModel: { provider: 'OpenAI', name: 'gpt-4o-mini' } });
    const responseStream = papa.run({ userQuery: 'Hello, how are you?', chatHistory: '', lang: 'en' });
    let content = '';
    for await (const response of responseStream) {
        // runState.set(response.status);
        content = response.content ?? '';
    }
    console.log('Response content:', content);
    expect(content).not.toBe('');
}, 10000);

test('run rag assistant', async () => {
    await papa.setAssistant('rag', {
        genModel: { provider: 'OpenAI', name: 'gpt-4o-mini' },
        embedModel: { provider: 'OpenAI', name: 'text-embedding-3-small' },
    });
    const ragAssistant = papa.getAssistant() as RAGAssistant;
    const docs = [
        {
            metadata: {
                id: '1',
                hash: 'asdfas',
                filepath: 'Papa',
                header: ['Leonard Heininger'],
                order: 0,
                content: 'Leonard Heininger is a developer of the papa-ts library.',
            },
            pageContent: 'Leonard Heininger is a developer of the papa-ts library.',
        },
    ];
    for await (const result of ragAssistant.embedDocuments(docs)) {
        console.log('Embedding result:', result);
    }

    const responseStream = papa.run({ userQuery: 'who is leonard heininger?', chatHistory: '', lang: 'en' });
    let content = '';
    for await (const response of responseStream) {
        // runState.set(response.status);
        content = response.content ?? '';
    }
    console.log('Response content:', content);
    expect(content).not.toBe('');
}, 10000);

// test('pull ollama model', async () => {
//     await papa.init({
//         providers: {
//             Ollama: {
//                 config: { baseUrl: 'http://localhost:11434' },
//             },
//         },
//         selGenProvider: 'Ollama',
//     });

//     const ollamaProvider = papa.getProvider('Ollama') as OllamaProvider;

//     let progress = 0;
//     let total = 0;
//     for await (const chunk of ollamaProvider.pullOllamaModel('llama2', new AbortController())) {
//         if (chunk.total) total = chunk.total;
//         if (chunk.completed) progress = Math.floor((chunk.completed / total) * 100);
//     }
//     if (progress === 100) console.log('Model pulled successfully');

//     await papa.configure({ providers: { Ollama: { genModels: { llama2: { temperature: 0.5, contextWindow: 4096 } }, selGenModel: 'llama2' } } });
//     const responseStream = papa.run({ isRAG: false, userQuery: 'Hello, how are you?', chatHistory: '', lang: 'en' });

//     let content = '';
//     for await (const response of responseStream) {
//         content = response.content ?? '';
//     }
//     console.log('Response content:', content);
//     expect(content).not.toBe('');
// }, 60000);
