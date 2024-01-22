import Dexie, { Table } from 'dexie';

interface VectorIndexRecord {
    id: string;
    filepath: string;
    indexed_at: number;
}

export class DexieRecordManager extends Dexie {
    private records: Table<VectorIndexRecord, string>;

    constructor(public indexName: string) {
        super(indexName);
        this.version(1).stores({
            records: 'id,filepath,indexed_at',
        });
        this.records.clear();
    }

    async update(records: VectorIndexRecord[]): Promise<void> {
        await this.transaction('rw', this.records, async () => {
            await this.records.bulkPut(records);
        });
    }

    async exists(ids: string[]): Promise<boolean[]> {
        const found = await this.records.where('id').anyOf(ids).toArray();
        return ids.map((id) => found.some((record) => record.id === id));
    }

    async getIdsToDelete(indexStartTime: number, sources?: string[]): Promise<string[]> {
        let query = this.records.where('indexed_at').below(indexStartTime);
        if (sources) {
            query = query.and((record) => sources.includes(record.filepath));
        }
        const results = await query.toArray();
        return results.map((record) => record.id);
    }

    async deleteIds(ids: string[]): Promise<void> {
        await this.records.bulkDelete(ids);
    }

    async restore(recordManagerJson: VectorIndexRecord[]) {
        console.log('Restoring recordManager from json backup', recordManagerJson);
        await this.transaction('rw', this.records, async () => {
            await this.records.bulkPut(recordManagerJson);
        });
        console.log('Restored recordManager from json backup');
    }

    async getData(): Promise<VectorIndexRecord[]> {
        return await this.records.toArray();
    }
}
