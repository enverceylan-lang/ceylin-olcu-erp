import {
  optionalScopeConflicts,
  readErpScope,
  stripErpScope,
} from './customerTreeScope';
import type { ErpScope } from './erpScope';
import Dexie, { type Table } from 'dexie';
import type { MeasurementRecord } from '@/store/measurementStore';
import { localCustomerDb } from './localCustomerDb';
import {
  activateBlockedSyncEvent,
  discardBlockedSyncEvent,
  discardBlockedSyncEventsAtomically,
  enqueueDeferredMeasurementMutationAfterPredecessor,
  enqueueSyncEventDetailed,
  finalizeMeasurementMutationQueueAtomically,
  markDeferredMeasurementMutationsReadyAtomically,
  rollbackDeferredMeasurementUpdate,
  type DeferredMeasurementMutationResult
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

  return stripErpScope({
    ...measurement,
    openingId: canonicalOpeningId || undefined,
    windowId: canonicalOpeningId
      ? (windowId || canonicalOpeningId)
      : undefined
  });
}

export async function resolveMeasurementOwnerScope(
  measurement: MeasurementRecord,
): Promise<ErpScope> {
  const customerId = String(measurement.customerId || "").trim();
  if (!customerId) {
    throw new Error("MEASUREMENT_CUSTOMER_ID_MISSING");
  }

  const customer = await localCustomerDb.customers.get(customerId);
  if (!customer) {
    throw new Error("MEASUREMENT_PARENT_CUSTOMER_LOCAL_MISSING");
  }

  const scope = readErpScope(customer);
  if (!scope) {
    throw new Error("MEASUREMENT_CUSTOMER_SCOPE_MISSING");
  }

  if (optionalScopeConflicts(measurement, scope)) {
    throw new Error("MEASUREMENT_SCOPE_PARENT_MISMATCH");
  }

  const room = (customer.rooms || []).find(
    (item) => item.id === measurement.roomId && !item.isDeleted,
  );
  if (!room) {
    throw new Error("MEASUREMENT_PARENT_ROOM_LOCAL_MISSING");
  }
  if (optionalScopeConflicts(room, scope)) {
    throw new Error("MEASUREMENT_SCOPE_PARENT_MISMATCH");
  }

  const openingId = String(
    measurement.openingId || measurement.windowId || "",
  ).trim();

  if (openingId) {
    const opening = (room.windows || []).find(
      (item) => item.id === openingId && !item.isDeleted,
    );
    if (!opening) {
      throw new Error("MEASUREMENT_PARENT_OPENING_LOCAL_MISSING");
    }
    if (optionalScopeConflicts(opening, scope)) {
      throw new Error("MEASUREMENT_SCOPE_PARENT_MISMATCH");
    }
  }

  return scope;
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
function readCanonicalMeasurementVersion(
  measurement: MeasurementRecord | undefined,
): number | null {
  if (!measurement) return null;

  const version =
    Number(measurement.version);

  return (
    Number.isInteger(version) &&
    version >= 1
  )
    ? version
    : null;
}

async function putLocalMeasurementPreservingCanonicalVersion(
  measurement: MeasurementRecord,
): Promise<MeasurementRecord> {
  const normalized =
    normalizeMeasurementLinks(measurement);

  return localMeasurementDb.transaction(
    'rw',
    localMeasurementDb.measurements,
    async () => {
      const current =
        await localMeasurementDb.measurements.get(
          normalized.id,
        );

      const currentVersion =
        readCanonicalMeasurementVersion(
          current,
        );
      const incomingVersion =
        readCanonicalMeasurementVersion(
          normalized,
        );

      const canonicalVersion =
        currentVersion === null
          ? incomingVersion
          : incomingVersion === null
            ? currentVersion
            : Math.max(
                currentVersion,
                incomingVersion,
              );

      const persisted =
        canonicalVersion === null
          ? normalized
          : {
              ...normalized,
              version: canonicalVersion,
            };

      await localMeasurementDb.measurements.put(
        persisted,
      );

      return persisted;
    },
  );
}

export async function advanceLocalMeasurementCanonicalVersion(
  id: string,
  canonicalVersion: number,
): Promise<MeasurementRecord | undefined> {
  if (
    !Number.isInteger(canonicalVersion) ||
    canonicalVersion < 1
  ) {
    throw new Error(
      "MEASUREMENT_CANONICAL_VERSION_INVALID",
    );
  }

  return localMeasurementDb.transaction(
    'rw',
    localMeasurementDb.measurements,
    async () => {
      const current =
        await localMeasurementDb.measurements.get(
          id,
        );

      if (!current) {
        return undefined;
      }

      const currentVersion =
        readCanonicalMeasurementVersion(
          current,
        );

      const nextVersion =
        currentVersion === null
          ? canonicalVersion
          : Math.max(
              currentVersion,
              canonicalVersion,
            );

      const updated =
        normalizeMeasurementLinks({
          ...current,
          version: nextVersion,
        });

      await localMeasurementDb.measurements.put(
        updated,
      );

      return updated;
    },
  );
}

async function restoreLocalMeasurementsPreservingCanonicalVersion(
  measurements: MeasurementRecord[],
): Promise<boolean> {
  try {
    await localMeasurementDb.transaction(
      'rw',
      localMeasurementDb.measurements,
      async () => {
        for (const measurement of measurements) {
          const normalized =
            normalizeMeasurementLinks(
              measurement,
            );

          const current =
            await localMeasurementDb.measurements.get(
              normalized.id,
            );

          const currentVersion =
            readCanonicalMeasurementVersion(
              current,
            );
          const originalVersion =
            readCanonicalMeasurementVersion(
              normalized,
            );

          const canonicalVersion =
            currentVersion === null
              ? originalVersion
              : originalVersion === null
                ? currentVersion
                : Math.max(
                    currentVersion,
                    originalVersion,
                  );

          await localMeasurementDb.measurements.put(
            canonicalVersion === null
              ? normalized
              : {
                  ...normalized,
                  version:
                    canonicalVersion,
                },
          );
        }
      },
    );

    return true;
  } catch {
    return false;
  }
}

async function rollbackDeferredMeasurementResults(
  results: DeferredMeasurementMutationResult[],
): Promise<boolean> {
  let success = true;

  for (
    let index = results.length - 1;
    index >= 0;
    index--
  ) {
    const rolledBack =
      await rollbackDeferredMeasurementUpdate(
        results[index],
      );

    if (!rolledBack) {
      success = false;
    }
  }

  return success;
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

  const ownerScope =
    await resolveMeasurementOwnerScope(
      measurement,
    );
  const normalizedMeasurement =
    normalizeMeasurementLinks(
      measurement,
    );
  const existingMeasurement =
    await localMeasurementDb.measurements.get(
      measurement.id,
    );

  const operation =
    existingMeasurement
      ? 'UPDATE'
      : 'INSERT';

  const sanitizedMeasurement =
    deepSyncSanitize(
      normalizedMeasurement,
    ) as MeasurementRecord;

  const payload = {
    ...ownerScope,
    id: normalizedMeasurement.id,
    customerId:
      normalizedMeasurement.customerId,
    roomId:
      normalizedMeasurement.roomId,
    openingId:
      normalizedMeasurement.openingId,
    windowId:
      normalizedMeasurement.windowId,
    entity: 'measurement',
    data: {
      ...sanitizedMeasurement,
      syncIntegrity:
        buildMeasurementSyncIntegrity(
          normalizedMeasurement,
        ),
    },
    timestamp:
      new Date().toISOString()
  };

  if (existingMeasurement) {
    const deferredResult =
      await enqueueDeferredMeasurementMutationAfterPredecessor(
        measurement.id,
        'UPDATE',
        payload,
        ownerScope,
      );

    if (!deferredResult.success) {
      throw new Error(
        "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
      );
    }

    if (deferredResult.deferred) {
      if (!deferredResult.changeId) {
        throw new Error(
          "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
        );
      }

      let persisted:
        MeasurementRecord | undefined;

      try {
        persisted =
          await putLocalMeasurementPreservingCanonicalVersion(
            normalizedMeasurement,
          );
      } catch (error: unknown) {
        const rolledBack =
          await rollbackDeferredMeasurementUpdate(
            deferredResult,
          );

        if (!rolledBack) {
          throw new Error(
            "MEASUREMENT_SYNC_COMPENSATION_FAILED",
          );
        }

        throw error;
      }

      const ready =
        await markDeferredMeasurementMutationsReadyAtomically([
          {
            result: deferredResult,
            canonicalVersion:
              readCanonicalMeasurementVersion(
                persisted,
              ),
          },
        ]);

      if (!ready) {
        const localRollback =
          await restoreLocalMeasurementsPreservingCanonicalVersion([
            existingMeasurement,
          ]);
        const queueRollback =
          await rollbackDeferredMeasurementUpdate(
            deferredResult,
          );

        if (
          !localRollback ||
          !queueRollback
        ) {
          throw new Error(
            "MEASUREMENT_SYNC_COMPENSATION_FAILED",
          );
        }

        throw new Error(
          "MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED",
        );
      }

      return;
    }
  }

  const latestMeasurement =
    existingMeasurement
      ? await localMeasurementDb.measurements.get(
          measurement.id,
        )
      : undefined;

  const expectedVersion =
    existingMeasurement
      ? readCanonicalMeasurementVersion(
          latestMeasurement,
        )
      : 0;

  if (
    existingMeasurement &&
    expectedVersion === null
  ) {
    throw new Error(
      "MEASUREMENT_EXPECTED_VERSION_MISSING",
    );
  }

  const enqueueResult =
    await enqueueSyncEventDetailed(
      'MEASUREMENT',
      measurement.id,
      operation,
      payload,
      expectedVersion ?? 0,
      'BLOCKED',
    );

  if (
    !enqueueResult.success ||
    !enqueueResult.changeId ||
    !enqueueResult.deviceId ||
    !enqueueResult.userId ||
    !enqueueResult.createdAt
  ) {
    throw new Error(
      "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
    );
  }

  try {
    await putLocalMeasurementPreservingCanonicalVersion(
      normalizedMeasurement,
    );
  } catch (error: unknown) {
    if (enqueueResult.createdNew) {
      const discarded =
        await discardBlockedSyncEvent(
          enqueueResult.changeId,
        );

      if (!discarded) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }
    }

    throw error;
  }

  if (enqueueResult.createdNew) {
    const activated =
      await activateBlockedSyncEvent(
        enqueueResult.changeId,
      );

    if (!activated) {
      let rollbackSucceeded = false;

      try {
        if (existingMeasurement) {
          await putLocalMeasurementPreservingCanonicalVersion(
            existingMeasurement,
          );
        } else {
          await localMeasurementDb.measurements.delete(
            measurement.id,
          );
        }

        rollbackSucceeded = true;
      } catch {
        rollbackSucceeded = false;
      }

      if (!rollbackSucceeded) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }

      const discarded =
        await discardBlockedSyncEvent(
          enqueueResult.changeId,
        );

      if (!discarded) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }

      throw new Error(
        "MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED",
      );
    }
  }

  const receipt: TransferReceipt = {
    transferId:
      enqueueResult.changeId,
    entityType: 'MEASUREMENT',
    entityId: measurement.id,
    senderUserId:
      enqueueResult.userId,
    senderDeviceId:
      enqueueResult.deviceId,
    status: 'SENT',
    sentAt:
      enqueueResult.createdAt,
    entityVersion:
      expectedVersion ?? 0,
    createdAt:
      enqueueResult.createdAt,
    updatedAt:
      enqueueResult.createdAt
  };

  await saveTransferReceipt(receipt);
}

export async function deleteLocalMeasurement(
  id: string,
  username: string
): Promise<void> {
  const existing =
    await localMeasurementDb.measurements.get(
      id,
    );

  if (!existing) return;

  const deleted = {
    ...existing,
    isDeleted: true,
    deletedAt:
      new Date().toISOString(),
    deletedBy: username
  };

  const ownerScope =
    await resolveMeasurementOwnerScope(
      deleted,
    );
  const normalizedDeleted =
    normalizeMeasurementLinks(
      deleted,
    );

  const payload = {
    ...ownerScope,
    id,
    customerId:
      normalizedDeleted.customerId,
    roomId:
      normalizedDeleted.roomId,
    openingId:
      normalizedDeleted.openingId,
    windowId:
      normalizedDeleted.windowId,
    entity: 'measurement',
    isDeleted: true,
    deletedAt:
      normalizedDeleted.deletedAt,
    timestamp:
      new Date().toISOString()
  };

  const deferredResult =
    await enqueueDeferredMeasurementMutationAfterPredecessor(
      deleted.id,
      'SOFT_DELETE',
      payload,
      ownerScope,
    );

  if (!deferredResult.success) {
    throw new Error(
      "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
    );
  }

  if (deferredResult.deferred) {
    if (!deferredResult.changeId) {
      throw new Error(
        "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
      );
    }

    let persisted:
      MeasurementRecord | undefined;

    try {
      persisted =
        await putLocalMeasurementPreservingCanonicalVersion(
          normalizedDeleted,
        );
    } catch (error: unknown) {
      const rolledBack =
        await rollbackDeferredMeasurementUpdate(
          deferredResult,
        );

      if (!rolledBack) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }

      throw error;
    }

    const ready =
      await markDeferredMeasurementMutationsReadyAtomically([
        {
          result: deferredResult,
          canonicalVersion:
            readCanonicalMeasurementVersion(
              persisted,
            ),
        },
      ]);

    if (!ready) {
      const localRollback =
        await restoreLocalMeasurementsPreservingCanonicalVersion([
          existing,
        ]);
      const queueRollback =
        await rollbackDeferredMeasurementUpdate(
          deferredResult,
        );

      if (
        !localRollback ||
        !queueRollback
      ) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }

      throw new Error(
        "MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED",
      );
    }

    return;
  }

  const latest =
    await localMeasurementDb.measurements.get(
      id,
    );
  const expectedVersion =
    readCanonicalMeasurementVersion(
      latest,
    );

  if (expectedVersion === null) {
    throw new Error(
      "MEASUREMENT_EXPECTED_VERSION_MISSING",
    );
  }

  const enqueueResult =
    await enqueueSyncEventDetailed(
      'MEASUREMENT',
      deleted.id,
      'SOFT_DELETE',
      payload,
      expectedVersion,
      'BLOCKED',
    );

  if (
    !enqueueResult.success ||
    !enqueueResult.changeId
  ) {
    throw new Error(
      "MEASUREMENT_SYNC_QUEUE_CREATE_FAILED",
    );
  }

  try {
    await putLocalMeasurementPreservingCanonicalVersion(
      normalizedDeleted,
    );
  } catch (error: unknown) {
    if (enqueueResult.createdNew) {
      const discarded =
        await discardBlockedSyncEvent(
          enqueueResult.changeId,
        );

      if (!discarded) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }
    }

    throw error;
  }

  if (enqueueResult.createdNew) {
    const activated =
      await activateBlockedSyncEvent(
        enqueueResult.changeId,
      );

    if (!activated) {
      const localRollback =
        await restoreLocalMeasurementsPreservingCanonicalVersion([
          existing,
        ]);

      const discarded =
        await discardBlockedSyncEvent(
          enqueueResult.changeId,
        );

      if (
        !localRollback ||
        !discarded
      ) {
        throw new Error(
          "MEASUREMENT_SYNC_COMPENSATION_FAILED",
        );
      }

      throw new Error(
        "MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED",
      );
    }
  }
}

export type MeasurementCascadeDeleteSource =
  | 'OPENING_CASCADE'
  | 'ROOM_CASCADE';

export async function deleteLocalMeasurementsWithSync(
  ids: string[],
  username: string,
  deleteSource: MeasurementCascadeDeleteSource,
): Promise<MeasurementRecord[]> {
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) =>
          String(id || "").trim()
        )
        .filter(Boolean),
    ),
  );

  if (uniqueIds.length !== ids.length) {
    throw new Error(
      "MEASUREMENT_CASCADE_TARGET_ID_INVALID",
    );
  }

  if (uniqueIds.length === 0) {
    return [];
  }

  const originals =
    await localMeasurementDb.measurements.bulkGet(
      uniqueIds,
    );

  if (
    originals.length !== uniqueIds.length ||
    originals.some(
      (measurement) =>
        !measurement ||
        measurement.isDeleted,
    )
  ) {
    throw new Error(
      "MEASUREMENT_CASCADE_TARGET_CHANGED",
    );
  }

  const activeOriginals =
    originals as MeasurementRecord[];
  const deletedAt =
    new Date().toISOString();

  const prepared: Array<{
    original: MeasurementRecord;
    deleted: MeasurementRecord;
    expectedVersion: number;
    ownerScope: ErpScope;
  }> = [];

  for (const original of activeOriginals) {
    const expectedVersion =
      readCanonicalMeasurementVersion(
        original,
      );

    if (expectedVersion === null) {
      throw new Error(
        "MEASUREMENT_EXPECTED_VERSION_MISSING",
      );
    }

    const ownerScope =
      await resolveMeasurementOwnerScope(
        original,
      );

    const deleted =
      normalizeMeasurementLinks({
        ...original,
        isDeleted: true,
        deletedAt,
        deletedBy: username,
        deleteSource,
      } as MeasurementRecord);

    prepared.push({
      original,
      deleted,
      expectedVersion,
      ownerScope,
    });
  }

  const createdChangeIds: string[] = [];
  const deferredResults:
    DeferredMeasurementMutationResult[] = [];

  try {
    for (const item of prepared) {
      const payload = {
        ...item.ownerScope,
        id: item.deleted.id,
        customerId:
          item.deleted.customerId,
        roomId:
          item.deleted.roomId,
        openingId:
          item.deleted.openingId,
        windowId:
          item.deleted.windowId,
        entity: 'measurement',
        isDeleted: true,
        deletedAt:
          item.deleted.deletedAt,
        timestamp:
          new Date().toISOString(),
      };

      const deferredResult =
        await enqueueDeferredMeasurementMutationAfterPredecessor(
          item.deleted.id,
          'SOFT_DELETE',
          payload,
          item.ownerScope,
        );

      if (!deferredResult.success) {
        throw new Error(
          "MEASUREMENT_CASCADE_SYNC_QUEUE_CREATE_FAILED",
        );
      }

      if (deferredResult.deferred) {
        if (!deferredResult.changeId) {
          throw new Error(
            "MEASUREMENT_CASCADE_SYNC_QUEUE_CREATE_FAILED",
          );
        }

        deferredResults.push(
          deferredResult,
        );
        continue;
      }

      const latest =
        await localMeasurementDb.measurements.get(
          item.deleted.id,
        );
      const latestVersion =
        readCanonicalMeasurementVersion(
          latest,
        );

      if (latestVersion === null) {
        throw new Error(
          "MEASUREMENT_EXPECTED_VERSION_MISSING",
        );
      }

      item.expectedVersion =
        latestVersion;

      const enqueueResult =
        await enqueueSyncEventDetailed(
          'MEASUREMENT',
          item.deleted.id,
          'SOFT_DELETE',
          payload,
          item.expectedVersion,
          'BLOCKED',
        );

      if (
        !enqueueResult.success ||
        !enqueueResult.changeId ||
        enqueueResult.createdNew !== true
      ) {
        throw new Error(
          "MEASUREMENT_CASCADE_SYNC_QUEUE_CREATE_FAILED",
        );
      }

      createdChangeIds.push(
        enqueueResult.changeId,
      );
    }
  } catch (error: unknown) {
    const discarded =
      createdChangeIds.length === 0
        ? true
        : await discardBlockedSyncEventsAtomically(
            createdChangeIds,
          );

    const deferredRolledBack =
      await rollbackDeferredMeasurementResults(
        deferredResults,
      );

    if (
      !discarded ||
      !deferredRolledBack
    ) {
      throw new Error(
        "MEASUREMENT_SYNC_COMPENSATION_FAILED",
      );
    }

    throw error;
  }

  let persistedDeleted:
    MeasurementRecord[] = [];

  try {
    persistedDeleted =
      await localMeasurementDb.transaction(
        'rw',
        localMeasurementDb.measurements,
        async () => {
          const next:
            MeasurementRecord[] = [];

          for (const item of prepared) {
            const current =
              await localMeasurementDb.measurements.get(
                item.deleted.id,
              );

            if (
              !current ||
              current.isDeleted
            ) {
              throw new Error(
                "MEASUREMENT_CASCADE_TARGET_CHANGED",
              );
            }

            const currentVersion =
              readCanonicalMeasurementVersion(
                current,
              );
            const deletedVersion =
              readCanonicalMeasurementVersion(
                item.deleted,
              );

            const canonicalVersion =
              currentVersion === null
                ? deletedVersion
                : deletedVersion === null
                  ? currentVersion
                  : Math.max(
                      currentVersion,
                      deletedVersion,
                    );

            const candidate =
              normalizeMeasurementLinks({
                ...item.deleted,
                ...(canonicalVersion === null
                  ? {}
                  : {
                      version:
                        canonicalVersion,
                    }),
              });

            next.push(candidate);
          }

          await localMeasurementDb.measurements.bulkPut(
            next,
          );

          return next;
        },
      );
  } catch (error: unknown) {
    const discarded =
      createdChangeIds.length === 0
        ? true
        : await discardBlockedSyncEventsAtomically(
            createdChangeIds,
          );

    const deferredRolledBack =
      await rollbackDeferredMeasurementResults(
        deferredResults,
      );

    if (
      !discarded ||
      !deferredRolledBack
    ) {
      throw new Error(
        "MEASUREMENT_SYNC_COMPENSATION_FAILED",
      );
    }

    throw error;
  }

  const persistedById =
    new Map(
      persistedDeleted.map(
        (measurement) => [
          measurement.id,
          measurement,
        ],
      ),
    );

  const finalized =
    await finalizeMeasurementMutationQueueAtomically(
      createdChangeIds,
      deferredResults.map((result) => ({
        result,
        canonicalVersion:
          readCanonicalMeasurementVersion(
            result.entityId
              ? persistedById.get(
                  result.entityId,
                )
              : undefined,
          ),
      })),
    );

  if (!finalized) {
    const localRollback =
      await restoreLocalMeasurementsPreservingCanonicalVersion(
        activeOriginals,
      );

    const discarded =
      createdChangeIds.length === 0
        ? true
        : await discardBlockedSyncEventsAtomically(
            createdChangeIds,
          );

    const deferredRolledBack =
      await rollbackDeferredMeasurementResults(
        deferredResults,
      );

    if (
      !localRollback ||
      !discarded ||
      !deferredRolledBack
    ) {
      throw new Error(
        "MEASUREMENT_SYNC_COMPENSATION_FAILED",
      );
    }

    throw new Error(
      "MEASUREMENT_SYNC_QUEUE_ACTIVATION_FAILED",
    );
  }

  return persistedDeleted;
}

export async function requeueLocalMeasurementForSync(
  id: string,
  username = 'RECOVERY',
): Promise<void> {
  const measurement = await localMeasurementDb.measurements.get(id);
  if (!measurement) {
    throw new Error("MEASUREMENT_RECOVERY_LOCAL_MISSING");
  }

  await saveLocalMeasurementWithSync(measurement, username);
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
