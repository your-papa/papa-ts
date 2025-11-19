import { createSnapshot, type ThreadSnapshot, type ThreadStore } from './ThreadStore';

export class InMemoryThreadStore implements ThreadStore {
  private readonly store = new Map<string, ThreadSnapshot>();

  async read(threadId: string): Promise<ThreadSnapshot | undefined> {
    return this.store.get(threadId);
  }

  async write(snapshot: ThreadSnapshot): Promise<void> {
    this.store.set(snapshot.threadId, createSnapshot(snapshot));
  }

  async delete(threadId: string): Promise<void> {
    this.store.delete(threadId);
  }

  async list(): Promise<ThreadSnapshot[]> {
    return Array.from(this.store.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

