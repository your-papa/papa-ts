import { createSnapshot, type ThreadSnapshot, type ThreadStore } from './ThreadStore';

type FsModule = typeof import('node:fs/promises');
type PathModule = typeof import('node:path');

export interface FsThreadStoreOptions {
  directory: string;
  fileExtension?: string;
}

export class FsThreadStore implements ThreadStore {
  private readonly directory: string;
  private readonly extension: string;
  private fsModule?: FsModule;
  private pathModule?: PathModule;
  private initPromise?: Promise<void>;

  constructor(options: FsThreadStoreOptions) {
    this.directory = options.directory;
    this.extension = options.fileExtension ?? '.json';
  }

  async read(threadId: string): Promise<ThreadSnapshot | undefined> {
    try {
      const { fs, path } = await this.loadNodeModules();
      const file = this.filePath(path, threadId);
      const contents = await fs.readFile(file, 'utf8');
      return this.normalize(JSON.parse(contents));
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async write(snapshot: ThreadSnapshot): Promise<void> {
    const normalized = createSnapshot(snapshot);
    const { fs, path } = await this.loadNodeModules();
    await this.ensureDirectory(fs);
    const file = this.filePath(path, normalized.threadId);
    await fs.writeFile(file, JSON.stringify(normalized), 'utf8');
  }

  async delete(threadId: string): Promise<void> {
    try {
      const { fs, path } = await this.loadNodeModules();
      await fs.unlink(this.filePath(path, threadId));
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
    }
  }

  async list(): Promise<ThreadSnapshot[]> {
    const { fs, path } = await this.loadNodeModules();
      await this.ensureDirectory(fs);
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    const snapshots: ThreadSnapshot[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(this.extension)) {
        continue;
      }
      const file = path.join(this.directory, entry.name);
      try {
        const contents = await fs.readFile(file, 'utf8');
        const snapshot = this.normalize(JSON.parse(contents));
        if (snapshot) {
          snapshots.push(snapshot);
        }
      } catch (error) {
        if (!this.isNotFoundError(error)) {
          throw error;
        }
      }
    }
    return snapshots.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async clear(): Promise<void> {
    const { fs, path } = await this.loadNodeModules();
      await this.ensureDirectory(fs);
    const entries = await fs.readdir(this.directory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(this.extension))
        .map((entry) => fs.unlink(path.join(this.directory, entry.name)).catch((error) => {
          if (!this.isNotFoundError(error)) {
            throw error;
          }
        })),
    );
  }

  private async loadNodeModules(): Promise<{ fs: FsModule; path: PathModule }> {
    if (!this.fsModule || !this.pathModule) {
      const [fs, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
      this.fsModule = fs;
      this.pathModule = path;
    }
    return { fs: this.fsModule!, path: this.pathModule! };
  }

  private async ensureDirectory(fs: FsModule): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = fs.mkdir(this.directory, { recursive: true }).then(() => undefined);
    }
    await this.initPromise;
    // ensure directory still exists when called concurrently
    await fs.mkdir(this.directory, { recursive: true }).catch((error) => {
      if (!this.isEexistError(error)) {
        throw error;
      }
    });
  }

  private filePath(path: PathModule, threadId: string): string {
    const safeName = encodeURIComponent(threadId);
    return path.join(this.directory, `${safeName}${this.extension}`);
  }

  private isNotFoundError(error: unknown): boolean {
    return this.hasCode(error, 'ENOENT');
  }

  private isEexistError(error: unknown): boolean {
    return this.hasCode(error, 'EEXIST');
  }

  private hasCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;
  }

  private normalize(candidate: unknown): ThreadSnapshot | undefined {
    if (!candidate || typeof candidate !== 'object') {
      return undefined;
    }
    const snapshot = candidate as Partial<ThreadSnapshot> & { threadId?: unknown; metadata?: unknown };
    if (typeof snapshot.threadId !== 'string') {
      return undefined;
    }
    const metadata = snapshot.metadata && typeof snapshot.metadata === 'object' ? (snapshot.metadata as Record<string, unknown>) : undefined;
    return createSnapshot({
      threadId: snapshot.threadId,
      title: typeof snapshot.title === 'string' ? snapshot.title : undefined,
      metadata,
      createdAt: typeof snapshot.createdAt === 'number' ? snapshot.createdAt : undefined,
      updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : undefined,
    });
  }
}

