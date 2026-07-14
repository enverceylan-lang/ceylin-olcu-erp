import { create } from 'zustand';
import { ProductMeasurement } from '@/store/useStore';
import { loadLocalMeasurements, saveLocalMeasurement, saveLocalMeasurementWithSync, deleteLocalMeasurement, batchSaveLocalMeasurements } from '@/lib/localMeasurementDb';

export interface MeasurementRecord extends ProductMeasurement {
  customerId: string;
  roomId: string;
  windowId: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveBatchId?: string;
  deleteBatchId?: string;
}

interface MeasurementState {
  measurements: MeasurementRecord[];
  isLoading: boolean;
  loadMeasurements: () => Promise<void>;
  addMeasurement: (measurement: MeasurementRecord, username: string) => Promise<void>;
  updateMeasurement: (measurement: MeasurementRecord, username: string) => Promise<void>;
  deleteMeasurement: (id: string, username: string) => Promise<void>;
  batchUpsertMeasurements: (measurements: MeasurementRecord[]) => Promise<void>;
  // Cascade methods for when customer is archived/trashed
  cascadeArchiveCustomer: (customerId: string, batchId: string, username: string) => Promise<void>;
  cascadeRestoreArchivedCustomer: (customerId: string, batchId: string) => Promise<void>;
  cascadeMoveToTrash: (customerId: string, batchId: string, username: string) => Promise<void>;
  cascadeRestoreFromTrash: (customerId: string, batchId: string) => Promise<void>;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  measurements: [],
  isLoading: false,

  loadMeasurements: async () => {
    set({ isLoading: true });
    try {
      const data = await loadLocalMeasurements();
      set({ measurements: data || [], isLoading: false });
    } catch (error) {
      console.error("Ölçüler yüklenirken hata:", error);
      set({ isLoading: false });
    }
  },

  addMeasurement: async (measurement, username) => {
    await saveLocalMeasurementWithSync(measurement, username);
    set(state => ({
      measurements: [...state.measurements, measurement]
    }));
  },

  updateMeasurement: async (measurement, username) => {
    await saveLocalMeasurementWithSync(measurement, username);
    set(state => ({
      measurements: state.measurements.map(m => m.id === measurement.id ? measurement : m)
    }));
  },

  deleteMeasurement: async (id, username) => {
    await deleteLocalMeasurement(id, username);
    set(state => ({
      measurements: state.measurements.map(m => m.id === id ? { ...m, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: username } : m)
    }));
  },

  batchUpsertMeasurements: async (newMeasurements) => {
    await batchSaveLocalMeasurements(newMeasurements);
    set(state => {
      const existingMap = new Map(state.measurements.map(m => [m.id, m]));
      newMeasurements.forEach(nm => existingMap.set(nm.id, nm));
      return { measurements: Array.from(existingMap.values()) };
    });
  },

  cascadeArchiveCustomer: async (customerId, batchId, username) => {
    const { measurements } = get();
    const updated = measurements.map(m => {
      if (m.customerId === customerId && !m.isDeleted && !m.isArchived) {
        return { ...m, isArchived: true, archivedAt: new Date().toISOString(), archivedBy: username, archiveBatchId: batchId };
      }
      return m;
    });
    
    const changed = updated.filter(u => u.archiveBatchId === batchId);
    if (changed.length > 0) {
      await batchSaveLocalMeasurements(changed);
      set({ measurements: updated });
    }
  },

  cascadeRestoreArchivedCustomer: async (customerId, batchId) => {
    const { measurements } = get();
    const updated = measurements.map(m => {
      if (m.customerId === customerId && m.isArchived && m.archiveBatchId === batchId) {
        return { ...m, isArchived: false, archivedAt: undefined, archivedBy: undefined, archiveBatchId: undefined };
      }
      return m;
    });
    
    // Using simple filter logic to identify changed isn't perfect for restore if we just stripped the batchId, 
    // so we'll just save all belonging to customer.
    const toSave = updated.filter(m => m.customerId === customerId);
    if (toSave.length > 0) {
      await batchSaveLocalMeasurements(toSave);
      set({ measurements: updated });
    }
  },

  cascadeMoveToTrash: async (customerId, batchId, username) => {
    const { measurements } = get();
    const updated = measurements.map(m => {
      if (m.customerId === customerId && !m.isDeleted) {
        return { ...m, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: username, deleteBatchId: batchId };
      }
      return m;
    });
    
    const changed = updated.filter(u => u.deleteBatchId === batchId);
    if (changed.length > 0) {
      await batchSaveLocalMeasurements(changed);
      set({ measurements: updated });
    }
  },

  cascadeRestoreFromTrash: async (customerId, batchId) => {
    const { measurements } = get();
    const updated = measurements.map(m => {
      if (m.customerId === customerId && m.isDeleted && m.deleteBatchId === batchId) {
        return { ...m, isDeleted: false, deletedAt: undefined, deletedBy: undefined, deleteBatchId: undefined };
      }
      return m;
    });
    
    const toSave = updated.filter(m => m.customerId === customerId);
    if (toSave.length > 0) {
      await batchSaveLocalMeasurements(toSave);
      set({ measurements: updated });
    }
  }
}));
