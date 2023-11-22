import { create, insertMultiple, searchVector } from '@orama/orama';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';

export interface OramaLibArgs {
    indexName: string;
}

export class OramaStore extends VectorStore {
    public db: any;

    _vectorstoreType(): string {
        return 'OramaStore';
    }

    constructor(
        public embeddings: Embeddings,
        args: OramaLibArgs
    ) {
        super(embeddings, args);
        this.db = create({
            schema: {
                metadata: {
                    initialPageContent: 'string',
                },
                embedding: 'vector[1536]',
            },
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
        this.addVectors(await this.embeddings.embedDocuments(documents.map((document) => document.pageContent)), documents);
    }

    static async fromDocuments(documents: Document[], embeddings: Embeddings, args: OramaLibArgs) {
        const store = new this(embeddings, args);
        await store.addDocuments(documents);
        return store;
    }

    async similaritySearchVectorWithScore(query: number[], k: number): Promise<[Document, number][]> {
        const results = await searchVector(await this.db, { vector: query, property: 'embedding', limit: k, similarity: 0.3 });
        return results.hits.map((result) => {
            return [new Document({ pageContent: result.document.metadata.initialPageContent }), result.score];
        });
    }
}
