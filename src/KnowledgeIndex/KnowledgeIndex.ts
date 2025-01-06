import { Document } from '@langchain/core/documents';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { decode, encode } from '@msgpack/msgpack';
import { DexieRecordManager, VectorIndexRecord } from './RecordManager';
import { OramaStore, VectorStoreBackup } from './VectorStore';
import Log from '../Logging';
import { EmbedModel, EmbedModelFilled } from '../ProviderRegistry/EmbedProvider';

export type IndexingMode = 'full' | 'byFile';

export class KnowledgeIndex {
    private vectorStore: OramaStore;
    private recordManager: DexieRecordManager;
    private retriever: VectorStoreRetriever;

    private constructor(vectorStore: OramaStore, numOfDocsToRetrieve: number) {
        this.vectorStore = vectorStore;
        this.recordManager = new DexieRecordManager('RecordManager');
        this.retriever = this.vectorStore.asRetriever({ k: numOfDocsToRetrieve });
    }

    static async create(embedModel: EmbedModelFilled, numOfDocsToRetrieve: number) {
        const vectorStore = await OramaStore.create(embedModel.name, embedModel.lc, embedModel.config.similarityThreshold);
        return new KnowledgeIndex(vectorStore, numOfDocsToRetrieve);
    }

    async *embedDocuments(documents: Document[], mode: IndexingMode = 'full', batchSize = 10) {
        const indexStartTime = Date.now();
        let numAdded = 0;
        let numSkipped = 0;
        let numDeleted = 0;

        const batches = batch(batchSize, documents);

        for (const batch of batches) {
            const batchExists = await this.recordManager.exists(batch.map((doc) => doc.metadata.hash));
            const ids: string[] = [];
            const docsToIndex: Document[] = [];
            for (let i = 0; i < batch.length; i++) {
                const doc = batch[i];
                const docExists = batchExists[i];
                if (docExists) {
                    numSkipped++;
                    continue;
                }
                ids.push(doc.metadata.hash);
                docsToIndex.push(doc);
            }
            if (docsToIndex.length > 0) {
                await this.vectorStore.addDocuments(docsToIndex);
                numAdded += docsToIndex.length;
            }
            await this.recordManager.update(
                batch.map((doc) => {
                    return { id: doc.metadata.hash, filepath: doc.metadata.filepath, indexed_at: Date.now() };
                })
            );
            yield { numAdded, numSkipped, numDeleted };
        }
        if (mode === 'byFile') {
            const idsToDelete = await this.recordManager.getIdsToDelete({
                indexStartTime,
                sources: [...new Set(documents.map((doc) => doc.metadata.filepath))],
            });
            await Promise.all([this.vectorStore.delete({ ids: idsToDelete }), this.recordManager.deleteIds(idsToDelete)]);
            numDeleted += idsToDelete.length;
            Log.info(`Indexed by File: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
            yield { numAdded, numSkipped, numDeleted };
        } else if (mode === 'full') {
            const idsToDelete = await this.recordManager.getIdsToDelete({ indexStartTime });
            await Promise.all([this.vectorStore.delete({ ids: idsToDelete }), this.recordManager.deleteIds(idsToDelete)]);
            numDeleted += idsToDelete.length;
            Log.info(`Indexed all: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
            yield { numAdded, numSkipped, numDeleted };
        }
        return { numAdded, numSkipped, numDeleted };
    }

    async deleteDocuments(basedOn: { docs?: Document[]; sources?: string[] }) {
        if (basedOn.sources) {
            const idsToDelete = await this.recordManager.getIdsToDelete({ sources: basedOn.sources });
            await Promise.all([this.vectorStore.delete({ ids: idsToDelete }), this.recordManager.deleteIds(idsToDelete)]);
            Log.info(`Deleted ${idsToDelete.length} documents based on sources: ${basedOn.sources}`);
        } else if (basedOn.docs) {
            const idsToDelete = basedOn.docs.map((doc) => doc.metadata.hash);
            await Promise.all([this.vectorStore.delete({ ids: idsToDelete }), this.recordManager.deleteIds(idsToDelete)]);
            Log.info(`Deleted ${idsToDelete.length} documents based on docs`);
        } else {
            throw new Error('unindex must be called with either sources or docs');
        }
    }

    setNumOfDocsToRetrieve(numOfDocsToRetrieve: number) {
        this.retriever = this.vectorStore.asRetriever({ k: numOfDocsToRetrieve });
    }

    setSimilarityThreshold(similarityThreshold: number) {
        this.vectorStore.setSimilarityThreshold(similarityThreshold);
    }

    getRetriever() {
        return this.retriever;
    }

    async load(vectorStoreBackup: Uint8Array) {
        const { VectorStore, RecordManager } = decode(vectorStoreBackup) as { VectorStore: VectorStoreBackup; RecordManager: VectorIndexRecord[] };
        await Promise.all([this.vectorStore.restore(VectorStore), this.recordManager.restore(RecordManager)]);
    }

    async getData(): Promise<Uint8Array> {
        return encode({
            VectorStore: await this.vectorStore.getData(),
            RecordManager: await this.recordManager.getData(),
        });
    }
}

function batch<T>(size: number, iterable: T[]): T[][] {
    const batches: T[][] = [];
    let currentBatch: T[] = [];

    iterable.forEach((item) => {
        currentBatch.push(item);

        if (currentBatch.length >= size) {
            batches.push(currentBatch);
            currentBatch = [];
        }
    });

    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    return batches;
}
