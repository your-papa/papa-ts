import { test, expect, beforeEach, jest } from '@jest/globals';
import { KnowledgeIndex, IndexingMode } from '../src/KnowledgeIndex/KnowledgeIndex';
import { Document } from '@langchain/core/documents';
import { OramaStore } from '../src/KnowledgeIndex/VectorStore';
import { DexieRecordManager } from '../src/KnowledgeIndex/RecordManager';
import Log from '../src/Logging';
import { ProviderRegistry } from '../src/ProviderRegistry/ProviderRegistry';

let knowledgeIndex: KnowledgeIndex;
let vectorStore: OramaStore;
let recordManager: DexieRecordManager;

beforeEach(async () => {
	vectorStore = {
		create: jest.fn(),
		asRetriever: jest.fn(),
		addDocuments: jest.fn(),
		delete: jest.fn(),
		restore: jest.fn(),
		getData: jest.fn(),
		setSimilarityThreshold: jest.fn(),
	} as unknown as OramaStore;

	recordManager = {
		exists: jest.fn(),
		update: jest.fn(),
		getIdsToDelete: jest.fn(),
		deleteIds: jest.fn(),
		restore: jest.fn(),
		getData: jest.fn(),
	} as unknown as DexieRecordManager;

    const providerRegistry = new ProviderRegistry();
    await providerRegistry.configure({ OpenAI: { config: { apiKey: process.env.OPENAIAPI_KEY ?? '' }, embedModels: { 'text-embedding-3-small': { similarityThreshold: 0.5 } } } });
	knowledgeIndex = await KnowledgeIndex.create(await providerRegistry.getEmbedProvider('OpenAI').useModel('text-embedding-3-small'), 5);
	knowledgeIndex['recordManager'] = recordManager;
});

test('create initializes KnowledgeIndex correctly', async () => {
    const providerRegistry = new ProviderRegistry();
    await providerRegistry.configure({ OpenAI: { config: { apiKey: process.env.OPENAIAPI_KEY ?? '' }, embedModels: { 'text-embedding-3-small': { similarityThreshold: 0.5 } } } });
	const createdIndex = await KnowledgeIndex.create(await providerRegistry.getEmbedProvider('OpenAI').useModel('text-embedding-3-small'), 5);
	expect(createdIndex).toBeInstanceOf(KnowledgeIndex);
});

// TODO create internal document type

// test('embedDocuments embeds documents correctly', async () => {
// 	const documents: Document[] = [{ metadata: { hash: '1', filepath: 'path' }, pageContent: 'content' }];
// 	const logSpy = jest.spyOn(Log, 'info');
// 	const generator = knowledgeIndex.embedDocuments(documents);
// 	const result = await generator.next();
// 	expect(result.value).toEqual({ numAdded: 1, numSkipped: 0, numDeleted: 0 });
// 	expect(logSpy).toHaveBeenCalledWith('Indexed all: Added 1 documents, skipped 0 documents, deleted 0 documents');
// });

// test('deleteDocuments deletes documents based on sources', async () => {
// 	const basedOn = { sources: ['source1'] };
// 	const idsToDelete = ['1'];
// 	jest.spyOn(recordManager, 'getIdsToDelete').mockResolvedValue(idsToDelete);
// 	await knowledgeIndex.deleteDocuments(basedOn);
// 	expect(vectorStore.delete).toHaveBeenCalledWith({ ids: idsToDelete });
// 	expect(recordManager.deleteIds).toHaveBeenCalledWith(idsToDelete);
// });

// test('deleteDocuments deletes documents based on docs', async () => {
// 	const basedOn = { docs: [{ metadata: { hash: '1' }, pageContent: "test-content" }] as Document[] };
// 	await knowledgeIndex.deleteDocuments(basedOn);
// 	expect(vectorStore.delete).toHaveBeenCalledWith({ ids: ['1'] });
// 	expect(recordManager.deleteIds).toHaveBeenCalledWith(['1']);
// });

// test('setNumOfDocsToRetrieve sets the number of documents to retrieve', () => {
// 	knowledgeIndex.setNumOfDocsToRetrieve(10);
// 	expect(vectorStore.asRetriever).toHaveBeenCalledWith({ k: 10 });
// });

// test('setSimilarityThreshold sets the similarity threshold', () => {
// 	knowledgeIndex.setSimilarityThreshold(0.9);
// 	expect(vectorStore.setSimilarityThreshold).toHaveBeenCalledWith(0.9);
// });

// test('load restores vectorStore and recordManager', async () => {
// 	const vectorStoreBackup = new Uint8Array(8);
// 	const decodeSpy = jest.spyOn(require('@msgpack/msgpack'), 'decode').mockReturnValue({
// 		VectorStore: {},
// 		RecordManager: [],
// 	});
// 	await knowledgeIndex.load(vectorStoreBackup);
// 	expect(decodeSpy).toHaveBeenCalledWith(vectorStoreBackup);
// 	expect(vectorStore.restore).toHaveBeenCalled();
// 	expect(recordManager.restore).toHaveBeenCalled();
// });

test('getData returns encoded data', async () => {
	const encodeSpy = jest.spyOn(require('@msgpack/msgpack'), 'encode').mockReturnValue(new Uint8Array(8));
	await knowledgeIndex.getData();
	expect(encodeSpy).toHaveBeenCalled();
});
