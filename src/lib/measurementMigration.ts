import { useStore } from '@/store/useStore';
import { useMeasurementStore, MeasurementRecord } from '@/store/measurementStore';
import { ensureMeasurementId, MEASUREMENT_MIGRATION_STATUS_KEY } from './measurementIdHelper';

export async function runMeasurementMigration() {
  try {

  console.log('[Migration] Bağımsız Ölçüler Modülü V1 Migrasyonu başlatılıyor...');
  
  const customers = useStore.getState().customers;
  const measurementStore = useMeasurementStore.getState();
  
  // Ensure we have loaded the existing measurements to avoid duplicates
  await measurementStore.loadMeasurements();
  const existingMeasurements = measurementStore.measurements;
  const existingIds = new Set(existingMeasurements.map(m => m.id));
  
  let totalMeasurementsInNested = 0;
  let newMeasurementsToMigrate: MeasurementRecord[] = [];
  
  // Traverse the nested structure
  for (const customer of customers) {
    if (!customer.rooms) continue;
    
    for (const room of customer.rooms) {
      if (!room.windows) continue;
      
      for (const window of room.windows) {
        if (!window.products) continue;
        
        let sourceIndex = 0;
        for (const product of window.products) {
          totalMeasurementsInNested++;
          
          // Use shared helper: preserve existing ID or produce deterministic legacy ID
          const stableId = await ensureMeasurementId(product.id, {
            customerId: customer.id,
            roomKey: room.id || room.name || '',
            windowKey: window.id || window.name || '',
            type: (product as any).templateType || (product as any).type || 'UNKNOWN',
            sourceIndex,
          });
          sourceIndex++;
          
          if (!existingIds.has(stableId)) {
            const newRecord: MeasurementRecord = {
              ...product,
              id: stableId,
              customerId: customer.id,
              roomId: room.id,
              windowId: window.id,
              // Inherit lifecycle states from customer if not already present on product
              isArchived: product.isArchived || customer.isArchived,
              archivedAt: product.archivedAt || customer.archivedAt,
              archivedBy: product.archivedBy || customer.archivedBy,
              archiveBatchId: product.archiveBatchId || customer.archiveBatchId,
              isDeleted: product.isDeleted || customer.isDeleted,
              deletedAt: product.deletedAt || customer.deletedAt,
              deletedBy: product.deletedBy || customer.deletedBy,
              deleteBatchId: product.deleteBatchId || customer.deleteBatchId,
            };
            
            newMeasurementsToMigrate.push(newRecord);
          }
        }
      }
    }
  }
  
  if (newMeasurementsToMigrate.length > 0) {
    console.log(`[Migration] ${newMeasurementsToMigrate.length} adet yeni ölçü bulundu, aktarılıyor...`);
    await measurementStore.batchUpsertMeasurements(newMeasurementsToMigrate);
  } else {
    console.log('[Migration] Aktarılacak yeni ölçü bulunamadı (Ölçüler güncel).');
  }
  
  console.log(`[Migration] İstatistik: Nested Toplam=${totalMeasurementsInNested}, Yeni Eklenen=${newMeasurementsToMigrate.length}, Store Toplam=${measurementStore.measurements.length + newMeasurementsToMigrate.length}`);

  const marker = {
    version: 1,
    completedAt: new Date().toISOString(),
    migratedCount: newMeasurementsToMigrate.length
  };
  localStorage.setItem(MEASUREMENT_MIGRATION_STATUS_KEY, JSON.stringify(marker));
  console.log('[Migration] Marker yazıldı:', marker);
  } catch (error) {
    console.error('[Migration] Failed:', error);
    throw error;
  }
}
