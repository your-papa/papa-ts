import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';

import { DexieRecordManager } from './RecordManager';

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

export type IndexingMode = 'full' | 'byFile';

export async function index(docs: Document[], recordManager: DexieRecordManager, vectorStore: VectorStore, mode: IndexingMode = 'full', batchSize = 100) {
    const indexStartTime = Date.now();
    let numAdded = 0;
    let numSkipped = 0;
    let numDeleted = 0;

    const batches = batch(batchSize, docs);

    for (const batch of batches) {
        const batchExists = await recordManager.exists(batch.map((doc) => doc.metadata.hash));

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
            await vectorStore.addDocuments(docsToIndex);
            numAdded += docsToIndex.length;
        }
        await recordManager.update(
            batch.map((doc) => {
                return { id: doc.metadata.hash, filepath: doc.metadata.filepath, indexed_at: Date.now() };
            })
        );
    }
    if (mode === 'byFile') {
        const idsToDelete = await recordManager.getIdsToDelete(indexStartTime, [...new Set(docs.map((doc) => doc.metadata.filepath))]);
        vectorStore.delete({ ids: idsToDelete });
        recordManager.deleteIds(idsToDelete);
        numDeleted += idsToDelete.length;
        console.log(`Indexed by File: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    } else if (mode === 'full') {
        const idsToDelete = await recordManager.getIdsToDelete(indexStartTime);
        vectorStore.delete({ ids: idsToDelete });
        recordManager.deleteIds(idsToDelete);
        numDeleted += idsToDelete.length;
        console.log(`Indexed all: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    }
    return { numAdded, numSkipped, numDeleted };
}

export async function unindex(docs: Document[], recordManager: DexieRecordManager, vectorStore: VectorStore) {
    const idsToDelete = docs.map((doc) => doc.metadata.hash);
    vectorStore.delete({ ids: idsToDelete });
    recordManager.deleteIds(idsToDelete);
    console.log(`Deleted ${idsToDelete.length} documents`);
}
