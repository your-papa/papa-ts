import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { VectorStore } from '@langchain/core/vectorstores';
import { Orama, Results, TypedDocument, create, insertMultiple, removeMultiple, search } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { _deepClone } from 'fast-json-patch/module/helpers';

export interface OramaStoreArgs {
    indexName: string;
}

const vectorStoreSchema = {
    id: 'string',
    filepath: 'string',
    order: 'number',
    header: 'string[]',
    content: 'string',
    embedding: 'vector[1536]',
} as const;

type VectorDocument = TypedDocument<Orama<typeof vectorStoreSchema>>;

export class OramaStore extends VectorStore {
    private db: Promise<Orama<typeof vectorStoreSchema>>;

    _vectorstoreType(): string {
        return 'OramaStore';
    }

    constructor(
        public embeddings: Embeddings,
        args: OramaStoreArgs
    ) {
        super(embeddings, args);
        this.db = create({
            schema: vectorStoreSchema,
            id: args.indexName,
        });
    }

    restoreDb(vectorStoreJson: string) {
        this.db = restore('json', vectorStoreJson);
        this.db.then((db) => console.log('Loaded vector store from JSON', _deepClone(db.data.docs)));
    }

    async delete(filters: { ids: string[] }) {
        await removeMultiple(await this.db, filters.ids);
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

        const ids = await insertMultiple(await this.db, docs);
        // console.log('Inserted documents with ids', ids);
        return ids;
    }

    async addDocuments(documents: Document[]) {
        await this.addVectors(await this.embeddings.embedDocuments(documents.map((document) => document.pageContent)), documents);
    }

    static async fromDocuments(documents: Document[], embeddings: Embeddings, args: OramaStoreArgs) {
        const store = new this(embeddings, args);
        await store.addDocuments(documents);
        return store;
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results: Results<VectorDocument> = await search(await this.db, {
            mode: 'vector',
            vector: { value: query, property: 'embedding' },
            limit: k,
            similarity: 0.8,
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

    async getJson(): Promise<string> {
        return (await persist(await this.db, 'json')) as string;
    }
}
