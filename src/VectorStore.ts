import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Orama, Results, TypedDocument, create, insertMultiple, removeMultiple, search } from '@orama/orama';
import { _deepClone } from 'fast-json-patch/module/helpers';

import Log from './Logging';

const vectorStoreSchema = {
    id: 'string',
    filepath: 'string',
    order: 'number',
    header: 'string[]',
    content: 'string',
} as const;

type VectorDocument = TypedDocument<Orama<typeof vectorStoreSchema>>;

export interface VectorStoreBackup {
    indexName: string;
    vectorSize: number;
    docs: VectorDocument[];
}

export class OramaStore extends VectorStore {
    private db: Orama<typeof vectorStoreSchema>;
    private indexName: string;
    private vectorSize: number;
    private similarity: number;

    _vectorstoreType(): string {
        return 'OramaStore';
    }

    constructor(
        public embeddings: Embeddings,
        args: Record<string, any>
    ) {
        super(embeddings, args);
        this.similarity = args.similarityThreshold || 0.75;
    }

    async create(indexName: string, vectorSize: number) {
        this.indexName = indexName;
        this.vectorSize = vectorSize;
        this.db = await create({
            schema: {
                ...vectorStoreSchema,
                embedding: `vector[${vectorSize}]`,
            } as const,
            id: indexName,
        });
    }

    async restore(vectorStoreBackup: VectorStoreBackup) {
        Log.debug('Restoring vectorstore from backup');
        // vectorStoreBackup is an object and not an array for some reason
        const docs = Object.keys(vectorStoreBackup.docs).map((key) => vectorStoreBackup.docs[key]);
        await this.create(vectorStoreBackup.indexName, vectorStoreBackup.vectorSize);
        await insertMultiple(this.db, docs);
        Log.info('Restored vectorstore from backup');
        Log.debug(this.db.data.docs.docs);
    }

    async delete(filters: { ids: string[] }) {
        await removeMultiple(this.db, filters.ids);
    }

    async addVectors(vectors: number[][], documents: Document[]) {
        const docs: VectorDocument[] = documents.map((document, index) => ({
            id: document.metadata.hash,
            filepath: document.metadata.filepath,
            content: document.metadata.content,
            header: document.metadata.header,
            order: document.metadata.order,
            embedding: vectors[index],
        }));

        const ids = await insertMultiple(this.db, docs);
        return ids;
    }

    async addDocuments(documents: Document[]) {
        await this.addVectors(await this.embeddings.embedDocuments(documents.map((document) => document.pageContent)), documents);
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results: Results<VectorDocument> = await search(this.db, {
            mode: 'vector',
            vector: { value: query, property: 'embedding' },
            limit: k,
            similarity: this.similarity,
        });
        return results.hits.map((result) => {
            return [
                new Document({
                    metadata: { filepath: result.document.filepath, order: result.document.order, header: result.document.header },
                    pageContent: result.document.content,
                }),
                result.score,
            ];
        });
    }

    async getData(): Promise<VectorStoreBackup> {
        return { indexName: this.indexName, vectorSize: this.vectorSize, docs: this.db.data.docs.docs as VectorDocument[] };
    }

    setSimilarityThreshold(similarityThreshold: number) {
        this.similarity = similarityThreshold;
    }
}
