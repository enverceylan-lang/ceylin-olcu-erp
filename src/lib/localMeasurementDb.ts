import { readErpScope } from './customerTreeScope';
import Dexie, { type Table } from 'dexie';
import { MeasurementRecord } from '@/store/measurementStore';
import {
  activateBlockedSyncEvent,
  discardBlockedSyncEvent,
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
function syncSanitizeMedia(arr: unknown[]): unknown[] {
  if (!Array.isArray(arr)) return [];

  return arr
    .map((item) => {
      if (typeof item === 'string') {
        if (item.startsWith('data:') || item.length > 512) return null;
        return item;
      }

      if (typeof item === 'object' && item !== null) {
        const mediaItem = item as Record<string, unknown>;
        const { data, base64, ...rest } = mediaItem;
        void data;
        void base64;
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
function deepSyncSanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => deepSyncSanitize(item));

  const source = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    if (key === 'photos' || key === 'videos') {
      result[key] = syncSanitizeMedia(Array.isArray(source[key]) ? source[key] : []);
    } else {
      result[key] = deepSyncSanitize(source[key]);
    }
  }

  return result;
}


function normalizeSignaturePart(
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replaceAll("|", "%7C")
    .replaceAll("~", "%7E");
}

function buildArraySignature(
  value: unknown,
  keys: string[],
): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        return "!INVALID";
      }

      const record =
        item as Record<string, unknown>;

      return keys
        .map((key) =>
          normalizeSignaturePart(
            record[key],
          ),
        )
        .join("|");
    })
    .join("~");
}

function buildMeasurementSyncIntegrity(
  measurement: MeasurementRecord,
): NonNullable<MeasurementRecord["syncIntegrity"]> {
  const rawValues =
    measurement.rawValues &&
    typeof measurement.rawValues === "object" &&
    !Array.isArray(measurement.rawValues)
      ? measurement.rawValues
      : {};

  const facadeSegments =
    rawValues.facadeSegments;

  const plicellCamListesi =
    rawValues.plicellCamListesi;

  const selectedProducts =
    measurement.selectedProducts;

  return {
    schemaVersion: 2,
    completeness: "FULL",
    facadeSegmentCount:
      Array.isArray(facadeSegments)
        ? facadeSegments.length
        : 0,
    plicellGlassCount:
      Array.isArray(plicellCamListesi)
        ? plicellCamListesi.length
        : 0,
    selectedProductCount:
      Array.isArray(selectedProducts)
        ? selectedProducts.length
        : 0,
    facadeShapeSignature:
      buildArraySignature(
        facadeSegments,
        ["id", "type", "widthCm"],
      ),
    plicellShapeSignature:
      buildArraySignature(
        plicellCamListesi,
        [
          "id",
          "widthCm",
          "heightCm",
          "sourceMode",
        ],
      ),
    selectedProductSignature:
      buildArraySignature(
        selectedProducts,
        ["productType", "isActive"],
      ),
  };
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

function normalizeMeasurementLinks(measurement: MeasurementRecord): MeasurementRecord {
  const openingId = String(measurement.openingId || "").trim();
  const windowId = String(measurement.windowId || "").trim();

  if (openingId && windowId && openingId !== windowId) {
    throw new Error("MEASUREMENT_OPENING_WINDOW_MISMATCH");
  }

  const canonicalOpeningId = openingId || windowId;
  if (!canonicalOpeningId) {
    throw new Error("MEASUREMENT_OPENING_ID_MISSING");
  }

  return {
    ...measurement,
    openingId: canonicalOpeningId,
    windowId: windowId || canonicalOpeningId
  };
}
export async function loadLocalMeasurements(): Promise<MeasurementRecord[]> {
  try {
    return await localMeasurementDb.measurements.toArray();
  } catch (err) {
    console.error("Local ölçü verileri yüklenirken hata:", err);
    return [];
  }
}

export async function getLocalMeasurementById(
  id: string
): Promise<MeasurementRecord | undefined> {
  try {
    return await localMeasurementDb.measurements.get(id);
  } catch (error: unknown) {
    console.error("Local ölçü ID ile okunurken hata:", error);
    return undefined;
  }
}
export async function saveLocalMeasurement(measurement: MeasurementRecord): Promise<void> {
  try {
    await localMeasurementDb.measurements.put(normalizeMeasurementLinks(measurement));
  } catch (err) {
    console.error("Local ölçü kaydedilirken hata:", err);
    throw err;
  }
}

export async function saveLocalMeasurementWithSync(
  measurement: MeasurementRecord,
  username: string
): Promise<void> {
  void username;

  const existingMeasurement =
    await localMeasurementDb.measurements.get(measurement.id);
  const normalizedMeasurement = normalizeMeasurementLinks(measurement);

  const operation = existingMeasurement ? 'UPDATE' : 'INSERT';
  const expectedVersion = existingMeasurement
    ? Number(existingMeasurement.version)
    : 0;

  if (
    existingMeasurement &&
    (!Number.isInteger(expectedVersion) || expectedVersion < 1)
  ) {
    throw new Error("MEASUREMENT_EXPECTED_VERSION_MISSING");
  }

  const measurementScope = readErpScope(normalizedMeasurement);

  if (!measurementScope) {
    throw new Error("MEASUREMENT_SCOPE_MISSING");
  }

  const sanitizedMeasurement =
    deepSyncSanitize(
      normalizedMeasurement,
    ) as MeasurementRecord;

  const payload = {
    ...measurementScope,
    id: normalizedMeasurement.id,
    customerId: normalizedMeasurement.customerId,
    roomId: normalizedMeasurement.roomId,
    openingId: normalizedMeasurement.openingId,
    windowId: normalizedMeasurement.windowId,
    entity: 'measurement',
    data: {
      ...sanitizedMeasurement,
      syncIntegrity:
        buildMeasurementSyncIntegrity(
          normalizedMeasurement,
        ),
    },
    timestamp: new Date().toISOString()
  };

  const enqueueResult = await enqueueSyncEventDetailed(
    'MEASUREMENT',
    measurement.id,
    operation,
    payload,
    expectedVersion,
    'BLOCKED'
  );

  if (
    !enqueueResult.success ||
    !enqueueResult.changeId ||
    !enqueueResult.deviceId ||
    !enqueueResult.userId ||
    !enqueueResult.createdAt
  ) {
    throw new Error("MEASUREMENT_SYNC_QUEUE_CREATE_FAILED");
  }

  try {
    await localMeasurementDb.measurements.put(normalizedMeasurement);
  } catch (error: unknown) {
    if (enqueueResult.createdNew) {
      const discarded =
        await discardBlockedSyncEvent(enqueueResult.changeId);

      if (!discarded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }
    }

    throw error;
  }

  if (enqueueResult.createdNew) {
    const activated =
      await activateBlockedSyncEvent(enqueueResult.changeId);

    if (!activated) {
      let rollbackSucceeded = false;

      try {
        if (existingMeasurement) {
          await localMeasurementDb.measurements.put(existingMeasurement);
        } else {
          await localMeasurementDb.measurements.delete(measurement.id);
        }

        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }

      if (!rollbackSucceeded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }

      const discarded =
        await discardBlockedSyncEvent(enqueueResult.changeId);

      if (!discarded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }

      throw new Error("MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED");
    }
  }

  const receipt: TransferReceipt = {
    transferId: enqueueResult.changeId,
    entityType: 'MEASUREMENT',
    entityId: measurement.id,
    senderUserId: enqueueResult.userId,
    senderDeviceId: enqueueResult.deviceId,
    status: 'SENT',
    sentAt: enqueueResult.createdAt,
    entityVersion: expectedVersion,
    createdAt: enqueueResult.createdAt,
    updatedAt: enqueueResult.createdAt
  };

  await saveTransferReceipt(receipt);
}
export async function deleteLocalMeasurement(
  id: string,
  username: string
): Promise<void> {
  const existing = await localMeasurementDb.measurements.get(id);
  if (!existing) return;

  const expectedVersion = Number(existing.version);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("MEASUREMENT_EXPECTED_VERSION_MISSING");
  }

  const deleted = {
    ...existing,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: username
  };

  const deletedScope = readErpScope(deleted);

  if (!deletedScope) {
    throw new Error("MEASUREMENT_SCOPE_MISSING");
  }

  const payload = {
    ...deletedScope,
    id,
    customerId: deleted.customerId,
    roomId: deleted.roomId,
    openingId: deleted.openingId,
    windowId: deleted.windowId,
    entity: 'measurement',
    isDeleted: true,
    deletedAt: deleted.deletedAt,
    timestamp: new Date().toISOString()
  };

  const enqueueResult = await enqueueSyncEventDetailed(
    'MEASUREMENT',
    deleted.id,
    'SOFT_DELETE',
    payload,
    expectedVersion,
    'BLOCKED'
  );

  if (!enqueueResult.success || !enqueueResult.changeId) {
    throw new Error("MEASUREMENT_SYNC_QUEUE_CREATE_FAILED");
  }

  try {
    await localMeasurementDb.measurements.put(deleted);
  } catch (error: unknown) {
    if (enqueueResult.createdNew) {
      const discarded =
        await discardBlockedSyncEvent(enqueueResult.changeId);

      if (!discarded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }
    }

    throw error;
  }

  if (enqueueResult.createdNew) {
    const activated =
      await activateBlockedSyncEvent(enqueueResult.changeId);

    if (!activated) {
      let rollbackSucceeded = false;

      try {
        await localMeasurementDb.measurements.put(existing);
        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }

      if (!rollbackSucceeded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }

      const discarded =
        await discardBlockedSyncEvent(enqueueResult.changeId);

      if (!discarded) {
        throw new Error("MEASUREMENT_SYNC_COMPENSATION_FAILED");
      }

      throw new Error("MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED");
    }
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
    await localMeasurementDb.measurements.bulkPut(measurements.map(normalizeMeasurementLinks));
  } catch (err) {
    console.error("Toplu local ölçü kaydedilirken hata:", err);
    throw err;
  }
}
