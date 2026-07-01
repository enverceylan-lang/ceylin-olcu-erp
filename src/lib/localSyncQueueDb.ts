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
): Promise<void> {
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
    
    // We do not log personal details. Only technical confirmation.
    // console.log(`[SyncQueue] Enqueued ${operation} for ${entityType} ${entityId}`);
  } catch (err) {
    // We catch and log so that the main application logic (e.g. saving to localCustomerDb) NEVER fails
    // just because queuing the event failed.
    console.error('[SyncQueue] Failed to enqueue event (Local operation continues safely):', err);
  }
}

export async function getPendingEvents(): Promise<SyncEvent[]> {
  try {
    return await localSyncQueueDb.pendingSyncEvents.where('syncStatus').equals('PENDING').toArray();
  } catch (err) {
    return [];
  }
}
