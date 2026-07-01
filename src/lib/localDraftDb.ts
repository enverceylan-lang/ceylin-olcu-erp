import Dexie, { type Table } from 'dexie';

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

  constructor() {
    super('CeylinLocalDraftDb');
    this.version(1).stores({
      measurementDrafts: 'id, draftType, createdBy, syncStatus, customerPhone',
      installationDrafts: 'id, draftType, ticketNo, createdBy, syncStatus',
      draftMediaFiles: 'fileId, draftId, category'
    });
  }
}

export const localDraftDb = new LocalDraftDatabase();

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
  } else {
    await localDraftDb.installationDrafts.update(id, { syncStatus: 'READY_TO_TRANSFER', updatedAt: now });
  }
}

export async function markDraftTransferred(id: string, type: 'MEASUREMENT' | 'INSTALLATION'): Promise<void> {
  const now = new Date().toISOString();
  if (type === 'MEASUREMENT') {
    await localDraftDb.measurementDrafts.update(id, { syncStatus: 'TRANSFERRED', updatedAt: now });
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
  } else {
    await localDraftDb.installationDrafts.delete(id);
  }
}
