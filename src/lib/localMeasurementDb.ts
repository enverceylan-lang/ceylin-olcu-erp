import Dexie, { type Table } from 'dexie';
import { MeasurementRecord } from '@/store/measurementStore';
import {
  enqueueSyncEvent,
  enqueueSyncEventDetailed
} from './localSyncQueueDb';
import {
  saveTransferReceipt,
  type TransferReceipt
} from './localDraftDb';

/**
 * Sync payload içindeki büyük medya verisini çıkarır,
 * fakat gerekli medya referans bilgilerini korur.
 */
function syncSanitizeMedia(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];

  return arr
    .map((item) => {
      if (typeof item === 'string') {
        if (item.startsWith('data:') || item.length > 512) return null;
        return item;
      }

      if (typeof item === 'object' && item !== null) {
        const { data, base64, ...rest } = item as any;
        return rest;
      }

      return item;
    })
    .filter(Boolean);
}

/**
 * Ölçü payload'ını derinlemesine temizler.
 * Fotoğraf/video binary içeriğini kuyruğa koymaz.
 */
function deepSyncSanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepSyncSanitize(item));

  const result: any = {};

  for (const key of Object.keys(obj)) {
    if (key === 'photos' || key === 'videos') {
      result[key] = syncSanitizeMedia(Array.isArray(obj[key]) ? obj[key] : []);
    } else {
      result[key] = deepSyncSanitize(obj[key]);
    }
  }

  return result;
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

export async function saveLocalMeasurementWithSync(
  measurement: MeasurementRecord,
  username: string
): Promise<void> {
  try {
    await localMeasurementDb.measurements.put(measurement);

    const payload = {
      id: measurement.id,
      customerId: measurement.customerId,
      roomId: measurement.roomId,
      windowId: measurement.windowId,
      entity: 'measurement',
      data: deepSyncSanitize(measurement),
      timestamp: new Date().toISOString()
    };

    const enqueueResult = await enqueueSyncEventDetailed(
      'MEASUREMENT',
      measurement.id,
      'UPDATE',
      payload
    );

    if (
      enqueueResult.success &&
      enqueueResult.changeId &&
      enqueueResult.deviceId &&
      enqueueResult.userId &&
      enqueueResult.createdAt
    ) {
      const receipt: TransferReceipt = {
        transferId: enqueueResult.changeId,
        entityType: 'MEASUREMENT',
        entityId: measurement.id,
        senderUserId: enqueueResult.userId,
        senderDeviceId: enqueueResult.deviceId,
        status: 'SENT',
        sentAt: enqueueResult.createdAt,
        entityVersion: Number((measurement as any).version || 1),
        createdAt: enqueueResult.createdAt,
        updatedAt: enqueueResult.createdAt
      };

      await saveTransferReceipt(receipt);
    }
  } catch (err) {
    console.error('Local ölçü sync ile kaydedilirken hata:', err);
  }
}

export async function deleteLocalMeasurement(id: string, username: string): Promise<void> {
  try {
    const existing = await localMeasurementDb.measurements.get(id);
    if (!existing) return;

    const deleted = {
      ...existing,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: username
    };

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

export async function batchSaveLocalMeasurements(
  measurements: MeasurementRecord[]
): Promise<void> {
  try {
    await localMeasurementDb.measurements.bulkPut(measurements);
  } catch (err) {
    console.error("Toplu local ölçü kaydedilirken hata:", err);
  }
}