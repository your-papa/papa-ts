import { Orama, TypedDocument, create, search, removeMultiple, updateMultiple } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { _deepClone } from 'fast-json-patch/module/helpers';

export interface OramaRecordManagerArgs {
    indexName: string;
}

const recordManagerSchema = {
    id: 'string',
    hashed_filepath: 'string',
    indexed_at: 'number',
} as const;

type VectorIndexRecord = TypedDocument<Orama<typeof recordManagerSchema>>;

export class OramaRecordManager {
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

    async update(records: VectorIndexRecord[]): Promise<void> {
        await updateMultiple(
            await this.db,
            records.map((record) => record.id),
            records
        );
    }

    async exists(ids: string[]): Promise<boolean[]> {
        const results = await search(await this.db, {
            where: {
                id: ids,
            },
            limit: ids.length,
        });
        return ids.map((id) => results.hits.some((hit) => hit.document.id === id));
    }

    async listKeys(before: number, limit: number, sources?: string[]): Promise<string[]> {
        console.log('Searching for entries indexed before', before, 'in Oramadb', _deepClone((await this.db).data.docs));
        let where;
        if (sources) {
            where = { hashed_filepath: sources, indexed_at: { lt: before } };
        } else {
            where = { indexed_at: { lt: before } };
        }
        const results = await search(await this.db, { where, limit });
        console.log('Results', results);
        return results.hits.map((hit) => hit.document.id);
    }

    async deleteKeys(keys: string[]): Promise<void> {
        await removeMultiple(await this.db, keys);
        console.log('Removed from RecordManager', _deepClone((await this.db).data.docs));
    }

    restoreDb(recordManagerJson: string) {
        this.db = restore('json', recordManagerJson);
        this.db.then((db) => console.log('Loaded record manager from JSON', _deepClone(db.data.docs)));
    }

    async getJson(): Promise<string> {
        return (await persist(await this.db, 'json')) as string;
    }
}
