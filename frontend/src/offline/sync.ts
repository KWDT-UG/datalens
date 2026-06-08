import { apiGet, apiPost, ApiClientError } from '../api/client';
import type { OfflineQueuedResult } from '../api/types';
import { offlineDb, type PendingSyncRecord } from './db';

export const OFFLINE_QUEUE_EVENT = 'datalens:offline-queue-changed';
const SYNC_BATCH_SIZE = 25;
const OFFLINE_STORAGE_TIMEOUT_MS = 5_000;

type QueueMutationInput = {
  action: PendingSyncRecord['action'];
  clientMutationId?: string;
  entityId?: number;
  entityType: string;
  payload?: Record<string, unknown>;
  syncVersion?: number;
  userId?: number;
};

type SyncAccepted = {
  index: number;
  id?: number;
  status: 'applied' | 'pending_approval';
};

type SyncConflict = {
  index: number;
  code: string;
  server?: Record<string, unknown> | null;
  server_sync_version?: number;
};

type SyncPushResponse = {
  data: {
    accepted: SyncAccepted[];
    conflicts: SyncConflict[];
  };
  errors: Array<{
    index?: number;
    detail: unknown;
  }>;
};

type SyncPullResponse = {
  data: Record<string, Array<Record<string, unknown>>>;
  meta: {
    has_more?: boolean;
    next_cursor?: string | null;
  };
};

function emitQueueChange() {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

function mutationId() {
  return globalThis.crypto?.randomUUID?.() ??
    `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function withStorageTimeout<T>(operation: Promise<T>, label: string) {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error(`Offline storage timed out while ${label}.`)),
        OFFLINE_STORAGE_TIMEOUT_MS
      );
    })
  ]);
}

export function browserIsOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export async function enqueueMutation(
  input: QueueMutationInput
): Promise<OfflineQueuedResult> {
  const clientMutationId = input.clientMutationId ?? mutationId();
  const now = new Date().toISOString();
  await withStorageTimeout(offlineDb.open(), 'opening the local database');
  const queueId = await withStorageTimeout(
    offlineDb.transaction('rw', offlineDb.pendingSync, () =>
      offlineDb.pendingSync.add({
        action: input.action,
        clientMutationId,
        createdAt: now,
        entityId: input.entityId ?? 0,
        entityType: input.entityType,
        payload: input.payload ?? {},
        status: 'pending',
        syncVersion: input.syncVersion,
        updatedAt: now,
        userId: input.userId
      })
    ),
    'queueing the change'
  );
  emitQueueChange();
  return {
    offline_queued: true,
    queue_id: queueId,
    client_mutation_id: clientMutationId,
    sync_status: 'pending_sync'
  };
}

export async function executeOrQueue<T>(
  input: QueueMutationInput & { execute: () => Promise<T> }
): Promise<T | OfflineQueuedResult> {
  if (!browserIsOnline()) {
    return enqueueMutation(input);
  }
  try {
    return await input.execute();
  } catch (error) {
    if (error instanceof TypeError) {
      return enqueueMutation(input);
    }
    throw error;
  }
}

function pushPayload(records: PendingSyncRecord[]) {
  return {
    changes: records.map((record) => ({
      action: record.action,
      client_mutation_id: record.clientMutationId,
      entity_type: record.entityType,
      ...(record.action === 'create' ? {} : { id: record.entityId }),
      payload: record.payload,
      ...(record.syncVersion === undefined
        ? {}
        : { sync_version: record.syncVersion })
    }))
  };
}

function syncResponse(error: unknown): SyncPushResponse | null {
  if (error instanceof ApiClientError && error.status === 409) {
    return error.payload as SyncPushResponse;
  }
  return null;
}

export async function flushPendingSync(userId?: number) {
  if (!browserIsOnline()) {
    return;
  }
  const eligible = await offlineDb.pendingSync
    .where('status')
    .anyOf(['pending', 'failed'])
    .filter((record) => record.userId === userId)
    .sortBy('createdAt');

  for (let start = 0; start < eligible.length; start += SYNC_BATCH_SIZE) {
    const batch = eligible.slice(start, start + SYNC_BATCH_SIZE);
    const now = new Date().toISOString();
    await offlineDb.transaction('rw', offlineDb.pendingSync, async () => {
      for (const record of batch) {
        await offlineDb.pendingSync.update(record.id as number, {
          status: 'syncing',
          updatedAt: now
        });
      }
    });
    emitQueueChange();

    let response: SyncPushResponse;
    try {
      response = await apiPost<SyncPushResponse, ReturnType<typeof pushPayload>>(
        '/api/v1/sync/push/',
        pushPayload(batch)
      );
    } catch (error) {
      const conflictResponse = syncResponse(error);
      if (!conflictResponse) {
        await offlineDb.transaction('rw', offlineDb.pendingSync, async () => {
          for (const record of batch) {
            await offlineDb.pendingSync.update(record.id as number, {
              error: error instanceof Error ? error.message : 'Sync failed.',
              status: 'failed',
              updatedAt: new Date().toISOString()
            });
          }
        });
        emitQueueChange();
        return;
      }
      response = conflictResponse;
    }

    const accepted = new Map(response.data.accepted.map((item) => [item.index, item]));
    const conflicts = new Map(response.data.conflicts.map((item) => [item.index, item]));
    const errors = new Map(
      response.errors
        .filter((item) => item.index !== undefined)
        .map((item) => [item.index as number, item])
    );

    await offlineDb.transaction('rw', offlineDb.pendingSync, async () => {
      for (const [index, record] of batch.entries()) {
        const acceptedItem = accepted.get(index);
        const conflict = conflicts.get(index);
        const syncError = errors.get(index);
        if (acceptedItem) {
          await offlineDb.pendingSync.update(record.id as number, {
            error: undefined,
            resultEntityId: acceptedItem.id,
            status:
              acceptedItem.status === 'pending_approval'
                ? 'pending_approval'
                : 'synced',
            updatedAt: new Date().toISOString()
          });
        } else if (conflict) {
          await offlineDb.pendingSync.update(record.id as number, {
            error: conflict.code,
            serverRecord: conflict.server,
            serverSyncVersion: conflict.server_sync_version,
            status: 'conflict',
            updatedAt: new Date().toISOString()
          });
        } else {
          await offlineDb.pendingSync.update(record.id as number, {
            error: syncError ? JSON.stringify(syncError.detail) : 'Sync failed.',
            status: 'failed',
            updatedAt: new Date().toISOString()
          });
        }
      }
    });
    emitQueueChange();
  }
}

export async function acceptServerVersion(queueId: number) {
  await offlineDb.pendingSync.delete(queueId);
  emitQueueChange();
}

export async function retryLocalVersion(queueId: number) {
  const record = await offlineDb.pendingSync.get(queueId);
  if (!record || record.status !== 'conflict') {
    return;
  }
  await offlineDb.pendingSync.update(queueId, {
    clientMutationId: mutationId(),
    error: undefined,
    serverRecord: undefined,
    status: 'pending',
    syncVersion:
      record.serverSyncVersion ??
      (record.serverRecord?.sync_version as number | undefined),
    updatedAt: new Date().toISOString()
  });
  emitQueueChange();
  await flushPendingSync(record.userId);
}

export async function retryFailed(queueId: number) {
  const record = await offlineDb.pendingSync.get(queueId);
  if (!record) {
    return;
  }
  await offlineDb.pendingSync.update(queueId, {
    error: undefined,
    status: 'pending',
    updatedAt: new Date().toISOString()
  });
  emitQueueChange();
  await flushPendingSync(record.userId);
}

export async function clearCompleted(userId?: number) {
  const completed = await offlineDb.pendingSync
    .where('status')
    .anyOf(['synced', 'pending_approval'])
    .filter((record) => record.userId === userId)
    .primaryKeys();
  await offlineDb.pendingSync.bulkDelete(completed as number[]);
  emitQueueChange();
}

export async function pullAllPages(
  entityType: string,
  onPage: (records: Array<Record<string, unknown>>) => Promise<void> | void
) {
  let cursor: string | undefined;
  do {
    const response = await apiGet<SyncPullResponse>('/api/v1/sync/pull/', {
      cursor,
      entity_type: entityType,
      include_deleted: 1,
      page_size: 200
    });
    await onPage(response.data[entityType] ?? []);
    cursor = response.meta.has_more
      ? response.meta.next_cursor ?? undefined
      : undefined;
  } while (cursor);
}
