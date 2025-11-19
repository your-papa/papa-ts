import { createSnapshot, type ThreadSnapshot, type ThreadStore } from './ThreadStore';

export interface LocalStorageThreadStoreOptions {
  prefix?: string;
  storage?: Storage;
}

export class LocalStorageThreadStore implements ThreadStore {
  private readonly prefix: string;
  private readonly storage: Storage;

  constructor(options?: LocalStorageThreadStoreOptions) {
    this.prefix = options?.prefix ?? 'papa-agent-thread';
    const storage = options?.storage ?? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined);
    if (!storage) {
      throw new Error('localStorage is not available in the current environment.');
    }
    this.storage = storage;
  }

  async read(threadId: string): Promise<ThreadSnapshot | undefined> {
    const raw = this.storage.getItem(this.key(threadId));
    if (!raw) {
      return undefined;
    }
    return this.safeParse(raw);
  }

  async write(snapshot: ThreadSnapshot): Promise<void> {
    const normalized = createSnapshot(snapshot);
    this.storage.setItem(this.key(normalized.threadId), JSON.stringify(normalized));
  }

  async delete(threadId: string): Promise<void> {
    this.storage.removeItem(this.key(threadId));
  }

  async list(): Promise<ThreadSnapshot[]> {
    const entries: ThreadSnapshot[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key || !key.startsWith(this.prefix)) {
        continue;
      }
      const value = this.storage.getItem(key);
      if (!value) {
        continue;
      }
      const snapshot = this.safeParse(value);
      if (snapshot) {
        entries.push(snapshot);
      }
    }
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async clear(): Promise<void> {
    const keys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => this.storage.removeItem(key));
  }

  private key(threadId: string): string {
    return `${this.prefix}:${threadId}`;
  }

  private safeParse(raw: string): ThreadSnapshot | undefined {
    try {
      const parsed = JSON.parse(raw) as ThreadSnapshot;
      if (!parsed || typeof parsed.threadId !== 'string' || !Array.isArray(parsed.messages)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }
}

