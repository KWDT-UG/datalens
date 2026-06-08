import Dexie, { type Table } from 'dexie';

export interface DraftRecord {
  id?: number;
  entityType: string;
  entityId?: number;
  payload: unknown;
  updatedAt: string;
  userId?: number;
}

export interface PendingSyncRecord {
  id?: number;
  entityType: string;
  entityId?: number;
  action: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  syncVersion?: number;
  clientMutationId: string;
  createdAt: string;
  updatedAt: string;
  status:
    | 'pending'
    | 'syncing'
    | 'failed'
    | 'conflict'
    | 'pending_approval'
    | 'synced';
  error?: string;
  serverRecord?: Record<string, unknown> | null;
  serverSyncVersion?: number;
  resultEntityId?: number;
  userId?: number;
}

export interface SyncCursorRecord {
  entityType: string;
  cursor?: string;
  updatedAt: string;
}

class DataLensOfflineDatabase extends Dexie {
  drafts!: Table<DraftRecord, number>;
  pendingSync!: Table<PendingSyncRecord, number>;
  syncCursors!: Table<SyncCursorRecord, string>;

  constructor() {
    super('dataLensOffline');
    this.version(1).stores({
      drafts: '++id, entityType, entityId, updatedAt',
      pendingSync: '++id, entityType, action, status, createdAt'
    });
    this.version(2).stores({
      drafts: '++id, [entityType+entityId], entityType, entityId, updatedAt, userId',
      pendingSync:
        '++id, clientMutationId, [entityType+entityId], entityType, entityId, action, status, createdAt, updatedAt, userId',
      syncCursors: 'entityType, updatedAt'
    });
  }
}

export const offlineDb = new DataLensOfflineDatabase();
