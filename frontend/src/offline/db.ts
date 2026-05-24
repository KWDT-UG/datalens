import Dexie, { type Table } from 'dexie';

export interface DraftRecord {
  id?: number;
  entityType: string;
  entityId?: number;
  payload: unknown;
  updatedAt: string;
}

export interface PendingSyncRecord {
  id?: number;
  entityType: string;
  action: 'create' | 'update' | 'delete';
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'failed';
}

class DataLensOfflineDatabase extends Dexie {
  drafts!: Table<DraftRecord, number>;
  pendingSync!: Table<PendingSyncRecord, number>;

  constructor() {
    super('dataLensOffline');
    this.version(1).stores({
      drafts: '++id, entityType, entityId, updatedAt',
      pendingSync: '++id, entityType, action, status, createdAt'
    });
  }
}

export const offlineDb = new DataLensOfflineDatabase();
