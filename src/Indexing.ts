import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';

import { RecordManager } from './RecordManager';

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

function deduplicateInOrder(documents: Document[]): Document[] {
    const seen = new Set<string>();
    const deduplicated: Document[] = [];

    for (const hashedDoc of documents) {
        if (!hashedDoc.metadata.hash) {
            throw new Error('Hashed document does not have a hash');
        }

        if (!seen.has(hashedDoc.metadata.hash)) {
            seen.add(hashedDoc.metadata.hash);
            deduplicated.push(hashedDoc);
        }
    }
    return deduplicated;
}

export async function index(docs: Document[], recordManager: RecordManager, vectorStore: VectorStore, batchSize = 100) {
    const indexStartDt = await recordManager.getTime();
    let numAdded = 0;
    let numSkipped = 0;

    const batches = batch(batchSize, docs);

    for (const batch of batches) {
        const deduplicateDocs = deduplicateInOrder(batch);
        numSkipped += batch.length - deduplicateDocs.length;

        const batchExists = await recordManager.exists(deduplicateDocs.map((doc) => doc.metadata.hash));

        const ids: string[] = [];
        const docsToIndex: Document[] = [];
        const docsToUpdate: string[] = [];
        for (let i = 0; i < deduplicateDocs.length; i++) {
            const doc = deduplicateDocs[i];
            const docExists = batchExists[i];
            if (docExists) {
                docsToUpdate.push(doc.metadata.hash);
                continue;
            }
            ids.push(doc.metadata.hash);
            docsToIndex.push(doc);
        }

        numSkipped += docsToUpdate.length;

        if (docsToIndex.length > 0) {
            await vectorStore.addDocuments(docsToIndex, ids);
            numAdded += docsToIndex.length;
        }

        await recordManager.update(deduplicateDocs.map((doc) => doc.metadata.hash));
    }
    const idsToDelete = await recordManager.listKeys(indexStartDt, docs.length);
    await vectorStore.delete({ ids: idsToDelete });
    await recordManager.deleteKeys(idsToDelete);

    console.log(`Indexed ${numAdded} documents, skipped ${numSkipped} documents, deleted ${idsToDelete.length} documents`);
}
