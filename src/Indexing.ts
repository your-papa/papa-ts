import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';

import { OramaRecordManager } from './RecordManager';
import { hashString } from './Utils';

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

export async function index(
    docs: Document[],
    recordManager: OramaRecordManager,
    vectorStore: VectorStore,
    mode: IndexingMode = 'full',
    batchSize = 100,
    cleanupBatchSize = 1000
) {
    const indexStartDt = Date.now();
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
                return { id: doc.metadata.hash, hashed_filepath: hashString(doc.metadata.filepath), indexed_at: Date.now() };
            })
        );
    }
    if (mode === 'byFile') {
        while (true) {
            const idsToDelete = await recordManager.listKeys(indexStartDt, cleanupBatchSize, [
                ...new Set(docs.map((doc) => hashString(doc.metadata.filepath))),
            ]);
            if (idsToDelete.length === 0) break;
            await vectorStore.delete({ ids: idsToDelete });
            await recordManager.deleteKeys(idsToDelete);
            numDeleted += idsToDelete.length;
        }
        console.log(`Indexed by File: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    } else if (mode === 'full') {
        while (true) {
            const idsToDelete = await recordManager.listKeys(indexStartDt, cleanupBatchSize);
            if (idsToDelete.length === 0) break;
            await vectorStore.delete({ ids: idsToDelete });
            await recordManager.deleteKeys(idsToDelete);
            numDeleted += idsToDelete.length;
        }
        console.log(`Indexed all: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    }
}
