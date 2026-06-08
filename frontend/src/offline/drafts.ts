import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormReset, UseFormWatch } from 'react-hook-form';

import { offlineDb } from './db';

type OfflineDraftOptions<T extends FieldValues> = {
  enabled?: boolean;
  entityId?: number;
  entityType: string;
  reset: UseFormReset<T>;
  userId?: number;
  watch: UseFormWatch<T>;
};

function draftStorageAvailable() {
  return typeof indexedDB !== 'undefined';
}

export function useOfflineDraft<T extends FieldValues>({
  enabled = true,
  entityId,
  entityType,
  reset,
  userId,
  watch
}: OfflineDraftOptions<T>) {
  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || !draftStorageAvailable()) {
      loaded.current = true;
      return;
    }
    let active = true;
    offlineDb.drafts
      .where('[entityType+entityId]')
      .equals([entityType, entityId ?? 0])
      .filter((draft) => draft.userId === userId)
      .last()
      .then((draft) => {
        if (active && draft?.payload) {
          reset(draft.payload as T);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      active = false;
    };
  }, [enabled, entityId, entityType, reset, userId]);

  useEffect(() => {
    if (!enabled || !draftStorageAvailable()) {
      return;
    }
    let timeout: number | undefined;
    const subscription = watch((values) => {
      if (!loaded.current) {
        return;
      }
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        void offlineDb.drafts
          .where('[entityType+entityId]')
          .equals([entityType, entityId ?? 0])
          .filter((draft) => draft.userId === userId)
          .delete()
          .then(() =>
            offlineDb.drafts.add({
              entityId: entityId ?? 0,
              entityType,
              payload: values,
              updatedAt: new Date().toISOString(),
              userId
            })
          )
          .catch(() => undefined);
      }, 400);
    });
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [enabled, entityId, entityType, userId, watch]);
}

export async function clearOfflineDraft(
  entityType: string,
  entityId?: number,
  userId?: number
) {
  if (!draftStorageAvailable()) {
    return;
  }
  await offlineDb.drafts
    .where('[entityType+entityId]')
    .equals([entityType, entityId ?? 0])
    .filter((draft) => draft.userId === userId)
    .delete()
    .catch(() => undefined);
}
