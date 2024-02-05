import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';

import { DexieRecordManager } from './RecordManager';
import Log from './Logging';

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
        const idsToDelete = await recordManager.getIdsToDelete({ indexStartTime, sources: [...new Set(docs.map((doc) => doc.metadata.filepath))] });
        await Promise.all([vectorStore.delete({ ids: idsToDelete }), recordManager.deleteIds(idsToDelete)]);
        numDeleted += idsToDelete.length;
        Log.info(`Indexed by File: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    } else if (mode === 'full') {
        const idsToDelete = await recordManager.getIdsToDelete({ indexStartTime });
        await Promise.all([vectorStore.delete({ ids: idsToDelete }), recordManager.deleteIds(idsToDelete)]);
        numDeleted += idsToDelete.length;
        Log.info(`Indexed all: Added ${numAdded} documents, skipped ${numSkipped} documents, deleted ${numDeleted} documents`);
    }
    return { numAdded, numSkipped, numDeleted };
}

export async function unindex(basedOn: { docs?: Document[]; sources?: string[] }, recordManager: DexieRecordManager, vectorStore: VectorStore) {
    if (basedOn.sources) {
        const idsToDelete = await recordManager.getIdsToDelete({ sources: basedOn.sources });
        await Promise.all([vectorStore.delete({ ids: idsToDelete }), recordManager.deleteIds(idsToDelete)]);
        Log.info(`Deleted ${idsToDelete.length} documents based on sources: ${basedOn.sources}`);
    } else if (basedOn.docs) {
        const idsToDelete = basedOn.docs.map((doc) => doc.metadata.hash);
        await Promise.all([vectorStore.delete({ ids: idsToDelete }), recordManager.deleteIds(idsToDelete)]);
        Log.info(`Deleted ${idsToDelete.length} documents based on docs`);
    } else {
        throw new Error('unindex must be called with either sources or docs');
    }
}
