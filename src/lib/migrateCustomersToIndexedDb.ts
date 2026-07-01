import { localCustomerDb, saveLocalCustomers } from './localCustomerDb';
import type { Customer } from '@/store/useStore';

const LEGACY_LS_KEY = 'curtain-erp-storage-v3';
const BACKUP_LS_KEY = 'ceylin_customers_backup';
const MIGRATION_DONE_KEY = 'ceylin_idb_migration_v1_done';

function readLegacyCustomers(): Customer[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const customers = parsed?.state?.customers;
    if (Array.isArray(customers) && customers.length > 0) {
      return customers as Customer[];
    }
    return [];
  } catch {
    return [];
  }
}

function readBackupCustomers(): Customer[] {
  try {
    const raw = window.localStorage.getItem(BACKUP_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as Customer[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function migrateLocalStorageCustomersToIndexedDb(): Promise<{
  legacyCount: number;
  backupCount: number;
  idbBefore: number;
  migratedCount: number;
  idbAfter: number;
  error: string | null;
}> {
  const result = {
    legacyCount: 0,
    backupCount: 0,
    idbBefore: 0,
    migratedCount: 0,
    idbAfter: 0,
    error: null as string | null,
  };

  try {
    // Skip if already done
    if (window.localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
      const existing = await localCustomerDb.customers.toArray();
      result.idbBefore = existing.length;
      result.idbAfter = existing.length;
      return result;
    }

    // 1. Read sources
    const legacy = readLegacyCustomers();
    const backup = readBackupCustomers();
    result.legacyCount = legacy.length;
    result.backupCount = backup.length;

    // 2. Read current IndexedDB state
    const idbExisting = await localCustomerDb.customers.toArray();
    result.idbBefore = idbExisting.length;

    if (legacy.length === 0 && backup.length === 0) {
      // Nothing to migrate — mark done
      window.localStorage.setItem(MIGRATION_DONE_KEY, 'true');
      result.idbAfter = idbExisting.length;
      return result;
    }

    // 3. Build a map of IndexedDB entries (id -> customer) for merge
    const idbMap = new Map<string, Customer>();
    for (const c of idbExisting) {
      idbMap.set(c.id, c);
    }

    // 4. Build a merged source map from legacy + backup (newer updatedAt wins)
    const sourceMap = new Map<string, Customer>();
    for (const list of [backup, legacy]) {
      for (const c of list) {
        if (!c.id) continue;
        const existing = sourceMap.get(c.id);
        if (!existing) {
          sourceMap.set(c.id, c);
        } else {
          // Keep the one with newer updatedAt
          const existingTs = new Date(existing.updatedAt || 0).getTime();
          const candidateTs = new Date(c.updatedAt || 0).getTime();
          if (candidateTs > existingTs) {
            sourceMap.set(c.id, c);
          }
        }
      }
    }

    // 5. Determine which records to upsert into IndexedDB
    const toWrite: Customer[] = [];
    for (const [id, sourceCustomer] of sourceMap.entries()) {
      const idbCustomer = idbMap.get(id);
      if (!idbCustomer) {
        // Not in IndexedDB at all — add it
        toWrite.push(sourceCustomer);
      } else {
        // In IndexedDB — keep newer updatedAt version
        const idbTs = new Date(idbCustomer.updatedAt || 0).getTime();
        const srcTs = new Date(sourceCustomer.updatedAt || 0).getTime();
        if (srcTs > idbTs) {
          toWrite.push(sourceCustomer);
        }
      }
    }

    // 6. Write to IndexedDB
    if (toWrite.length > 0) {
      await saveLocalCustomers(toWrite);
      result.migratedCount = toWrite.length;
    }

    // 7. Count final IndexedDB state
    const idbFinal = await localCustomerDb.customers.toArray();
    result.idbAfter = idbFinal.length;

    // 8. Mark migration done (do not delete localStorage data)
    window.localStorage.setItem(MIGRATION_DONE_KEY, 'true');

  } catch (err: any) {
    result.error = String(err?.message || err);
    console.error('[Migration] Failed to migrate customers to IndexedDB:', err);
  }

  return result;
}
