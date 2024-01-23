import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Orama, Results, TypedDocument, create, insertMultiple, removeMultiple, search } from '@orama/orama';
import { _deepClone } from 'fast-json-patch/module/helpers';

const vectorStoreSchema = {
    id: 'string',
    filepath: 'string',
    order: 'number',
    header: 'string[]',
    content: 'string',
    embedding: 'vector[1536]',
} as const;

export type VectorDocument = TypedDocument<Orama<typeof vectorStoreSchema>>;

export class OramaStore extends VectorStore {
    private db: Orama<typeof vectorStoreSchema>;

    _vectorstoreType(): string {
        return 'OramaStore';
    }

    constructor(
        public embeddings: Embeddings,
        args: Record<string, any>
    ) {
        super(embeddings, args);
    }

    async create(indexName: string) {
        this.db = await create({
            schema: vectorStoreSchema,
            id: indexName,
        });
    }

    async restore(vectorStoreBackup: VectorDocument[]) {
        console.log('Restoring vectorstore from backup');
        // vectorStoreBackup is an object and not an array for some reason
        const docs = Object.keys(vectorStoreBackup).map((key) => vectorStoreBackup[key]);
        await this.create('VectorStore');
        await insertMultiple(this.db, docs);
        console.log('Restored vectorstore from backup', this.db.data.docs);
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
        // console.log('Inserted documents with ids', ids);
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
            similarity: 0.75,
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

    async getData(): Promise<VectorDocument[]> {
        return this.db.data.docs.docs as VectorDocument[];
    }
}
