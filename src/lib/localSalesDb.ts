import Dexie, { type Table } from 'dexie';
import { Sale } from '@/store/salesStore';
import {
  captureSaleDeleteForSync,
  captureSaleSaveForSync
} from '@/lib/salesSyncQueueBridge';

class LocalSalesDatabase extends Dexie {
  sales!: Table<Sale, string>;

  constructor() {
    super('CeylinLocalSalesDb');
    this.version(1).stores({
      sales: 'id, customerId, saleNo, status'
    });
  }
}

export const localSalesDb = new LocalSalesDatabase();

export async function loadLocalSales(): Promise<Sale[]> {
  try {
    return await localSalesDb.sales.toArray();
  } catch (err) {
    console.error('[localSalesDb] Failed to load sales:', err);
    return [];
  }
}

export async function saveLocalSale(sale: Sale): Promise<void> {
  try {
    const existing = await localSalesDb.sales.get(sale.id);
    const now = new Date().toISOString();
    const storedSale: Sale = existing
      ? { ...existing, ...sale, updatedAt: now }
      : { ...sale, createdAt: now, updatedAt: now };

    if (existing) {
      await localSalesDb.sales.put(storedSale);
    } else {
      await localSalesDb.sales.add(storedSale);
    }

    try {
      await captureSaleSaveForSync(
        storedSale,
        existing
      );
    } catch {
      console.error(
        '[localSalesDb] Sale saved locally, but sync queue capture failed.'
      );
    }
  } catch (err) {
    console.error('[localSalesDb] Failed to save sale:', err);
    throw err;
  }
}

export async function deleteLocalSale(id: string): Promise<void> {
  try {
    const existing = await localSalesDb.sales.get(id);

    if (existing) {
      try {
        await captureSaleDeleteForSync(existing);
      } catch {
        console.error(
          '[localSalesDb] Local delete will continue; sync tombstone capture failed.'
        );
      }
    }

    await localSalesDb.sales.delete(id);
  } catch (err) {
    console.error('[localSalesDb] Failed to delete sale:', err);
    throw err;
  }
}

export async function getLocalSale(id: string): Promise<Sale | undefined> {
  try {
    return await localSalesDb.sales.get(id);
  } catch (err) {
    console.error('[localSalesDb] Failed to get sale:', err);
    return undefined;
  }
}
