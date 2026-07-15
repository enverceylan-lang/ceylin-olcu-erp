import { create } from 'zustand';
import { ProductMeasurement } from '@/store/useStore';
import { loadLocalMeasurements, saveLocalMeasurement, saveLocalMeasurementWithSync, deleteLocalMeasurement, batchSaveLocalMeasurements } from '@/lib/localMeasurementDb';
import {
  getMeasurementDimensions,
  resolveMeasurementProductType,
  resolveMeasurementProductLabel,
  resolveMeasurementProductGroup,
  calculateSelectedProduct
} from '@/lib/measurementAdapter';

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
  version?: number;
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

function enrichMeasurement(m: MeasurementRecord): MeasurementRecord {
  const copy = { ...m };

  // 1. Initialize selectedProducts if missing
  if (!copy.selectedProducts || copy.selectedProducts.length === 0) {
    const fallbackType = resolveMeasurementProductType(copy);
    if (fallbackType) {
      copy.selectedProducts = [{
        productType: fallbackType,
        isActive: true,
        addedAt: copy.createdAt || new Date().toISOString()
      }];
    } else {
      copy.selectedProducts = [];
    }
  }

  // 2. Calculate calculations for each selected product
  const dims = getMeasurementDimensions(copy);
  const width = dims.structuralWidth || 0;
  const height = dims.structuralHeight || 0;

  copy.selectedProducts = copy.selectedProducts.map(item => {
    const calc = calculateSelectedProduct(
      item.productType,
      width,
      height,
      copy.rawValues || {},
      copy.selectedProducts || []
    );
    return {
      ...item,
      calculation: calc,
      updatedAt: new Date().toISOString()
    };
  });

  const productType = resolveMeasurementProductType(copy);
  const productGroup = resolveMeasurementProductGroup(copy);

  copy.productType = productType;
  copy.productGroup = productGroup;

  // Recalculate dimensions using existing dims
  copy.calculatedWidth = dims.structuralWidth;
  copy.calculatedHeight = dims.structuralHeight;

  // Product transition cleanups
  if (copy.rawValues) {
    const raw = { ...copy.rawValues };

    if (productGroup === 'Mekanik Perde') {
      // Keep only mechanical fields
      const allowed = ['width', 'height', 'quantity', 'productType'];
      Object.keys(raw).forEach(key => {
        if (!allowed.includes(key)) {
          delete raw[key];
        }
      });
      copy.rawValues = raw;

      // Also cleanup details
      if (copy.details) {
        const det = { ...copy.details };
        delete det.pile;
        delete det.pleatType;
        delete det.pleatFactor;
        delete det.fabricQuantity;
        copy.details = det;
      }
    } else if (productGroup === 'Plicell') {
      // Keep only plicell fields
      const allowed = ['plicellCamListesi', 'camAdedi', 'ortakCamBoyuCm', 'profilRengi', 'glassWidth', 'glassHeight'];
      Object.keys(raw).forEach(key => {
        if (!allowed.includes(key)) {
          delete raw[key];
        }
      });
      copy.rawValues = raw;

      if (copy.details) {
        const det = { ...copy.details };
        delete det.pile;
        delete det.pleatType;
        delete det.pleatFactor;
        delete det.fabricQuantity;
        copy.details = det;
      }
    } else if (productGroup === 'Kumaş/Tül/Fon') {
      // Clean up mechanical and plicell fields
      const forbidden = [
        'hemModel', 'laserHem', 'mechanicalArea', 'mechanicalCalculatedWidth',
        'plicellCamListesi', 'camAdedi', 'ortakCamBoyuCm', 'profilRengi', 'glassWidth', 'glassHeight'
      ];
      forbidden.forEach(key => {
        delete raw[key];
      });
      copy.rawValues = raw;
    }
  }

  return copy;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  measurements: [],
  isLoading: false,
  enrichMeasurement, // Expose for testing if needed

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
    const enriched = enrichMeasurement(measurement);
    await saveLocalMeasurementWithSync(enriched, username);
    set(state => ({
      measurements: [...state.measurements, enriched]
    }));
  },

  updateMeasurement: async (measurement, username) => {
    const enriched = enrichMeasurement(measurement);
    await saveLocalMeasurementWithSync(enriched, username);
    set(state => ({
      measurements: state.measurements.map(m => m.id === measurement.id ? enriched : m)
    }));
  },

  deleteMeasurement: async (id, username) => {
    await deleteLocalMeasurement(id, username);
    set(state => ({
      measurements: state.measurements.map(m => m.id === id ? { ...m, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: username } : m)
    }));
  },

  batchUpsertMeasurements: async (newMeasurements) => {
    const enrichedList = newMeasurements.map(enrichMeasurement);
    await batchSaveLocalMeasurements(enrichedList);
    set(state => {
      const existingMap = new Map(state.measurements.map(m => [m.id, m]));
      enrichedList.forEach(nm => existingMap.set(nm.id, nm));
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
