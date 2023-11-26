import { Results, Orama, TypedDocument, create, insertMultiple, searchVector, AnyOrama } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';

export interface OramaLibArgs {
    indexName: string;
}

const vectorStoreSchema = {
    metadata: {
        initialPageContent: 'string',
    },
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

    async addVectors(vectors: number[][], documents: Document[]) {
        const docs = documents.map((document, index) => ({
            metadata: {
                initialPageContent: document.pageContent,
            },
            embedding: vectors[index],
        }));
        const ids = await insertMultiple(await this.db, docs);
        return ids;
    }

    async addDocuments(documents: Document[]) {
        await this.addVectors(await this.embeddings.embedDocuments(documents.map((document) => document.pageContent)), documents);
    }

    static async fromDocuments(documents: Document[], embeddings: Embeddings, args: OramaLibArgs) {
        const store = new this(embeddings, args);
        await store.addDocuments(documents);
        return store;
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results: Results<VectorDocument> = await searchVector(await this.db, { vector: query, property: 'embedding', limit: k, similarity: 0.3 });
        return results.hits.map((result) => {
            return [new Document({ pageContent: result.document.metadata.initialPageContent }), result.score];
        });
    }

    async getJson(): Promise<string> {
        return (await persist(await this.db, 'json')) as string;
    }

    async loadFromJson(vectorStoreJson: string) {
        this.db = restore('json', vectorStoreJson);
    }
}
