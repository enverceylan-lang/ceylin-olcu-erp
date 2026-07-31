import Dexie, { type Table } from 'dexie';
import { getDeviceId } from './deviceIdentity';
import { useAuthStore } from '@/store/useAuthStore';

export interface SyncPatchProduct {
  rawValues?: Record<string, unknown>;
}

export interface SyncPatchOpening {
  products?: SyncPatchProduct[];
  measurements?: SyncPatchProduct[];
}

export interface SyncPatchRoom {
  windows?: SyncPatchOpening[];
  openings?: SyncPatchOpening[];
}

export interface SyncPatch {
  updatedAt?: string;
  id?: string;
  entity?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  timestamp?: string;
  customerId?: string;
  roomId?: string;
  windowId?: string;
  syncIntent?: string;
  rooms?: SyncPatchRoom[];
}

export interface SyncEvent {
  changeId: string;
  entityType: 'CUSTOMER' | 'ROOM' | 'OPENING' | 'MEASUREMENT' | 'DRAFT';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'SOFT_DELETE';
  patch: SyncPatch;
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
function sanitizePatch<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizePatch(item)) as unknown as T;
  }

  if (typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    if (key === 'photos' || key === 'videos' || key === 'addressPhotos') {
      continue;
    }

    sanitized[key] = sanitizePatch(source[key]);
  }

  return sanitized as T;
}

const SYNC_COMPARISON_IGNORED_KEYS = new Set([
  'updatedAt',
  'syncStatus',
  'retryCount',
  'lastSyncedAt',
  'lastReceivedAt'
]);

function normalizePatchForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizePatchForComparison(item));
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      if (SYNC_COMPARISON_IGNORED_KEYS.has(key)) continue;
      normalized[key] = normalizePatchForComparison(source[key]);
    }

    return normalized;
  }

  return value;
}

function getComparablePatchSignature(patch: unknown): string {
  return JSON.stringify(
    normalizePatchForComparison(
      sanitizePatch(patch)
    )
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  patch: SyncPatch
): Promise<EnqueueSyncResult> {
  try {
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const sanitizedPatch = sanitizePatch(patch);

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

    const latestEvent = priorEvents.sort((a, b) =>
      String(b.updatedAt || b.createdAt).localeCompare(
        String(a.updatedAt || a.createdAt)
      )
    )[0];

    if (
      latestEvent &&
      getComparablePatchSignature(latestEvent.patch) === comparableSignature
    ) {
      if (latestEvent.syncStatus === 'ERROR') {
        await localSyncQueueDb.pendingSyncEvents.update(
          latestEvent.changeId,
          {
            syncStatus: 'PENDING',
            updatedAt: now
          }
        );
      }

      return {
        success: true,
        changeId: latestEvent.changeId,
        deviceId: latestEvent.deviceId,
        userId: latestEvent.userId,
        createdAt: latestEvent.createdAt
      };
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
  } catch (err: unknown) {
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
  patch: SyncPatch
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

    const latestBySignature = new Map<string, SyncEvent>();
    const duplicateChangeIds: string[] = [];

    for (const event of retryableEvents) {
      const duplicateKey = [
        event.entityType,
        event.entityId,
        event.operation,
        event.deviceId,
        getComparablePatchSignature(event.patch)
      ].join('|');

      const existing = latestBySignature.get(duplicateKey);

      if (!existing) {
        latestBySignature.set(duplicateKey, event);
        continue;
      }

      const existingTime = String(existing.updatedAt || existing.createdAt);
      const eventTime = String(event.updatedAt || event.createdAt);

      if (eventTime > existingTime) {
        duplicateChangeIds.push(existing.changeId);
        latestBySignature.set(duplicateKey, event);
      } else {
        duplicateChangeIds.push(event.changeId);
      }
    }

    if (duplicateChangeIds.length > 0) {
      const now = new Date().toISOString();

      await localSyncQueueDb.pendingSyncEvents.bulkUpdate(
        duplicateChangeIds.map((changeId) => ({
          key: changeId,
          changes: {
            syncStatus: 'SYNCED',
            updatedAt: now
          }
        }))
      );
    }

    const compactedEvents = Array.from(latestBySignature.values()).sort(
      (a, b) => String(a.createdAt).localeCompare(String(b.createdAt))
    );

    const selectedEvents = compactedEvents.slice(0, limit);
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
  } catch (err: unknown) {
    if (typeof window !== 'undefined') {
      alert(`[DEBUG] getPendingSyncEvents failed: ${getErrorMessage(err)}`);
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
  void errorMessage;
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
