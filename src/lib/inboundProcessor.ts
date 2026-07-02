import { InboundMeasurement, localDraftDb, updateInboundStatus } from './localDraftDb';
import { Customer, Room, WindowItem, ProductMeasurement, generateUUID, useStore } from '@/store/useStore';
import { saveLocalCustomer, loadLocalCustomers } from './localCustomerDb';

/**
 * Strips out media arrays to ensure we don't save REDACTED strings to IndexedDB.
 */
function cleanMediaFromRoom(room: any): Room {
  const cleanWindows = (room.windows || []).map((w: any) => {
    const cleanProducts = (w.products || []).map((p: any) => {
      return {
        ...p,
        id: generateUUID(), // New ID to prevent reference clashes
        photos: [],
        videos: [],
      };
    });

    return {
      ...w,
      id: generateUUID(),
      photos: [],
      videos: [],
      products: cleanProducts
    };
  });

  return {
    ...room,
    id: generateUUID(),
    name: room.name ? `${room.name} - Gelen Ölçü` : 'Gelen Ölçü', // Suffix as requested
    photos: [],
    videos: [],
    windows: cleanWindows
  };
}

/**
 * Extract rooms from patch. The patch could be a FieldMeasurementDraft or a Customer object.
 */
function extractRoomsFromPatch(patch: any): Room[] {
  let rooms: any[] = [];
  if (patch && Array.isArray(patch.rooms)) {
    rooms = patch.rooms;
  }
  return rooms.map(cleanMediaFromRoom);
}

/**
 * Creates a brand new customer from the inbound data.
 */
export async function processAsNewCustomer(inbound: InboundMeasurement, adminId: string, adminName: string): Promise<Customer> {
  const existing = await localDraftDb.inboundMeasurements.get(inbound.changeId);
  if (existing?.status === 'CREATED_CUSTOMER' || existing?.status === 'LINKED_TO_CUSTOMER') {
    throw new Error('Bu kayıt daha önce işlenmiş.');
  }

  const patch = inbound.patch || {};
  const customerName = (inbound.customerName || patch.customerName || patch.name || 'İsimsiz Müşteri').trim();
  const customerPhone = (inbound.customerPhone || patch.customerPhone || patch.phone || '').trim();
  const customerAddress = (inbound.customerAddress || patch.customerAddress || patch.address || '').trim();

  const rooms = extractRoomsFromPatch(patch);

  const newCustomer: Customer = {
    id: generateUUID(),
    name: customerName,
    phone: customerPhone,
    address: customerAddress,
    mapLocation: patch.mapLocation || '',
    notes: patch.notes || patch.generalNote || '',
    rooms: rooms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: adminId,
    createdByName: adminName,
    addressPhotos: [],
    isDeleted: false
  };

  await saveLocalCustomer(newCustomer);
  useStore.getState().addCustomer(newCustomer);
  
  await localDraftDb.inboundMeasurements.update(inbound.changeId, { 
    status: 'CREATED_CUSTOMER',
    createdCustomerId: newCustomer.id
  });

  return newCustomer;
}

/**
 * Appends the inbound rooms to an existing customer. Never merges or overwrites.
 */
export async function processAsMerge(inbound: InboundMeasurement, customerId: string): Promise<Customer> {
  const existingInbound = await localDraftDb.inboundMeasurements.get(inbound.changeId);
  if (existingInbound?.status === 'CREATED_CUSTOMER' || existingInbound?.status === 'LINKED_TO_CUSTOMER') {
    throw new Error('Bu kayıt daha önce işlenmiş.');
  }

  const customers = await loadLocalCustomers();
  const targetCustomer = customers.find(c => c.id === customerId);
  
  if (!targetCustomer) {
    throw new Error('Hedef müşteri bulunamadı.');
  }

  const patch = inbound.patch || {};
  const newRooms = extractRoomsFromPatch(patch);

  // Append, do not merge.
  const updatedCustomer: Customer = {
    ...targetCustomer,
    rooms: [...(targetCustomer.rooms || []), ...newRooms],
    updatedAt: new Date().toISOString()
  };

  await saveLocalCustomer(updatedCustomer);
  useStore.getState().updateCustomer(updatedCustomer.id, { rooms: updatedCustomer.rooms, updatedAt: updatedCustomer.updatedAt });

  await localDraftDb.inboundMeasurements.update(inbound.changeId, {
    status: 'LINKED_TO_CUSTOMER',
    linkedCustomerId: updatedCustomer.id
  });

  return updatedCustomer;
}
