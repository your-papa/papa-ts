import Dexie, { Table } from 'dexie';

import Log from '../Logging';

export interface VectorIndexRecord {
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
        this.records = this.table('records');
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

    async getIdsToDelete(filters: { indexStartTime?: number; sources?: string[] }): Promise<string[]> {
        let results: VectorIndexRecord[] = [];
        if (filters.indexStartTime && filters.sources && filters.sources.length > 0) {
            results = await this.records
                .where('indexed_at')
                .below(filters.indexStartTime)
                .and((record) => filters.sources!.includes(record.filepath))
                .toArray();
        } else if (filters.indexStartTime) {
            results = await this.records.where('indexed_at').below(filters.indexStartTime).toArray();
        } else if (filters.sources) {
            results = await this.records.where('filepath').anyOf(filters.sources).toArray();
        }
        return results.map((record) => record.id);
    }

    async deleteIds(ids: string[]): Promise<void> {
        await this.records.bulkDelete(ids);
    }

    async restore(recordManagerBackup: VectorIndexRecord[]) {
        Log.debug('Restoring recordManager from backup');
        await this.transaction('rw', this.records, async () => {
            await this.records.bulkPut(recordManagerBackup);
        });
        Log.info('Restored recordManager from backup');
        Log.debug({ records: await this.records.toArray() });
    }

    async getData(): Promise<VectorIndexRecord[]> {
        return await this.records.toArray();
    }
}
