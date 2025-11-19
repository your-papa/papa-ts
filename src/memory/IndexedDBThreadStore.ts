import { createSnapshot, type ThreadSnapshot, type ThreadStore } from './ThreadStore';

const DEFAULT_DB_NAME = 'papa-agent-threads';
const DEFAULT_STORE_NAME = 'threads';

export interface IndexedDBThreadStoreOptions {
  dbName?: string;
  storeName?: string;
}

export class IndexedDBThreadStore implements ThreadStore {
  private readonly dbName: string;
  private readonly storeName: string;
  private dbPromise?: Promise<IDBDatabase>;

  constructor(options?: IndexedDBThreadStoreOptions) {
    if (typeof globalThis.indexedDB === 'undefined') {
      throw new Error('indexedDB is not available in this environment.');
    }
    this.dbName = options?.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options?.storeName ?? DEFAULT_STORE_NAME;
  }

  async read(threadId: string): Promise<ThreadSnapshot | undefined> {
    const db = await this.openDb();
    return new Promise<ThreadSnapshot | undefined>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(threadId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as ThreadSnapshot | undefined);
    });
  }

  async write(snapshot: ThreadSnapshot): Promise<void> {
    const db = await this.openDb();
    const normalized = createSnapshot(snapshot);
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(normalized);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(threadId: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(threadId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async list(): Promise<ThreadSnapshot[]> {
    const db = await this.openDb();
    return new Promise<ThreadSnapshot[]>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = Array.isArray(request.result) ? (request.result as ThreadSnapshot[]) : [];
        resolve(results.sort((a, b) => b.updatedAt - a.updatedAt));
      };
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.dbName, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'threadId' });
          }
        };
      });
    }
    return this.dbPromise;
  }
}

