import Dexie, { type Table } from 'dexie';
import { MeasurementRecord } from '@/store/measurementStore';
import { enqueueSyncEvent } from './localSyncQueueDb';


/**
 * Strips only the heavy binary/base64 content (the `data` field) from media
 * objects for SYNC payloads. Metadata (localKey, thumbnailRef, mimeType, size,
 * url) is kept so the receiving device can request the full media.
 * Raw base64/data-URI strings are replaced with null and filtered out.
 */
function syncSanitizeMedia(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(item => {
      if (typeof item === 'string') {
        // raw data-URL or base64 blob — omit from sync payload
        if (item.startsWith('data:') || item.length > 512) return null;
        return item;
      }
      if (typeof item === 'object' && item !== null) {
        // Strip only the binary payload, keep all reference metadata
        const { data, base64, ...rest } = item as any;
        return rest;
      }
      return item;
    })
    .filter(Boolean);
}

/**
 * Strips ALL media binary AND metadata from an object for full deep-clean.
 * Used only for the sync payload when we want to guarantee no large fields.
 */
function deepSyncSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => deepSyncSanitize(item));

  const res: any = {};
  for (const key of Object.keys(obj)) {
    if (key === 'photos' || key === 'videos') {
      res[key] = syncSanitizeMedia(Array.isArray(obj[key]) ? obj[key] : []);
    } else {
      res[key] = deepSyncSanitize(obj[key]);
    }
  }
  return res;
}

class LocalMeasurementDatabase extends Dexie {
  measurements!: Table<MeasurementRecord, string>;

  constructor() {
    super('CeylinLocalMeasurementDb');
    this.version(1).stores({
      measurements: 'id, customerId, roomId, windowId, isDeleted, isArchived, status'
    });
  }
}

export const localMeasurementDb = new LocalMeasurementDatabase();

export async function loadLocalMeasurements(): Promise<MeasurementRecord[]> {
  try {
    return await localMeasurementDb.measurements.toArray();
  } catch (err) {
    console.error("Local ölçü verileri yüklenirken hata:", err);
    return [];
  }
}

export async function saveLocalMeasurement(measurement: MeasurementRecord): Promise<void> {
  try {
    await localMeasurementDb.measurements.put(measurement);
  } catch (err) {
    console.error("Local ölçü kaydedilirken hata:", err);
  }
}

export async function saveLocalMeasurementWithSync(measurement: MeasurementRecord, username: string): Promise<void> {
  try {
    // Save full record to local IndexedDB (media metadata is preserved)
    await localMeasurementDb.measurements.put(measurement);
    
    // Build a sync payload with only metadata (no binary data/base64)
    const payload = {
      id: measurement.id,
      customerId: measurement.customerId,
      roomId: measurement.roomId,
      windowId: measurement.windowId,
      entity: 'measurement',
      data: deepSyncSanitize(measurement),
      timestamp: new Date().toISOString()
    };
    
    await enqueueSyncEvent('MEASUREMENT', measurement.id, 'UPDATE', payload);
  } catch (err) {
    console.error('Local ölçü sync ile kaydedilirken hata:', err);
  }
}

export async function deleteLocalMeasurement(id: string, username: string): Promise<void> {
  try {
    const existing = await localMeasurementDb.measurements.get(id);
    if (!existing) return;
    
    const deleted = { ...existing, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: username };
    await localMeasurementDb.measurements.put(deleted);
    
    const payload = {
      id,
      entity: 'measurement',
      isDeleted: true,
      deletedAt: deleted.deletedAt,
      timestamp: new Date().toISOString()
    };

    await enqueueSyncEvent('MEASUREMENT', deleted.id, 'UPDATE', payload);
  } catch (err) {
    console.error("Local ölçü silinirken hata:", err);
  }
}

export async function clearLocalMeasurements(): Promise<void> {
  try {
    await localMeasurementDb.measurements.clear();
  } catch (err) {
    console.error("Local ölçü veritabanı temizlenirken hata:", err);
  }
}

export async function batchSaveLocalMeasurements(measurements: MeasurementRecord[]): Promise<void> {
  try {
    await localMeasurementDb.measurements.bulkPut(measurements);
  } catch (err) {
    console.error("Toplu local ölçü kaydedilirken hata:", err);
  }
}
