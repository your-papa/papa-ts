import type { RunnableConfig } from '@langchain/core/runnables';
import {
    BaseCheckpointSaver,
    type Checkpoint,
    type CheckpointListOptions,
    type CheckpointMetadata,
    type CheckpointTuple,
    type PendingWrite,
    WRITES_IDX_MAP,
    copyCheckpoint,
    getCheckpointId,
    maxChannelVersion,
    type SerializerProtocol,
} from '@langchain/langgraph-checkpoint';
import { TASKS } from '@langchain/langgraph-checkpoint';

interface StoredCheckpointRecord {
    checkpoint: string;
    metadata: string;
    parentCheckpointId?: string;
}

type StoredWrites = Record<string, [string, string, string]>;

interface PersistedState {
    checkpoints: Record<string, Record<string, Record<string, StoredCheckpointRecord>>>;
    writes: Record<string, StoredWrites>;
}

function generateKey(threadId: string, checkpointNamespace: string, checkpointId: string): string {
    return JSON.stringify([threadId, checkpointNamespace, checkpointId]);
}

function parseKey(key: string): { threadId: string; checkpointNamespace: string; checkpointId: string } {
    const [threadId, checkpointNamespace, checkpointId] = JSON.parse(key) as [string, string, string];
    return { threadId, checkpointNamespace, checkpointId };
}

function bytesToBase64(bytes: Uint8Array): string {
    if (typeof globalThis.Buffer !== 'undefined') {
        return globalThis.Buffer.from(bytes).toString('base64');
    }
    if (typeof globalThis.btoa === 'function') {
        let binary = '';
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return globalThis.btoa(binary);
    }
    throw new Error('Unable to encode checkpoint payload: no base64 encoder available in this environment.');
}

function base64ToBytes(value: string): Uint8Array {
    if (typeof globalThis.Buffer !== 'undefined') {
        return new Uint8Array(globalThis.Buffer.from(value, 'base64'));
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    throw new Error('Unable to decode checkpoint payload: no base64 decoder available in this environment.');
}

export interface LocalStorageCheckpointSaverOptions {
    prefix?: string;
    storage?: Storage;
    serde?: SerializerProtocol;
}

export class LocalStorageCheckpointSaver extends BaseCheckpointSaver {
    private readonly storage: Storage;
    private readonly stateKey: string;
    private state: PersistedState;

    constructor(options?: LocalStorageCheckpointSaverOptions) {
        super(options?.serde);
        const storage = options?.storage ?? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined);
        if (!storage) {
            throw new Error('localStorage is not available in the current environment.');
        }
        this.storage = storage;
        this.stateKey = `${options?.prefix ?? 'papa-agent'}:checkpoints`;
        this.state = this.loadState();
    }

    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const threadId = config.configurable?.thread_id;
        if (!threadId) {
            return undefined;
        }
        const checkpointNamespace = config.configurable?.checkpoint_ns ?? '';
        const checkpoints = this.state.checkpoints[threadId]?.[checkpointNamespace];
        if (!checkpoints) {
            return undefined;
        }

        let checkpointId = getCheckpointId(config);
        if (checkpointId && checkpoints[checkpointId]) {
            return this.buildTuple(threadId, checkpointNamespace, checkpointId, config);
        }

        const availableIds = Object.keys(checkpoints);
        if (availableIds.length === 0) {
            return undefined;
        }
        checkpointId = availableIds.sort((a, b) => b.localeCompare(a))[0];
        return this.buildTuple(threadId, checkpointNamespace, checkpointId, {
            configurable: {
                thread_id: threadId,
                checkpoint_ns: checkpointNamespace,
                checkpoint_id: checkpointId,
            },
        });
    }

    async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
        const { before, limit, filter } = options ?? {};
        const requestedThread = config.configurable?.thread_id;
        const threadIds = requestedThread ? [requestedThread] : Object.keys(this.state.checkpoints);
        let remaining = typeof limit === 'number' ? limit : Number.POSITIVE_INFINITY;

        for (const threadId of threadIds) {
            const namespaces = this.state.checkpoints[threadId] ?? {};
            const namespaceFilter = config.configurable?.checkpoint_ns;
            for (const [checkpointNamespace, checkpoints] of Object.entries(namespaces)) {
                if (namespaceFilter !== undefined && checkpointNamespace !== namespaceFilter) {
                    continue;
                }
                const sortedEntries = Object.entries(checkpoints).sort((a, b) => b[0].localeCompare(a[0]));
                for (const [checkpointId] of sortedEntries) {
                    if (before?.configurable?.checkpoint_id && checkpointId >= before.configurable.checkpoint_id) {
                        continue;
                    }
                    const tuple = await this.buildTuple(threadId, checkpointNamespace, checkpointId, {
                        configurable: {
                            thread_id: threadId,
                            checkpoint_ns: checkpointNamespace,
                            checkpoint_id: checkpointId,
                        },
                    });
                    if (!tuple) {
                        continue;
                    }
                    if (filter && !this.matchesFilter(tuple.metadata, filter)) {
                        continue;
                    }
                    if (remaining <= 0) {
                        return;
                    }
                    remaining -= 1;
                    yield tuple;
                }
            }
        }
    }

    async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
        const preparedCheckpoint = copyCheckpoint(checkpoint);
        const threadId = config.configurable?.thread_id;
        if (!threadId) {
            throw new Error('Failed to put checkpoint. RunnableConfig is missing "thread_id" in its "configurable" property.');
        }
        const checkpointNamespace = config.configurable?.checkpoint_ns ?? '';
        if (!this.state.checkpoints[threadId]) {
            this.state.checkpoints[threadId] = {};
        }
        if (!this.state.checkpoints[threadId][checkpointNamespace]) {
            this.state.checkpoints[threadId][checkpointNamespace] = {};
        }
        const [[, serializedCheckpoint], [, serializedMetadata]] = await Promise.all([
            this.serde.dumpsTyped(preparedCheckpoint),
            this.serde.dumpsTyped(metadata),
        ]);
        this.state.checkpoints[threadId][checkpointNamespace][checkpoint.id] = {
            checkpoint: bytesToBase64(serializedCheckpoint),
            metadata: bytesToBase64(serializedMetadata),
            parentCheckpointId: config.configurable?.checkpoint_id,
        };
        this.persistState();
        return {
            configurable: {
                thread_id: threadId,
                checkpoint_ns: checkpointNamespace,
                checkpoint_id: checkpoint.id,
            },
        };
    }

    async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
        const threadId = config.configurable?.thread_id;
        const checkpointNamespace = config.configurable?.checkpoint_ns ?? '';
        const checkpointId = config.configurable?.checkpoint_id;
        if (!threadId) {
            throw new Error('Failed to put writes. RunnableConfig is missing "thread_id" in its "configurable" property.');
        }
        if (!checkpointId) {
            throw new Error('Failed to put writes. RunnableConfig is missing "checkpoint_id" in its "configurable" property.');
        }
        const outerKey = generateKey(threadId, checkpointNamespace, checkpointId);
        if (!this.state.writes[outerKey]) {
            this.state.writes[outerKey] = {};
        }
        const existing = this.state.writes[outerKey];
        await Promise.all(
            writes.map(async ([channel, value], index) => {
                const [, serializedValue] = await this.serde.dumpsTyped(value);
                const idx = WRITES_IDX_MAP[channel] ?? index;
                const innerKey = `${taskId},${idx}`;
                if (idx >= 0 && innerKey in existing) {
                    return;
                }
                existing[innerKey] = [taskId, channel, bytesToBase64(serializedValue)];
            }),
        );
        this.persistState();
    }

    async deleteThread(threadId: string): Promise<void> {
        delete this.state.checkpoints[threadId];
        for (const key of Object.keys(this.state.writes)) {
            if (parseKey(key).threadId === threadId) {
                delete this.state.writes[key];
            }
        }
        this.persistState();
    }

    private loadState(): PersistedState {
        const raw = this.storage.getItem(this.stateKey);
        if (!raw) {
            return { checkpoints: {}, writes: {} };
        }
        try {
            const parsed = JSON.parse(raw) as Partial<PersistedState>;
            return {
                checkpoints: parsed.checkpoints ?? {},
                writes: parsed.writes ?? {},
            };
        } catch {
            return { checkpoints: {}, writes: {} };
        }
    }

    private persistState(): void {
        this.storage.setItem(this.stateKey, JSON.stringify(this.state));
    }

    private async buildTuple(
        threadId: string,
        checkpointNamespace: string,
        checkpointId: string,
        config: RunnableConfig,
    ): Promise<CheckpointTuple | undefined> {
        const record = this.state.checkpoints[threadId]?.[checkpointNamespace]?.[checkpointId];
        if (!record) {
            return undefined;
        }
        const [checkpoint, metadata] = await Promise.all([
            this.serde.loadsTyped('json', base64ToBytes(record.checkpoint)),
            this.serde.loadsTyped('json', base64ToBytes(record.metadata)),
        ]);
        if (checkpoint.v < 4 && record.parentCheckpointId) {
            await this.migratePendingSends(checkpoint, threadId, checkpointNamespace, record.parentCheckpointId);
        }
        const pendingWrites = await this.loadPendingWrites(threadId, checkpointNamespace, checkpointId);
        const tuple: CheckpointTuple = {
            config,
            checkpoint,
            metadata,
            pendingWrites,
        };
        if (record.parentCheckpointId) {
            tuple.parentConfig = {
                configurable: {
                    thread_id: threadId,
                    checkpoint_ns: checkpointNamespace,
                    checkpoint_id: record.parentCheckpointId,
                },
            };
        }
        return tuple;
    }

    private async loadPendingWrites(threadId: string, checkpointNamespace: string, checkpointId: string) {
        const key = generateKey(threadId, checkpointNamespace, checkpointId);
        const pending = this.state.writes[key];
        if (!pending) {
            return [];
        }
        return Promise.all(
            Object.values(pending).map(async ([taskId, channel, value]) => {
                const deserialized = await this.serde.loadsTyped('json', base64ToBytes(value));
                return [taskId, channel, deserialized] as [string, string, unknown];
            }),
        );
    }

    private async migratePendingSends(
        mutableCheckpoint: Checkpoint,
        threadId: string,
        checkpointNamespace: string,
        parentCheckpointId: string,
    ): Promise<void> {
        const parentKey = generateKey(threadId, checkpointNamespace, parentCheckpointId);
        const writes = this.state.writes[parentKey] ?? {};
        const pendingSends = await Promise.all(
            Object.values(writes)
                .filter(([, channel]) => channel === TASKS)
                .map(async ([, , value]) => this.serde.loadsTyped('json', base64ToBytes(value))),
        );
        if (pendingSends.length === 0) {
            return;
        }
        mutableCheckpoint.channel_values ??= {};
        mutableCheckpoint.channel_values[TASKS] = pendingSends;
        mutableCheckpoint.channel_versions ??= {};
        mutableCheckpoint.channel_versions[TASKS] =
            Object.keys(mutableCheckpoint.channel_versions).length > 0
                ? maxChannelVersion(...Object.values(mutableCheckpoint.channel_versions))
                : this.getNextVersion(undefined);
    }

    private matchesFilter(metadata: CheckpointMetadata | undefined, filter: Record<string, unknown>): boolean {
        if (!metadata || typeof metadata !== 'object') {
            return false;
        }
        const candidate = metadata as Record<string, unknown>;
        return Object.entries(filter).every(([key, value]) => candidate[key] === value);
    }
}

