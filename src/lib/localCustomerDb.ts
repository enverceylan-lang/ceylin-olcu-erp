import Dexie, { type Table } from 'dexie';
import { Customer } from '@/store/useStore';

class LocalCustomerDatabase extends Dexie {
  customers!: Table<Customer, string>;

  constructor() {
    super('CeylinLocalCustomerDb');
    this.version(1).stores({
      customers: 'id, isDeleted'
    });
  }
}

export const localCustomerDb = new LocalCustomerDatabase();

export async function loadLocalCustomers(): Promise<Customer[]> {
  try {
    return await localCustomerDb.customers.toArray();
  } catch (err) {
    console.error('[localCustomerDb] Failed to load customers:', err);
    return [];
  }
}

export async function saveLocalCustomer(customer: Customer): Promise<void> {
  try {
    await localCustomerDb.customers.put(customer);
  } catch (err) {
    console.error('[localCustomerDb] Failed to save customer:', err);
    throw err;
  }
}

export async function saveLocalCustomers(customers: Customer[]): Promise<void> {
  try {
    await localCustomerDb.customers.bulkPut(customers);
  } catch (err) {
    console.error('[localCustomerDb] Failed to bulk save customers:', err);
    throw err;
  }
}

export async function softDeleteLocalCustomer(id: string): Promise<void> {
  try {
    const customer = await localCustomerDb.customers.get(id);
    if (customer) {
      const now = new Date().toISOString();
      customer.isDeleted = true;
      customer.deletedAt = now;
      customer.updatedAt = now;
      await localCustomerDb.customers.put(customer);
    }
  } catch (err) {
    console.error('[localCustomerDb] Failed to soft delete customer:', err);
    throw err;
  }
}

export async function clearLocalCustomers(): Promise<void> {
  try {
    await localCustomerDb.customers.clear();
  } catch (err) {
    console.error('[localCustomerDb] Failed to clear customers:', err);
    throw err;
  }
}
