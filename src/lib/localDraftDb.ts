import Dexie, { type Table } from 'dexie';
import { enqueueSyncEvent } from './localSyncQueueDb';

export interface InboundMeasurement {
  changeId: string;
  revision: number;
  entityType: string;
  entityId: string;
  operation: string;
  sourceTable: 'draft_changes' | 'measurement_changes';
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  patch: any;
  senderId?: string;
  createdAt: string;
  status: 'NEW' | 'MATCH_PENDING' | 'LINKED_TO_CUSTOMER' | 'CREATED_CUSTOMER' | 'SKIPPED';
  suggestedCustomerIds?: string[];
  linkedCustomerId?: string;
  createdCustomerId?: string;
}

export interface SyncCursor {
  key: string;
  revision: number;
  updatedAt: string;
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
  rooms: any[];
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

class LocalDraftDatabase extends Dexie {
  measurementDrafts!: Table<FieldMeasurementDraft, string>;
  installationDrafts!: Table<FieldInstallationDraft, string>;
  draftMediaFiles!: Table<DraftMediaFile, string>;
  inboundMeasurements!: Table<InboundMeasurement, string>;
  syncCursors!: Table<SyncCursor, string>;

  constructor() {
    super('CeylinLocalDraftDb');
    this.version(2).stores({
      measurementDrafts: 'id, draftType, createdBy, syncStatus, customerPhone',
      installationDrafts: 'id, draftType, ticketNo, createdBy, syncStatus',
      draftMediaFiles: 'fileId, draftId, category',
      inboundMeasurements: 'changeId, status, revision',
      syncCursors: 'key'
    });
  }
}

export const localDraftDb = new LocalDraftDatabase();

// ─── INBOUND MEASUREMENT HELPERS ───

export async function getSyncCursor(key: string): Promise<number> {
  const record = await localDraftDb.syncCursors.get(key);
  return record?.revision || 0;
}

export async function setSyncCursor(key: string, revision: number): Promise<void> {
  await localDraftDb.syncCursors.put({ key, revision, updatedAt: new Date().toISOString() });
}

export async function saveInboundMeasurement(inbound: InboundMeasurement): Promise<void> {
  // Prevent duplicate insert if changeId already exists
  const existing = await localDraftDb.inboundMeasurements.get(inbound.changeId);
  if (existing) return;
  
  // Smart deduplication: If we already have a PENDING record for this entity in the pool,
  // we overwrite it so we don't have multiple pending cards. If it's already LINKED, 
  // we ALLOW it so that tomorrow's updates aren't lost.
  const all = await localDraftDb.inboundMeasurements.toArray();
  const existingPending = all.find(x => 
    x.entityId === inbound.entityId && 
    x.entityType === inbound.entityType &&
    (x.status === 'NEW' || x.status === 'MATCH_PENDING')
  );
  
  if (existingPending) {
    await localDraftDb.inboundMeasurements.delete(existingPending.changeId);
  }

  await localDraftDb.inboundMeasurements.add(inbound);
}

export async function listInboundMeasurements(status?: InboundMeasurement['status']): Promise<InboundMeasurement[]> {
  if (status) {
    return await localDraftDb.inboundMeasurements.where('status').equals(status).reverse().sortBy('revision');
  }
  return await localDraftDb.inboundMeasurements.reverse().sortBy('revision');
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
  await enqueueSyncEvent('DRAFT', newDraft.id, 'INSERT', newDraft);
  return newDraft.id;
}

export async function updateMeasurementDraft(id: string, updates: Partial<Omit<FieldMeasurementDraft, 'id' | 'draftType' | 'createdAt'>>): Promise<void> {
  const now = new Date().toISOString();
  await localDraftDb.measurementDrafts.update(id, {
    ...updates,
    updatedAt: now
  });
  
  const updated = await localDraftDb.measurementDrafts.get(id);
  if (updated) {
    await enqueueSyncEvent('DRAFT', id, 'UPDATE', updated);
  }
}

export async function listMeasurementDrafts(createdBy?: string, syncStatus?: FieldMeasurementDraft['syncStatus']): Promise<FieldMeasurementDraft[]> {
  let query = localDraftDb.measurementDrafts.toCollection();
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
  let query = localDraftDb.installationDrafts.toCollection();
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
    await localDraftDb.measurementDrafts.update(id, { syncStatus: 'READY_TO_TRANSFER', updatedAt: now });
    const updated = await localDraftDb.measurementDrafts.get(id);
    if (updated) await enqueueSyncEvent('DRAFT', id, 'UPDATE', { syncStatus: 'READY_TO_TRANSFER', updatedAt: now });
  } else {
    await localDraftDb.installationDrafts.update(id, { syncStatus: 'READY_TO_TRANSFER', updatedAt: now });
  }
}

export async function markDraftTransferred(id: string, type: 'MEASUREMENT' | 'INSTALLATION'): Promise<void> {
  const now = new Date().toISOString();
  if (type === 'MEASUREMENT') {
    await localDraftDb.measurementDrafts.update(id, { syncStatus: 'TRANSFERRED', updatedAt: now });
    const updated = await localDraftDb.measurementDrafts.get(id);
    if (updated) await enqueueSyncEvent('DRAFT', id, 'UPDATE', { syncStatus: 'TRANSFERRED', updatedAt: now });
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
