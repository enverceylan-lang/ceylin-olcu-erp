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

export async function enqueueSyncEvent(
  entityType: SyncEvent['entityType'],
  entityId: string,
  operation: SyncEvent['operation'],
  patch: any
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const changeId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'chg-' + Math.random().toString(36).substr(2, 9);
      
    const deviceId = getDeviceId();
    // Safely get user from auth store state without hooks
    const currentUser = useAuthStore.getState().currentUser;
    const userId = currentUser?.id || 'unknown';

    const fullEvent: SyncEvent = {
      changeId,
      entityType,
      entityId,
      operation,
      patch: sanitizePatch(patch),
      deviceId,
      userId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'PENDING',
      retryCount: 0
    };

    await localSyncQueueDb.pendingSyncEvents.put(fullEvent);
    
    // Debug for user
    if (typeof window !== 'undefined') {
      console.log(`[SyncQueue] Successfully enqueued ${operation} for ${entityType} ${entityId}`);
      // alert(`[DEBUG] Queue Event Created: TRUE\nType: ${entityType}\nStatus: PENDING`);
    }
    return true;
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      alert(`[DEBUG] Queue Event Created: FALSE\nHATA: ${err.message}`);
    }
    console.error('[SyncQueue] Failed to enqueue event:', err);
    return false;
  }
}

export async function getPendingSyncEvents(limit: number = 50): Promise<SyncEvent[]> {
  try {
    return await localSyncQueueDb.pendingSyncEvents
      .where('syncStatus')
      .equals('PENDING')
      .limit(limit)
      .toArray();
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
