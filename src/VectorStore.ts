import { Results, Orama, TypedDocument, create, insertMultiple, removeMultiple, search, searchVector } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';

export interface OramaLibArgs {
    indexName: string;
}

const vectorStoreSchema = {
    id: 'string',
    filename: 'string',
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
        args: OramaLibArgs
    ) {
        super(embeddings, args);
        this.db = create({
            schema: vectorStoreSchema,
            id: args.indexName,
        });
    }

    async removeDocuments(documents: Document[]) {
        // console.log('Removing documents', documents);
        const ids = await removeMultiple(
            await this.db,
            documents.map((document) => document.metadata.id)
        );
        // console.log('Removed documents with ids', ids);
    }

    async addVectors(vectors: number[][], documents: Document[]) {
        const filenames = documents.map((document) => document.metadata.filename);
        const filenamesToUpdate = filenames.filter((value, index, array) => array.indexOf(value) === index);
        for (const filename of filenamesToUpdate) {
            // TODO: remove limit?
            const vectorsToUpdate = await search(await this.db, { properties: ['filename'], term: filename, exact: true, limit: 10000 });
            // console.log('Removed documents', vectorsToUpdate, 'for filename', filename);
            await removeMultiple(
                await this.db,
                vectorsToUpdate.hits.map((hit) => hit.document.id)
            );
        }
        const docs = documents.map((document, index) => ({
            id: document.metadata.id,
            filename: document.metadata.filename,
            content: document.pageContent,
            embedding: vectors[index],
        }));

        const ids = await insertMultiple(await this.db, docs);
        // console.log('Inserted documents with ids', ids);
        return ids;
    }

    async addDocuments(documents: Document[]) {
        await this.addVectors(await this.embeddings.embedDocuments(documents.map((document) => document.pageContent)), documents);
        console.log((await this.db).data.docs);
    }

    static async fromDocuments(documents: Document[], embeddings: Embeddings, args: OramaLibArgs) {
        const store = new this(embeddings, args);
        await store.addDocuments(documents);
        return store;
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results: Results<VectorDocument> = await searchVector(await this.db, { vector: query, property: 'embedding', limit: k, similarity: 0.4 });
        return results.hits.map((result) => {
            return [new Document({ pageContent: result.document.content }), result.score];
        });
    }

    async getJson(): Promise<string> {
        return (await persist(await this.db, 'json')) as string;
    }

    async loadFromJson(vectorStoreJson: string) {
        this.db = restore('json', vectorStoreJson);
        console.log('Loaded vector store from JSON', await this.db);
    }
}
