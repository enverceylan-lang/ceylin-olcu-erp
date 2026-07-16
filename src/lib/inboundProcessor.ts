import { useMeasurementStore } from '@/store/measurementStore';
import {
  InboundMeasurement,
  localDraftDb,
} from './localDraftDb';
import {
  Customer,
  Room,
  generateUUID,
  useStore,
} from '@/store/useStore';
import { saveLocalCustomer, loadLocalCustomers } from './localCustomerDb';
import { ensureMeasurementId } from './measurementIdHelper';
/**
 * Strip only heavy binary/base64 data from media arrays, keeping all metadata
 * (localKey, thumbnailRef, mimeType, size, etc.) so references are not lost.
 */
function sanitizeMediaArray(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') {
      // Raw base64 or data-url — drop entirely for local storage
      if (item.startsWith('data:') || item.length > 2000) return null;
      return item;
    }
    if (typeof item === 'object' && item !== null) {
      // Keep all metadata keys; only remove the heavy binary 'data' field
      const { data, base64, ...rest } = item as any;
      return rest;
    }
    return item;
  }).filter(Boolean);
}

/**
 * Cleans a room for local storage:
 *  - Preserves existing IDs (room, window, product) for idempotency
 *  - Generates deterministic legacy IDs when absent
 *  - Sanitizes media: keeps metadata, strips binary data
 */
export async function cleanMediaFromRoom(room: any): Promise<Room> {
  const roomId = room.id || `legacy-r-${(room.name || '').replace(/\s/g, '')}` ;
  const rawWindows = room.windows || [];

  const cleanWindows = await Promise.all(rawWindows.map(async (w: any, wIndex: number) => {
    const winId = w.id || `legacy-w-${roomId}-${(w.name || wIndex).toString().replace(/\s/g, '')}`;
    const rawProducts = w.products || w.measurements || [];

    const cleanProducts = await Promise.all(rawProducts.map(async (p: any, pIndex: number) => {
      const pId = await ensureMeasurementId(p.id, {
        customerId: room.customerId || room.id || room.name || '',
        roomKey: roomId,
        windowKey: winId,
        type: p.templateType || p.type || 'UNKNOWN',
        sourceIndex: pIndex,
      });
      return {
        ...p,
        id: pId,
        photos: sanitizeMediaArray(p.photos || []),
        videos: sanitizeMediaArray(p.videos || []),
      };
    }));

    return {
      ...w,
      id: winId,
      photos: sanitizeMediaArray(w.photos || []),
      videos: sanitizeMediaArray(w.videos || []),
      products: cleanProducts,
    };
  }));

  return {
    ...room,
    id: roomId,
    name: room.name ? `${room.name} - Gelen Ölçü` : 'Gelen Ölçü',
    photos: sanitizeMediaArray(room.photos || []),
    videos: sanitizeMediaArray(room.videos || []),
    windows: cleanWindows,
  } as Room;
}

/**
 * Extract rooms from patch. The patch could be a FieldMeasurementDraft or a Customer object.
 */
async function extractRoomsFromPatch(patch: any): Promise<Room[]> {
  let rooms: any[] = [];
  
  let parsedPatch = patch;
  if (typeof parsedPatch === 'string') {
    try {
      parsedPatch = JSON.parse(parsedPatch);
    } catch (e) {
      console.warn('[InboundProcessor] Could not parse patch as JSON', e);
    }
  }

  if (parsedPatch && Array.isArray(parsedPatch.rooms)) {
    rooms = parsedPatch.rooms;
  }
  return Promise.all(rooms.map(cleanMediaFromRoom));
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

  const rooms = await extractRoomsFromPatch(patch);

  if (patch.syncIntent === 'MEASUREMENT_TREE_RECOVERY' && (!rooms || rooms.length === 0)) {
    await localDraftDb.inboundMeasurements.update(inbound.changeId, {
      status: 'FAILED_MISSING_MEASUREMENT_PAYLOAD' as any
    });
    console.warn(`[InboundProcessor] FAILED_MISSING_MEASUREMENT_PAYLOAD {
  entityType: '${inbound.entityType}',
  entityId: '${inbound.entityId}',
  syncIntent: '${patch.syncIntent}',
  roomsCount: 0
}`);
    throw new Error('Eksik ölçü ağacı: FAILED_MISSING_MEASUREMENT_PAYLOAD.');
  }

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

  // Extract measurements first. Customer tree stores only room/opening structure;
  // measurements are persisted in the independent measurement database.
  const extractedMeas: any[] = [];
  newCustomer.rooms?.forEach((room) =>
    room.windows?.forEach((windowItem) =>
      windowItem.products?.forEach((measurement) =>
        extractedMeas.push({
          ...measurement,
          customerId: newCustomer.id,
          roomId: room.id,
          windowId: windowItem.id,
        })
      )
    )
  );

  const structuralCustomer: Customer = {
    ...newCustomer,
    rooms: (newCustomer.rooms || []).map((room) => ({
      ...room,
      windows: (room.windows || []).map((windowItem) => ({
        ...windowItem,
        products: [],
      })),
    })),
  };

  if (extractedMeas.length > 0) {
    await useMeasurementStore
      .getState()
      .batchUpsertMeasurements(extractedMeas);
  }

  // addCustomer() forces rooms: []; use direct state insertion so inbound rooms survive.
  await saveLocalCustomer(structuralCustomer);
  useStore.setState((state) => {
    const exists = state.customers.some(
      (customer) => customer.id === structuralCustomer.id
    );

    return {
      customers: exists
        ? state.customers.map((customer) =>
            customer.id === structuralCustomer.id
              ? structuralCustomer
              : customer
          )
        : [structuralCustomer, ...state.customers],
      syncStatus: 'pending',
    };
  });

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
  const newRooms = await extractRoomsFromPatch(patch);

  if (patch.syncIntent === 'MEASUREMENT_TREE_RECOVERY' && (!newRooms || newRooms.length === 0)) {
    await localDraftDb.inboundMeasurements.update(inbound.changeId, {
      status: 'FAILED_MISSING_MEASUREMENT_PAYLOAD' as any
    });
    console.warn(`[InboundProcessor] FAILED_MISSING_MEASUREMENT_PAYLOAD {
  entityType: '${inbound.entityType}',
  entityId: '${inbound.entityId}',
  syncIntent: '${patch.syncIntent}',
  roomsCount: 0
}`);
    throw new Error('Eksik ölçü ağacı: FAILED_MISSING_MEASUREMENT_PAYLOAD.');
  }

  // Append, do not merge.
  const updatedCustomer: Customer = {
    ...targetCustomer,
    rooms: [...(targetCustomer.rooms || []), ...newRooms],
    updatedAt: new Date().toISOString()
  };

  // Persist only measurements arriving with this inbound payload.
  const extractedMeas2: any[] = [];
  newRooms.forEach((room) =>
    room.windows?.forEach((windowItem) =>
      windowItem.products?.forEach((measurement) =>
        extractedMeas2.push({
          ...measurement,
          customerId: updatedCustomer.id,
          roomId: room.id,
          windowId: windowItem.id,
        })
      )
    )
  );

  if (extractedMeas2.length > 0) {
    await useMeasurementStore
      .getState()
      .batchUpsertMeasurements(extractedMeas2);
  }

  const structuralUpdatedCustomer: Customer = {
    ...updatedCustomer,
    rooms: (updatedCustomer.rooms || []).map((room) => ({
      ...room,
      windows: (room.windows || []).map((windowItem) => ({
        ...windowItem,
        products: [],
      })),
    })),
  };

  await saveLocalCustomer(structuralUpdatedCustomer);
  useStore.setState((state) => ({
    customers: state.customers.map((customer) =>
      customer.id === structuralUpdatedCustomer.id
        ? structuralUpdatedCustomer
        : customer
    ),
    syncStatus: 'pending',
  }));

  await localDraftDb.inboundMeasurements.update(inbound.changeId, {
    status: 'LINKED_TO_CUSTOMER',
    linkedCustomerId: updatedCustomer.id
  });

  return updatedCustomer;
}