import Dexie, { type Table } from 'dexie';
import { Sale } from '@/store/salesStore';

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
    if (existing) {
      await localSalesDb.sales.put({ ...existing, ...sale, updatedAt: new Date().toISOString() });
    } else {
      await localSalesDb.sales.add({ ...sale, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error('[localSalesDb] Failed to save sale:', err);
    throw err;
  }
}

export async function deleteLocalSale(id: string): Promise<void> {
  try {
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
