import { Orama, TypedDocument, create, search, removeMultiple, updateMultiple } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';

export interface OramaRecordManagerArgs {
    indexName: string;
}

export interface RecordManager {
    getTime(): Promise<number>;
    update(keys: string[], options?: ({ timeAtLeast?: number } & Record<string, unknown>) | undefined): Promise<void>;
    exists(keys: string[]): Promise<boolean[]>;
    listKeys(before: number, limit: number): Promise<string[]>;
    deleteKeys(keys: string[]): Promise<void>;
}

const recordManagerSchema = {
    id: 'string',
    updated_at: 'number',
} as const;

type RecordManagerDocument = TypedDocument<Orama<typeof recordManagerSchema>>;

export class OramaRecordManager implements RecordManager {
    private db: Promise<Orama<typeof recordManagerSchema>>;

    constructor(public args: OramaRecordManagerArgs) {
        this.db = create({
            schema: recordManagerSchema,
            id: args.indexName,
            components: {
                tokenizer: {
                    stemming: true,
                    stemmerSkipProperties: ['id'],
                },
            },
        });
    }

    async getTime(): Promise<number> {
        return Date.now();
    }

    async update(keys: string[]): Promise<void> {
        const updated_at = await this.getTime();
        await updateMultiple(
            await this.db,
            keys,
            keys.map(
                (key) =>
                    ({
                        id: key,
                        updated_at,
                    }) as RecordManagerDocument
            )
        );
    }

    async exists(keys: string[]): Promise<boolean[]> {
        const results = await search(await this.db, {
            where: {
                id: keys,
            },
            limit: keys.length,
        });
        return keys.map((key) => results.hits.some((hit) => hit.document.id === key));
    }

    async listKeys(before: number, limit: number): Promise<string[]> {
        const results = await search(await this.db, {
            where: {
                updated_at: {
                    lt: before,
                },
            },
            limit,
        });
        return results.hits.map((hit) => hit.document.id);
    }

    async deleteKeys(keys: string[]): Promise<void> {
        await removeMultiple(await this.db, keys);
    }

    restoreDb(recordManagerJson: string) {
        console.log('Loading record manager from JSON');
        this.db = restore('json', recordManagerJson);
    }

    async getJson(): Promise<string> {
        return (await persist(await this.db, 'json')) as string;
    }
}
