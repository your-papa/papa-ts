export interface ThreadMessage {
  role: string;
  content: unknown;
  toolCallId?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadSnapshot {
  threadId: string;
  messages: ThreadMessage[];
  metadata?: Record<string, unknown>;
  updatedAt: number;
}

export interface ThreadStore {
  read(threadId: string): Promise<ThreadSnapshot | undefined>;
  write(snapshot: ThreadSnapshot): Promise<void>;
  delete(threadId: string): Promise<void>;
  list(): Promise<ThreadSnapshot[]>;
  clear(): Promise<void>;
}

export function createSnapshot(params: {
  threadId: string;
  messages: ThreadMessage[];
  metadata?: Record<string, unknown>;
  updatedAt?: number;
}): ThreadSnapshot {
  const { threadId, messages, metadata, updatedAt } = params;
  return {
    threadId,
    messages,
    metadata,
    updatedAt: updatedAt ?? Date.now(),
  };
}

