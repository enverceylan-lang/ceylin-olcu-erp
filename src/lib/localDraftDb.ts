import Dexie, { type Table } from 'dexie';
import { type Customer, type Room } from '@/store/useStore';
import {
  enqueueSyncEvent,
  localSyncQueueDb
} from './localSyncQueueDb';
import { loadLocalCustomers, saveLocalCustomer, localCustomerDb } from './localCustomerDb';
import { validateMeasurementTransferTree, type MeasurementValidationIssue } from './measurementValidationEngine';
import { erpScopeMatches, type ErpScope } from './erpScope';
import { readErpScope } from './customerTreeScope';

export interface InboundMeasurement {
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  accountingPeriodId?: string;
  changeId: string;
  revision: number;
  entityType: string;
  entityId: string;
  operation: string;
  sourceTable: 'draft_changes' | 'measurement_changes';
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  patch: InboundSyncPatch;
  senderId?: string;
  createdAt: string;
  status: 'NEW' | 'MATCH_PENDING' | 'LINKED_TO_CUSTOMER' | 'CREATED_CUSTOMER' | 'SKIPPED' | 'QUARANTINE';
  suggestedCustomerIds?: string[];
  linkedCustomerId?: string;
  createdCustomerId?: string;
  pendingCustomerId?: string;
  latestChangeId?: string;

  validationIssues?: MeasurementValidationIssue[];
  quarantineAt?: string;
  measurementId?: string;
  measuredBy?: string;
  measuredById?: string;
  roomName?: string;
  openingName?: string;
  sourceDeviceId?: string;
}

export interface SyncCursor {
  key: string;
  revision: number;
  updatedAt: string;
}

interface InboundPatchProduct {
  id?: string;
  type?: string;
  rawValues?: Record<string, unknown>;
}

interface InboundPatchOpening {
  id?: string;
  name?: string;
  products?: InboundPatchProduct[];
  measurements?: InboundPatchProduct[];
}

interface InboundPatchRoom {
  id?: string;
  name?: string;
  windows?: InboundPatchOpening[];
  openings?: InboundPatchOpening[];
}

interface InboundSyncPatch {
  updatedAt?: string;
  id?: string;
  entity?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  timestamp?: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  roomId?: string;
  windowId?: string;
  syncIntent?: string;
  rooms?: InboundPatchRoom[];
  temporaryCustomerId?: string;
  sourceMeasurementChangeId?: string;
  measurements?: unknown[];
}

export interface FieldMeasurementDraft {
  id: string;
  draftType: 'MEASUREMENT';
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  notes?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
  rooms: Room[];
  mediaFiles: {
    fileId: string;
    fileName: string;
    mimeType: string;
    category: string;
  }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'DRAFT' | 'READY_TO_TRANSFER' | 'TRANSFERRING' | 'TRANSFERRED' | 'ERROR';
  recoveryQueuedAt?: string;
}

export interface FieldInstallationDraft {
  id: string;
  draftType: 'INSTALLATION';
  ticketNo: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  resultStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'NEEDS_SERVICE';
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  };
  mediaFiles: {
    fileId: string;
    fileName: string;
    mimeType: string;
    category: string;
  }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'DRAFT' | 'READY_TO_TRANSFER' | 'TRANSFERRING' | 'TRANSFERRED' | 'ERROR';
  recoveryQueuedAt?: string;
}
export interface DraftMediaFile {
  fileId: string;
  draftId: string;
  fileName: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
  blob: Blob;
}
export type TransferStatus =
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "ACCEPTED"
  | "COMPLETED"
  | "FAILED";

export interface TransferReceipt {
  transferId: string;
  entityType: "MEASUREMENT";
  entityId: string;
  senderUserId: string;
  receiverUserId?: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  status: TransferStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  entityVersion: number;
  createdAt: string;
  updatedAt: string;
}
class LocalDraftDatabase extends Dexie {
  measurementDrafts!: Table<FieldMeasurementDraft, string>;
  installationDrafts!: Table<FieldInstallationDraft, string>;
  draftMediaFiles!: Table<DraftMediaFile, string>;
  inboundMeasurements!: Table<InboundMeasurement, string>;
  syncCursors!: Table<SyncCursor, string>;
  transferReceipts!: Table<TransferReceipt, string>;

  constructor() {
    super('CeylinLocalDraftDb');

    this.version(2).stores({
      measurementDrafts: 'id, draftType, createdBy, syncStatus, customerPhone',
      installationDrafts: 'id, draftType, ticketNo, createdBy, syncStatus',
      draftMediaFiles: 'fileId, draftId, category',
      inboundMeasurements: 'changeId, status, revision',
      syncCursors: 'key'
    });

    this.version(3).stores({
      measurementDrafts: 'id, draftType, createdBy, syncStatus, customerPhone',
      installationDrafts: 'id, draftType, ticketNo, createdBy, syncStatus',
      draftMediaFiles: 'fileId, draftId, category',
      inboundMeasurements: 'changeId, status, revision',
      syncCursors: 'key',
      transferReceipts: 'transferId, entityId, status, updatedAt'
    });
  }
}
export const localDraftDb = new LocalDraftDatabase();
const TRANSFER_STATUS_ORDER: TransferStatus[] = [
  "SENT",
  "DELIVERED",
  "READ",
  "ACCEPTED",
  "COMPLETED"
];

export function canTransferStatusAdvance(
  currentStatus: TransferStatus,
  nextStatus: TransferStatus
): boolean {
  if (currentStatus === nextStatus) return true;

  if (nextStatus === "FAILED") return true;

  if (currentStatus === "FAILED") {
    return nextStatus === "SENT";
  }

  const currentIndex = TRANSFER_STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = TRANSFER_STATUS_ORDER.indexOf(nextStatus);

  return currentIndex >= 0 && nextIndex > currentIndex;
}

export async function saveTransferReceipt(
  receipt: TransferReceipt
): Promise<boolean> {
  const existing = await localDraftDb.transferReceipts.get(
    receipt.transferId
  );

  if (!existing) {
    await localDraftDb.transferReceipts.add(receipt);
    return true;
  }

  if (receipt.entityVersion < existing.entityVersion) {
    return false;
  }

  if (
    receipt.entityVersion === existing.entityVersion &&
    receipt.status === existing.status
  ) {
    return true;
  }

  if (!canTransferStatusAdvance(existing.status, receipt.status)) {
    return false;
  }

  await localDraftDb.transferReceipts.put({
    ...existing,
    ...receipt,
    sentAt: receipt.sentAt || existing.sentAt,
    deliveredAt: receipt.deliveredAt || existing.deliveredAt,
    readAt: receipt.readAt || existing.readAt,
    acceptedAt: receipt.acceptedAt || existing.acceptedAt,
    completedAt: receipt.completedAt || existing.completedAt,
    failedAt: receipt.failedAt || existing.failedAt,
    receiverUserId:
      receipt.receiverUserId || existing.receiverUserId,
    receiverDeviceId:
      receipt.receiverDeviceId || existing.receiverDeviceId
  });

  return true;
}

export async function getTransferReceipt(
  transferId: string
): Promise<TransferReceipt | undefined> {
  return localDraftDb.transferReceipts.get(transferId);
}

// ─── INBOUND MEASUREMENT HELPERS ───

export async function getSyncCursor(key: string): Promise<number> {
  const record = await localDraftDb.syncCursors.get(key);
  return record?.revision || 0;
}

export async function setSyncCursor(key: string, revision: number): Promise<void> {
  await localDraftDb.syncCursors.put({ key, revision, updatedAt: new Date().toISOString() });
}

export type SaveInboundMeasurementOutcome =
  | 'INSERTED'
  | 'UPDATED_OPEN_ITEM'
  | 'ALREADY_RECORDED';

export async function saveInboundMeasurement(
  inbound: InboundMeasurement
): Promise<SaveInboundMeasurementOutcome> {
  const inboundScope = readErpScope(inbound);
  if (!inboundScope) {
    throw new Error('INBOUND_ERP_SCOPE_MISSING');
  }

  try {
    return await localDraftDb.transaction(
      'rw',
      localDraftDb.inboundMeasurements,
      async () => {
  // Idempotency is based only on the immutable event identity.
  const existing = await localDraftDb.inboundMeasurements.get(inbound.changeId);
  if (existing) {
    const existingScope = readErpScope(existing);
    if (!existingScope || !erpScopeMatches(existingScope, inboundScope)) {
      throw new Error('INBOUND_CHANGE_SCOPE_CONFLICT');
    }
    return 'ALREADY_RECORDED';
  }

  const all = await localDraftDb.inboundMeasurements.toArray();
  const latestChangeOwner = all.find(
    (item) => item.latestChangeId === inbound.changeId,
  );
  if (latestChangeOwner) {
    const latestChangeScope = readErpScope(latestChangeOwner);
    if (
      !latestChangeScope ||
      !erpScopeMatches(latestChangeScope, inboundScope)
    ) {
      throw new Error('INBOUND_CHANGE_SCOPE_CONFLICT');
    }
    return 'ALREADY_RECORDED';
  }

  const existingEntity = all
    .filter((item) => {
      const itemScope = readErpScope(item);
      return (
        item.entityId === inbound.entityId &&
        item.entityType === inbound.entityType &&
        Boolean(itemScope && erpScopeMatches(itemScope, inboundScope))
      );
    })
    .sort((a, b) => b.revision - a.revision)[0];

  // A newer revision may update an open work item, but it must never be swallowed
  // by an item that was already linked/created/skipped. A completed item represents
  // an earlier field transfer; later measurements for the same source customer are
  // a new piece of work and must appear in the inbound pool again.
  if (existingEntity && inbound.revision > existingEntity.revision) {
    const isOpenWorkItem =
      existingEntity.status === 'NEW' ||
      existingEntity.status === 'MATCH_PENDING';

    if (isOpenWorkItem) {
      const mergedPatch = {
        ...(existingEntity.patch || {}),
        ...(inbound.patch || {})
      };

      if (
        Array.isArray(existingEntity.patch?.rooms) &&
        existingEntity.patch.rooms.length > 0 &&
        (!Array.isArray(inbound.patch?.rooms) || inbound.patch.rooms.length === 0)
      ) {
        mergedPatch.rooms = existingEntity.patch.rooms;
      }


      if (
        Array.isArray(existingEntity.patch?.measurements) ||
        Array.isArray(inbound.patch?.measurements)
      ) {
        const mergedMeasurements = new Map<string, unknown>();

        const addMeasurements = (items: unknown[]): void => {
          items.forEach((item, index) => {
            if (!item || typeof item !== 'object') {
              console.warn(
                "[Inbound] Object olmayan measurement kaydı korumaya alınamadı.",
                item,
              );
              return;
            }

            const record = item as { id?: unknown };
            const id =
              typeof record.id === 'string' && record.id.trim().length > 0
                ? record.id
                : "__missing_id_" + index + "_" + mergedMeasurements.size;

            mergedMeasurements.set(id, item);
          });
        };

        addMeasurements(
          Array.isArray(existingEntity.patch?.measurements)
            ? existingEntity.patch.measurements
            : [],
        );
        addMeasurements(
          Array.isArray(inbound.patch?.measurements)
            ? inbound.patch.measurements
            : [],
        );

        mergedPatch.measurements = Array.from(
          mergedMeasurements.values(),
        );
      }
      await localDraftDb.inboundMeasurements.update(existingEntity.changeId, {
        ...inbound,
        changeId: existingEntity.changeId,
        latestChangeId: inbound.changeId,
        patch: mergedPatch,
        status:
          existingEntity.status === 'QUARANTINE' ||
          inbound.status === 'QUARANTINE'
            ? 'QUARANTINE'
            : 'NEW',
        pendingCustomerId: existingEntity.pendingCustomerId,
        linkedCustomerId: existingEntity.linkedCustomerId,
        createdCustomerId: existingEntity.createdCustomerId,
        validationIssues:
          inbound.validationIssues || existingEntity.validationIssues,
        quarantineAt:
          inbound.quarantineAt || existingEntity.quarantineAt,
        measurementId:
          inbound.measurementId || existingEntity.measurementId,
        measuredBy:
          inbound.measuredBy || existingEntity.measuredBy,
        measuredById:
          inbound.measuredById || existingEntity.measuredById,
        roomName:
          inbound.roomName || existingEntity.roomName,
        openingName:
          inbound.openingName || existingEntity.openingName,
        sourceDeviceId:
          inbound.sourceDeviceId || existingEntity.sourceDeviceId,
        suggestedCustomerIds:
          existingEntity.suggestedCustomerIds || inbound.suggestedCustomerIds
      });

      return 'UPDATED_OPEN_ITEM';
    }

    await localDraftDb.inboundMeasurements.add(inbound);
    return 'INSERTED';
  }

  await localDraftDb.inboundMeasurements.add(inbound);
  return 'INSERTED';

      },
    );
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.name === 'ConstraintError'
    ) {
      return 'ALREADY_RECORDED';
    }

    throw error;
  }
}

export function listInboundMeasurements(
  scope: ErpScope,
  status?: InboundMeasurement['status'],
): Promise<InboundMeasurement[]>;
export function listInboundMeasurements(
  status?: InboundMeasurement['status'],
): Promise<InboundMeasurement[]>;
export async function listInboundMeasurements(
  scopeOrStatus?: ErpScope | InboundMeasurement['status'],
  maybeStatus?: InboundMeasurement['status'],
): Promise<InboundMeasurement[]> {
  const scope =
    typeof scopeOrStatus === 'object' ? scopeOrStatus : undefined;
  const status =
    typeof scopeOrStatus === 'string' ? scopeOrStatus : maybeStatus;
  const rows = status
    ? await localDraftDb.inboundMeasurements
        .where('status')
        .equals(status)
        .reverse()
        .sortBy('revision')
    : await localDraftDb.inboundMeasurements.reverse().sortBy('revision');

  if (!scope) return rows;

  return rows.filter((item) => {
    const itemScope = readErpScope(item);
    return Boolean(itemScope && erpScopeMatches(itemScope, scope));
  });
}

export async function updateInboundStatus(changeId: string, status: InboundMeasurement['status']): Promise<void> {
  await localDraftDb.inboundMeasurements.update(changeId, { status });
}

// ─── HELPER FUNCTIONS ───

export async function createMeasurementDraft(draft: Omit<FieldMeasurementDraft, 'draftType' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const newDraft: FieldMeasurementDraft = {
    ...draft,
    draftType: 'MEASUREMENT',
    syncStatus: 'DRAFT',
    createdAt: now,
    updatedAt: now
  };
  await localDraftDb.measurementDrafts.add(newDraft);
  return newDraft.id;
}

export async function updateMeasurementDraft(id: string, updates: Partial<Omit<FieldMeasurementDraft, 'id' | 'draftType' | 'createdAt'>>): Promise<void> {
  const now = new Date().toISOString();
  await localDraftDb.measurementDrafts.update(id, {
    ...updates,
    updatedAt: now
  });
  // Taslak düzenlemeleri cihazda kalır; sync yalnız SOURCE_EXIT sonrasında açılır.
}

export async function listMeasurementDrafts(createdBy?: string, syncStatus?: FieldMeasurementDraft['syncStatus']): Promise<FieldMeasurementDraft[]> {
  const query = localDraftDb.measurementDrafts.toCollection();
  if (createdBy && syncStatus) {
    return await localDraftDb.measurementDrafts
      .where('createdBy').equals(createdBy)
      .and(item => item.syncStatus === syncStatus)
      .toArray();
  } else if (createdBy) {
    return await localDraftDb.measurementDrafts.where('createdBy').equals(createdBy).toArray();
  } else if (syncStatus) {
    return await localDraftDb.measurementDrafts.where('syncStatus').equals(syncStatus).toArray();
  }
  return await query.toArray();
}

export async function createInstallationDraft(draft: Omit<FieldInstallationDraft, 'draftType' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date().toISOString();
  const newDraft: FieldInstallationDraft = {
    ...draft,
    draftType: 'INSTALLATION',
    syncStatus: 'DRAFT',
    createdAt: now,
    updatedAt: now
  };
  await localDraftDb.installationDrafts.add(newDraft);
  return newDraft.id;
}

export async function updateInstallationDraft(id: string, updates: Partial<Omit<FieldInstallationDraft, 'id' | 'draftType' | 'createdAt'>>): Promise<void> {
  const now = new Date().toISOString();
  await localDraftDb.installationDrafts.update(id, {
    ...updates,
    updatedAt: now
  });
}

export async function listInstallationDrafts(createdBy?: string, syncStatus?: FieldInstallationDraft['syncStatus']): Promise<FieldInstallationDraft[]> {
  const query = localDraftDb.installationDrafts.toCollection();
  if (createdBy && syncStatus) {
    return await localDraftDb.installationDrafts
      .where('createdBy').equals(createdBy)
      .and(item => item.syncStatus === syncStatus)
      .toArray();
  } else if (createdBy) {
    return await localDraftDb.installationDrafts.where('createdBy').equals(createdBy).toArray();
  } else if (syncStatus) {
    return await localDraftDb.installationDrafts.where('syncStatus').equals(syncStatus).toArray();
  }
  return await query.toArray();
}

export async function addDraftMedia(media: Omit<DraftMediaFile, 'createdAt'>): Promise<string> {
  const now = new Date().toISOString();
  const newMedia: DraftMediaFile = {
    ...media,
    createdAt: now
  };
  await localDraftDb.draftMediaFiles.add(newMedia);

  // Update mediaFiles array in the parent draft
  const mDraft = await localDraftDb.measurementDrafts.get(media.draftId);
  if (mDraft) {
    const mediaFiles = mDraft.mediaFiles || [];
    mediaFiles.push({
      fileId: media.fileId,
      fileName: media.fileName,
      mimeType: media.mimeType,
      category: media.category
    });
    await localDraftDb.measurementDrafts.update(media.draftId, { mediaFiles, updatedAt: now });
    return media.fileId;
  }

  const iDraft = await localDraftDb.installationDrafts.get(media.draftId);
  if (iDraft) {
    const mediaFiles = iDraft.mediaFiles || [];
    mediaFiles.push({
      fileId: media.fileId,
      fileName: media.fileName,
      mimeType: media.mimeType,
      category: media.category
    });
    await localDraftDb.installationDrafts.update(media.draftId, { mediaFiles, updatedAt: now });
    return media.fileId;
  }

  return media.fileId;
}

export async function markDraftReadyToTransfer(id: string, type: 'MEASUREMENT' | 'INSTALLATION'): Promise<void> {
  const now = new Date().toISOString();
  if (type === 'MEASUREMENT') {
    const currentDraft = await localDraftDb.measurementDrafts.get(id);

    if (!currentDraft) {
      throw new Error("Gönderilecek ölçü taslağı bulunamadı.");
    }

    const validation = validateMeasurementTransferTree(
      currentDraft.rooms,
      "SOURCE_EXIT",
    );

    if (!validation.valid) {
      const issueText = validation.issues
        .map(issue => `${issue.code}: ${issue.message}`)
        .join("\n");

      console.warn(
        "[MeasurementValidation] SOURCE_EXIT rejected:",
        validation.issues,
      );

      throw new Error(
        issueText
          ? `Ölçüler gönderilemedi. ${issueText}`
          : "Ölçüler gönderilemedi. Eksik veya geçersiz ölçü bulundu.",
      );
    }

    await localDraftDb.measurementDrafts.update(id, {
      syncStatus: 'READY_TO_TRANSFER',
      updatedAt: now,
    });
    const updated = await localDraftDb.measurementDrafts.get(id);
    
      if (updated) {
          let rCount = 0, wCount = 0, pCount = 0;
          let hasRaw = false;
          if (updated.rooms && Array.isArray(updated.rooms)) {
              rCount = updated.rooms.length;
              updated.rooms.forEach(r => {
                  const roomSnapshot = r as Room & {
                    openings?: Room['windows'];
                  };
                  const windows = r.windows || roomSnapshot.openings || [];
                  wCount += windows.length;
                  windows.forEach(w => {
                      const openingSnapshot = w as typeof w & {
                        measurements?: typeof w.products;
                      };
                      const prods = w.products || openingSnapshot.measurements || [];
                      pCount += prods.length;
                      prods.forEach(p => { if (p.rawValues) hasRaw = true; });
                  });
              });
          }
          console.log(`[SYNC-DIAGNOSTIC] Telefon push öncesi: entityType=DRAFT, patchKeys=${Object.keys(updated).length}, roomsCount=${rCount}, windowsCount/openingsCount=${wCount}, productsCount/measurementsCount=${pCount}, hasRawValues=${hasRaw}, syncStatus=${updated.syncStatus}`);
          await enqueueSyncEvent('DRAFT', id, 'UPDATE', updated);
      }

  } else {
    await localDraftDb.installationDrafts.update(id, { syncStatus: 'READY_TO_TRANSFER', updatedAt: now });
  }
}

export async function markDraftTransferred(id: string, type: 'MEASUREMENT' | 'INSTALLATION'): Promise<void> {
  const now = new Date().toISOString();
  if (type === 'MEASUREMENT') {
    await localDraftDb.measurementDrafts.update(id, { syncStatus: 'TRANSFERRED', updatedAt: now });
    const updated = await localDraftDb.measurementDrafts.get(id);
    
      if (updated) {
          let rCount = 0, wCount = 0, pCount = 0;
          let hasRaw = false;
          if (updated.rooms && Array.isArray(updated.rooms)) {
              rCount = updated.rooms.length;
              updated.rooms.forEach(r => {
                  const roomSnapshot = r as Room & {
                    openings?: Room['windows'];
                  };
                  const windows = r.windows || roomSnapshot.openings || [];
                  wCount += windows.length;
                  windows.forEach(w => {
                      const openingSnapshot = w as typeof w & {
                        measurements?: typeof w.products;
                      };
                      const prods = w.products || openingSnapshot.measurements || [];
                      pCount += prods.length;
                      prods.forEach(p => { if (p.rawValues) hasRaw = true; });
                  });
              });
          }
          console.log(`[SYNC-DIAGNOSTIC] Telefon push öncesi: entityType=DRAFT, patchKeys=${Object.keys(updated).length}, roomsCount=${rCount}, windowsCount/openingsCount=${wCount}, productsCount/measurementsCount=${pCount}, hasRawValues=${hasRaw}, syncStatus=${updated.syncStatus}`);
          await enqueueSyncEvent('DRAFT', id, 'UPDATE', updated);
      }

  } else {
    await localDraftDb.installationDrafts.update(id, { syncStatus: 'TRANSFERRED', updatedAt: now });
  }
}

export async function deleteTransferredDraft(id: string, type: 'MEASUREMENT' | 'INSTALLATION'): Promise<void> {
  // 1. Delete associated media files first
  await localDraftDb.draftMediaFiles.where('draftId').equals(id).delete();
  
  // 2. Delete draft itself
  if (type === 'MEASUREMENT') {
    await localDraftDb.measurementDrafts.delete(id);
    await enqueueSyncEvent('DRAFT', id, 'SOFT_DELETE', { isDeleted: true });
  } else {
    await localDraftDb.installationDrafts.delete(id);
  }
}

export async function getDraftById(id: string): Promise<FieldMeasurementDraft | undefined> {
  return await localDraftDb.measurementDrafts.get(id);
}

export async function deleteMeasurementDraft(id: string): Promise<void> {
  // Delete associated media files first, then the draft
  await localDraftDb.draftMediaFiles.where('draftId').equals(id).delete();
  await localDraftDb.measurementDrafts.delete(id);
  await enqueueSyncEvent('DRAFT', id, 'SOFT_DELETE', { isDeleted: true });
}

export async function forceRequeueAllMeasurementDrafts(): Promise<{ 
  draftsFound: number, 
  draftsWithMeasurements: number, 
  draftsRequeued: number, 
  customersFound: number,
  customersWithMeasurements: number,
  customersRequeued: number,
  skipped: number 
}> {
  const drafts = await localDraftDb.measurementDrafts.toArray();
  const customers = await loadLocalCustomers();
  const now = new Date().toISOString();
  
  const result = {
    draftsFound: drafts.length,
    draftsWithMeasurements: 0,
    draftsRequeued: 0,
    customersFound: customers.length,
    customersWithMeasurements: 0,
    customersRequeued: 0,
    skipped: 0
  };

  // 1. Process Drafts
  for (const draft of drafts) {
    let hasMeasurements = false;
    if (draft.rooms && Array.isArray(draft.rooms) && draft.rooms.length > 0) {
      hasMeasurements = true;
    }

    if (!hasMeasurements) {
      result.skipped++;
      continue;
    }
    
    result.draftsWithMeasurements++;

    if (draft.recoveryQueuedAt) {
      result.skipped++;
      continue;
    }

    const recoveryDraft = {
      ...draft,
      recoveryQueuedAt: now,
      syncIntent: 'MEASUREMENT_TREE_RECOVERY',
      updatedAt: now,
    };
    const queued = await enqueueSyncEvent(
      'DRAFT',
      draft.id,
      'UPDATE',
      recoveryDraft,
    );
    if (!queued) {
      result.skipped++;
      continue;
    }

    await localDraftDb.measurementDrafts.put(recoveryDraft);
    result.draftsRequeued++;
  }

  // 2. Process Customers
  const {
    localMeasurementDb,
    requeueLocalMeasurementForSync,
  } = await import('./localMeasurementDb');

  for (const customer of customers) {
    const measurements = (
      await localMeasurementDb.measurements
        .where('customerId')
        .equals(customer.id)
        .toArray()
    ).filter((measurement) => !measurement.isDeleted);

    if (measurements.length === 0) {
      result.skipped++;
      continue;
    }

    result.customersWithMeasurements++;

    const recoveryCustomer = customer as Customer & {
      recoveryQueuedAt?: string;
      syncIntent?: string;
    };

    if (recoveryCustomer.recoveryQueuedAt) {
      result.skipped++;
      continue;
    }

    for (const measurement of measurements) {
      await requeueLocalMeasurementForSync(measurement.id);
    }

    await saveLocalCustomer({
      ...customer,
      recoveryQueuedAt: now,
      updatedAt: now,
    } as Customer & { recoveryQueuedAt: string });
    result.customersRequeued++;
  }

  return result;
}

export function getMeasurementTreeCounts(customer: Customer) {
  let roomsCount = 0;
  let openingsCount = 0;
  let measurementsCount = 0;
  let hasRawValues = false;

  if (customer.rooms && Array.isArray(customer.rooms)) {
    roomsCount = customer.rooms.length;
    for (const room of customer.rooms) {
      if (room.windows && Array.isArray(room.windows)) {
        openingsCount += room.windows.length;
        for (const w of room.windows) {
          if (w.products && Array.isArray(w.products)) {
            measurementsCount += w.products.length;
            for (const p of w.products) {
              if (p.rawValues) hasRawValues = true;
            }
          }
        }
      }
    }
  }

  return { roomsCount, openingsCount, measurementsCount, hasRawValues };
}

export async function forceRequeueCustomerMeasurementTree(customerId: string): Promise<{
  success: boolean;
  message: string;
  counts?: ReturnType<typeof getMeasurementTreeCounts>;
  queued?: boolean;
  alreadyQueued?: boolean;
}> {
  const customer = await localCustomerDb.customers.get(customerId);
  if (!customer) {
    return { success: false, message: "Bu cari local veritabanında bulunamadı." };
  }

  const counts = getMeasurementTreeCounts(customer);
  const {
    localMeasurementDb,
    requeueLocalMeasurementForSync,
  } = await import('./localMeasurementDb');
  const measurements = (
    await localMeasurementDb.measurements
      .where('customerId')
      .equals(customerId)
      .toArray()
  ).filter((measurement) => !measurement.isDeleted);

  if (measurements.length === 0) {
    return {
      success: false,
      message: "Bu caride bağımsız yerel ölçü kaydı bulunamadı.",
      counts,
    };
  }

  const pending = await localSyncQueueDb.pendingSyncEvents
      .where('syncStatus')
      .equals('PENDING')
      .toArray();

  const pendingMeasurementIds = new Set(
    pending
      .filter((event) => event.entityType === 'MEASUREMENT')
      .map((event) => event.entityId),
  );
  const isAlreadyQueued = measurements.every((measurement) =>
    pendingMeasurementIds.has(measurement.id),
  );

  if (isAlreadyQueued) {
    return { success: true, message: "Bu carinin ölçü kurtarma payload'ı zaten gönderim kuyruğunda.", counts, alreadyQueued: true, queued: false };
  }

  for (const measurement of measurements) {
    await requeueLocalMeasurementForSync(measurement.id);
  }

  return { success: true, message: "Bu carinin bağımsız ölçü kayıtları gönderim kuyruğuna alındı. Şimdi Ölçüleri Gönder butonuna basabilirsiniz.", counts, alreadyQueued: false, queued: true };
}
