import Dexie, { type Table } from 'dexie';
import { getDeviceId } from './deviceIdentity';
import { useAuthStore } from '@/store/useAuthStore';

export interface SyncEvent {
  changeId: string;
  entityType: 'CUSTOMER' | 'ROOM' | 'OPENING' | 'MEASUREMENT' | 'DRAFT';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'SOFT_DELETE';
  patch: any;
  deviceId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'ERROR';
  retryCount: number;
}

class LocalSyncQueueDatabase extends Dexie {
  pendingSyncEvents!: Table<SyncEvent, string>;

  constructor() {
    super('CeylinLocalSyncQueueDb');
    this.version(1).stores({
      pendingSyncEvents: 'changeId, entityType, entityId, syncStatus'
    });
  }
}

export const localSyncQueueDb = new LocalSyncQueueDatabase();

/**
 * Safely strips out photos, videos, and large base64 data to ensure
 * media is NOT included in the delta sync queue.
 */
function sanitizePatch(patch: any): any {
  if (!patch || typeof patch !== 'object') return patch;
  
  const sanitized = JSON.parse(JSON.stringify(patch));
  
  const stripMedia = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    delete obj.photos;
    delete obj.videos;
    delete obj.addressPhotos;
  };

  stripMedia(sanitized);

  // If patch is a full Customer object, deeply strip media
  if (Array.isArray(sanitized.rooms)) {
    sanitized.rooms.forEach((room: any) => {
      stripMedia(room);
      if (Array.isArray(room.windows)) {
        room.windows.forEach((win: any) => {
          stripMedia(win);
          if (Array.isArray(win.products)) {
            win.products.forEach((prod: any) => {
              stripMedia(prod);
            });
          }
        });
      }
    });
  }

  return sanitized;
}

const SYNC_COMPARISON_IGNORED_KEYS = new Set([
  'updatedAt',
  'syncStatus',
  'retryCount',
  'lastSyncedAt',
  'lastReceivedAt'
]);

function normalizePatchForComparison(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalizePatchForComparison);
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, any> = {};

    for (const key of Object.keys(value).sort()) {
      if (SYNC_COMPARISON_IGNORED_KEYS.has(key)) continue;
      normalized[key] = normalizePatchForComparison(value[key]);
    }

    return normalized;
  }

  return value;
}

function getComparablePatchSignature(patch: any): string {
  return JSON.stringify(
    normalizePatchForComparison(
      sanitizePatch(patch)
    )
  );
}
export interface EnqueueSyncResult {
  success: boolean;
  changeId?: string;
  deviceId?: string;
  userId?: string;
  createdAt?: string;
}

export async function enqueueSyncEventDetailed(
  entityType: SyncEvent['entityType'],
  entityId: string,
  operation: SyncEvent['operation'],
  patch: any
): Promise<EnqueueSyncResult> {
  try {
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const sanitizedPatch = sanitizePatch(patch);

    if (entityType === 'MEASUREMENT') {
      const comparableSignature =
        getComparablePatchSignature(sanitizedPatch);

      const priorEvents = await localSyncQueueDb.pendingSyncEvents
        .where('entityId')
        .equals(entityId)
        .filter((event) =>
          event.entityType === entityType &&
          event.operation === operation &&
          event.deviceId === deviceId
        )
        .toArray();

      const equivalentEvent = priorEvents
        .sort((a, b) =>
          String(b.updatedAt || b.createdAt).localeCompare(
            String(a.updatedAt || a.createdAt)
          )
        )
        .find((event) =>
          getComparablePatchSignature(event.patch) === comparableSignature
        );

      if (equivalentEvent) {
        if (equivalentEvent.syncStatus === 'ERROR') {
          await localSyncQueueDb.pendingSyncEvents.update(
            equivalentEvent.changeId,
            {
              syncStatus: 'PENDING',
              updatedAt: now
            }
          );
        }

        return {
          success: true,
          changeId: equivalentEvent.changeId,
          deviceId: equivalentEvent.deviceId,
          userId: equivalentEvent.userId,
          createdAt: equivalentEvent.createdAt
        };
      }
    }

    const changeId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `chg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const currentUser = useAuthStore.getState().currentUser;
    const userId = currentUser?.id || 'unknown';

    const fullEvent: SyncEvent = {
      changeId,
      entityType,
      entityId,
      operation,
      patch: sanitizedPatch,
      deviceId,
      userId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
      retryCount: 0
    };

    await localSyncQueueDb.pendingSyncEvents.put(fullEvent);

    if (typeof window !== 'undefined') {
      console.log(
        `[SyncQueue] Successfully enqueued ${operation} for ${entityType} ${entityId}`
      );
    }

    return {
      success: true,
      changeId,
      deviceId,
      userId,
      createdAt: now
    };
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      console.error('[SyncQueue] Queue event could not be created.');
    }

    console.error('[SyncQueue] Failed to enqueue event:', err);

    return {
      success: false
    };
  }
}

export async function enqueueSyncEvent(
  entityType: SyncEvent['entityType'],
  entityId: string,
  operation: SyncEvent['operation'],
  patch: any
): Promise<boolean> {
  const result = await enqueueSyncEventDetailed(
    entityType,
    entityId,
    operation,
    patch
  );

  return result.success;
}

export async function getPendingSyncEvents(limit: number = 50): Promise<SyncEvent[]> {
  try {
    const retryableEvents = await localSyncQueueDb.pendingSyncEvents
      .where('syncStatus')
      .anyOf(['PENDING', 'ERROR'])
      .sortBy('createdAt');

    const selectedEvents = retryableEvents.slice(0, limit);
    const errorEvents = selectedEvents.filter(
      (event) => event.syncStatus === 'ERROR',
    );

    if (errorEvents.length > 0) {
      const now = new Date().toISOString();

      await localSyncQueueDb.pendingSyncEvents.bulkUpdate(
        errorEvents.map((event) => ({
          key: event.changeId,
          changes: {
            syncStatus: 'PENDING',
            updatedAt: now,
          },
        })),
      );

      return selectedEvents.map((event) =>
        event.syncStatus === 'ERROR'
          ? {
              ...event,
              syncStatus: 'PENDING' as const,
              updatedAt: now,
            }
          : event,
      );
    }

    return selectedEvents;
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      alert(`[DEBUG] getPendingSyncEvents failed: ${err.message}`);
    }
    console.error('[SyncQueue] getPendingSyncEvents failed:', err);
    return [];
  }
}

export async function markSyncEventsSynced(changeIds: string[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    await localSyncQueueDb.pendingSyncEvents.bulkUpdate(
      changeIds.map(id => ({
        key: id,
        changes: { syncStatus: 'SYNCED', updatedAt: now }
      }))
    );
  } catch (err) {
    console.error('[SyncQueue] Failed to mark events as SYNCED:', err);
  }
}

export async function markSyncEventsError(changeIds: string[], errorMessage?: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    // Dexie bulkUpdate needs array of {key, changes}. Since we need to increment retryCount,
    // we should ideally fetch them first or do a loop. Since changeIds is usually small for a batch:
    for (const id of changeIds) {
      const event = await localSyncQueueDb.pendingSyncEvents.get(id);
      if (event) {
        await localSyncQueueDb.pendingSyncEvents.update(id, {
          syncStatus: 'ERROR',
          updatedAt: now,
          retryCount: (event.retryCount || 0) + 1
          // We don't store errorMessage in DB for V1, just print it
        });
      }
    }
  } catch (err) {
    console.error('[SyncQueue] Failed to mark events as ERROR:', err);
  }
}
