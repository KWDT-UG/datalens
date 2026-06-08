import { beforeEach, describe, expect, it, vi } from 'vitest';

const { add, deleteRecord } = vi.hoisted(() => ({
  add: vi.fn(async () => 41),
  deleteRecord: vi.fn(async () => undefined)
}));

vi.mock('./db', () => ({
  offlineDb: {
    open: vi.fn(async () => undefined),
    pendingSync: {
      add,
      delete: deleteRecord
    },
    transaction: vi.fn(
      async (_mode: string, _table: unknown, callback: () => unknown) =>
        callback()
    )
  }
}));

import { acceptServerVersion, executeOrQueue, pullAllPages } from './sync';

describe('offline synchronization helpers', () => {
  beforeEach(() => {
    add.mockClear();
    deleteRecord.mockClear();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true
    });
  });

  it('queues a mutation with a stable client mutation id while offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });
    const execute = vi.fn();

    const result = await executeOrQueue({
      action: 'update',
      entityId: 7,
      entityType: 'resource',
      payload: { name: 'Offline pump' },
      syncVersion: 3,
      userId: 9,
      execute
    });

    expect(execute).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        clientMutationId: expect.any(String),
        entityId: 7,
        entityType: 'resource',
        status: 'pending',
        syncVersion: 3,
        userId: 9
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        offline_queued: true,
        queue_id: 41,
        sync_status: 'pending_sync'
      })
    );
  });

  it('uses a local zero id for creates without sending it to sync push', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });

    await executeOrQueue({
      action: 'create',
      entityType: 'community',
      payload: { name: 'Offline community' },
      userId: 9,
      execute: vi.fn()
    });

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityId: 0
      })
    );
  });

  it('follows server-issued cursors until every pull page is consumed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: { resource: [{ id: 1 }] },
          errors: [],
          meta: { has_more: true, next_cursor: 'next-page' }
        }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: { resource: [{ id: 2 }] },
          errors: [],
          meta: { has_more: false, next_cursor: null }
        }),
        ok: true,
        status: 200
      });
    vi.stubGlobal('fetch', fetchMock);
    const ids: number[] = [];

    await pullAllPages('resource', async (records) => {
      ids.push(...records.map((record) => record.id as number));
    });

    expect(ids).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=next-page');
  });

  it('accepts the server version by removing the conflicting local mutation', async () => {
    await acceptServerVersion(18);
    expect(deleteRecord).toHaveBeenCalledWith(18);
  });
});
