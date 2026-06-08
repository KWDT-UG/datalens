import { SyncAltIcon } from '@patternfly/react-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { offlineDb, type PendingSyncRecord } from './db';
import {
  acceptServerVersion,
  clearCompleted,
  flushPendingSync,
  OFFLINE_QUEUE_EVENT,
  retryFailed,
  retryLocalVersion
} from './sync';

function displayEntity(record: PendingSyncRecord) {
  const label = record.entityType.replace(/_/g, ' ');
  const id = record.entityId ?? record.resultEntityId;
  return id ? `${label} #${id}` : `new ${label}`;
}

function badgeStatus(record: PendingSyncRecord) {
  if (record.status === 'pending' || record.status === 'syncing') {
    return 'pending_sync';
  }
  if (record.status === 'failed') {
    return 'sync_failed';
  }
  if (record.status === 'pending_approval') {
    return 'pending';
  }
  return record.status;
}

export function SyncCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [records, setRecords] = useState<PendingSyncRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  const loadRecords = useCallback(async () => {
    const rows = await offlineDb.pendingSync
      .orderBy('createdAt')
      .reverse()
      .filter((record) => record.userId === user?.id)
      .toArray();
    setRecords(rows);
  }, [user?.id]);

  const syncNow = useCallback(async () => {
    await flushPendingSync(user?.id);
    await queryClient.invalidateQueries();
    await loadRecords();
  }, [loadRecords, queryClient, user?.id]);

  useEffect(() => {
    void loadRecords();
    function changed() {
      void loadRecords();
    }
    function becameOnline() {
      setOnline(true);
      void syncNow();
    }
    function becameOffline() {
      setOnline(false);
    }
    window.addEventListener(OFFLINE_QUEUE_EVENT, changed);
    window.addEventListener('online', becameOnline);
    window.addEventListener('offline', becameOffline);
    if (navigator.onLine) {
      void syncNow();
    }
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, changed);
      window.removeEventListener('online', becameOnline);
      window.removeEventListener('offline', becameOffline);
    };
  }, [loadRecords, syncNow]);

  const attentionCount = useMemo(
    () =>
      records.filter((record) =>
        ['pending', 'syncing', 'failed', 'conflict'].includes(record.status)
      ).length,
    [records]
  );

  return (
    <>
      <button
        className="sync-center-button"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open sync center, ${attentionCount} items need attention`}
      >
        <SyncAltIcon aria-hidden="true" />
        <span>{online ? 'Sync' : 'Offline'}</span>
        {attentionCount ? <strong>{attentionCount}</strong> : null}
      </button>

      {open ? (
        <div className="sync-drawer" role="dialog" aria-modal="true" aria-label="Sync center">
          <div className="sync-drawer__backdrop" onClick={() => setOpen(false)} />
          <aside className="sync-drawer__panel">
            <header>
              <div>
                <h2>Sync center</h2>
                <p>{online ? 'Online and ready to replay changes.' : 'Changes will replay when connectivity returns.'}</p>
              </div>
              <button className="button button--secondary" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>
            <div className="sync-drawer__actions">
              <button
                className="button button--primary"
                type="button"
                disabled={!online || attentionCount === 0}
                onClick={() => void syncNow()}
              >
                Sync now
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void clearCompleted(user?.id).then(loadRecords)}
              >
                Clear completed
              </button>
            </div>
            <div className="sync-records">
              {records.length === 0 ? (
                <div className="state-box">No local changes are waiting.</div>
              ) : null}
              {records.map((record) => (
                <article className="sync-record" key={record.id}>
                  <div className="sync-record__heading">
                    <div>
                      <strong>{displayEntity(record)}</strong>
                      <small>{record.action} · {new Date(record.updatedAt).toLocaleString()}</small>
                    </div>
                    <StatusBadge status={badgeStatus(record)} />
                  </div>
                  {record.error ? <p className="sync-record__error">{record.error}</p> : null}
                  {record.status === 'conflict' ? (
                    <>
                      <p>
                        The server record changed after this local edit. Automatic
                        field merging is disabled.
                      </p>
                      <div className="sync-conflict-grid">
                        <div>
                          <strong>Local change</strong>
                          <pre>{JSON.stringify(record.payload, null, 2)}</pre>
                        </div>
                        <div>
                          <strong>Current server</strong>
                          <pre>{JSON.stringify(record.serverRecord, null, 2)}</pre>
                        </div>
                      </div>
                      <div className="row-actions">
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={() => void acceptServerVersion(record.id as number)}
                        >
                          Keep server
                        </button>
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={!online}
                          onClick={() => void retryLocalVersion(record.id as number)}
                        >
                          Retry local version
                        </button>
                      </div>
                    </>
                  ) : null}
                  {record.status === 'failed' ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={!online}
                      onClick={() => void retryFailed(record.id as number)}
                    >
                      Retry
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
