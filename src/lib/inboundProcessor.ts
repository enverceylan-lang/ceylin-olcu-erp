import { useMeasurementStore } from "@/store/measurementStore";
import { InboundMeasurement, localDraftDb } from "./localDraftDb";
import { Customer, Room, generateUUID, useStore } from "@/store/useStore";
import { saveLocalCustomer, loadLocalCustomers } from "./localCustomerDb";
import { ensureMeasurementId } from "./measurementIdHelper";
import { localMeasurementDb } from "./localMeasurementDb";

/**
 * Strip only heavy binary/base64 data from media arrays, keeping all metadata
 * (localKey, thumbnailRef, mimeType, size, etc.) so references are not lost.
 */
function sanitizeMediaArray(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === "string") {
        // Raw base64 or data-url — drop entirely for local storage
        if (item.startsWith("data:") || item.length > 2000) return null;
        return item;
      }
      if (typeof item === "object" && item !== null) {
        // Keep all metadata keys; only remove the heavy binary 'data' field
        const { data, base64, ...rest } = item as any;
        return rest;
      }
      return item;
    })
    .filter(Boolean);
}

/**
 * Cleans a room for local storage:
 *  - Preserves existing IDs (room, window, product) for idempotency
 *  - Generates deterministic legacy IDs when absent
 *  - Sanitizes media: keeps metadata, strips binary data
 */
export async function cleanMediaFromRoom(room: any): Promise<Room> {
  const roomId = room.id || `legacy-r-${(room.name || "").replace(/\s/g, "")}`;
  const rawWindows = room.windows || room.openings || [];

  const cleanWindows = await Promise.all(
    rawWindows.map(async (w: any, wIndex: number) => {
      const winId =
        w.id ||
        `legacy-w-${roomId}-${(w.name || wIndex).toString().replace(/\s/g, "")}`;
      const rawProducts = w.products || w.measurements || [];

      const cleanProducts = await Promise.all(
        rawProducts.map(async (p: any, pIndex: number) => {
          const pId = await ensureMeasurementId(p.id, {
            customerId: room.customerId || room.id || room.name || "",
            roomKey: roomId,
            windowKey: winId,
            type: p.templateType || p.type || "UNKNOWN",
            sourceIndex: pIndex,
          });
          return {
            ...p,
            id: pId,
            openingId: p.openingId || p.windowId || winId,
            photos: sanitizeMediaArray(p.photos || []),
            videos: sanitizeMediaArray(p.videos || []),
          };
        }),
      );

      return {
        ...w,
        id: winId,
        photos: sanitizeMediaArray(w.photos || []),
        videos: sanitizeMediaArray(w.videos || []),
        products: cleanProducts,
      };
    }),
  );

  return {
    ...room,
    id: roomId,
    name: room.name ? `${room.name} - Gelen Ölçü` : "Gelen Ölçü",
    photos: sanitizeMediaArray(room.photos || []),
    videos: sanitizeMediaArray(room.videos || []),
    windows: cleanWindows,
  } as Room;
}

/**
 * Extract rooms from patch. The patch could be a FieldMeasurementDraft or a Customer object.
 */
async function extractRoomsFromPatch(patch: any): Promise<Room[]> {
  let parsedPatch = patch;
  if (typeof parsedPatch === "string") {
    try {
      parsedPatch = JSON.parse(parsedPatch);
    } catch (e) {
      console.warn("[InboundProcessor] Could not parse patch as JSON", e);
      parsedPatch = {};
    }
  }

  const candidates = [
    parsedPatch?.rooms,
    parsedPatch?.data?.rooms,
    parsedPatch?.customer?.rooms,
    parsedPatch?.data?.customer?.rooms,
  ];
  const rooms = candidates.find(Array.isArray) || [];
  return Promise.all(rooms.map(cleanMediaFromRoom));
}

function normalizeSourceCustomerIds(
  inbound: InboundMeasurement,
  patch: any,
): string[] {
  return Array.from(
    new Set(
      [
        patch?.customerId,
        patch?.temporaryCustomerId,
        patch?.data?.customerId,
        patch?.data?.temporaryCustomerId,
        patch?.customer?.id,
        patch?.data?.customer?.id,
        inbound.entityId,
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );
}

function normalizeStandaloneMeasurement(measurement: any): any | null {
  const id = measurement?.id;
  const roomId = measurement?.roomId;
  const openingId = measurement?.openingId || measurement?.windowId;
  if (!id || !roomId || !openingId) return null;

  return {
    ...measurement,
    id,
    roomId,
    openingId,
  };
}

async function loadMeasurementsForInbound(
  sourceCustomerIds: string[],
  nestedMeasurements: any[],
): Promise<any[]> {
  const byId = new Map<string, any>();

  nestedMeasurements.forEach((measurement) => {
    const normalized = normalizeStandaloneMeasurement(measurement);
    if (normalized) byId.set(normalized.id, normalized);
  });

  const sourceIds = new Set(sourceCustomerIds);
  const localMeasurements = await localMeasurementDb.measurements.toArray();
  localMeasurements.forEach((measurement: any) => {
    if (!sourceIds.has(measurement.customerId)) return;
    const normalized = normalizeStandaloneMeasurement(measurement);
    if (normalized) byId.set(normalized.id, normalized);
  });

  return Array.from(byId.values());
}

function roomNameFromMeasurement(measurement: any, index: number): string {
  return (
    measurement.roomName ||
    measurement.roomLabel ||
    measurement.details?.roomName ||
    `Gelen Oda ${index + 1}`
  );
}

function openingNameFromMeasurement(measurement: any, index: number): string {
  return (
    measurement.openingName ||
    measurement.windowName ||
    measurement.openingLabel ||
    measurement.details?.openingName ||
    `Açıklık ${index + 1}`
  );
}

function buildStructuralRoomsFromMeasurements(measurements: any[]): Room[] {
  const roomsById = new Map<string, any>();

  measurements.forEach((measurement, measurementIndex) => {
    const roomId = measurement.roomId;
    const openingId = measurement.openingId || measurement.windowId;
    if (!roomId || !openingId) return;

    let room = roomsById.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: roomNameFromMeasurement(measurement, roomsById.size),
        photos: [],
        videos: [],
        windows: [],
      };
      roomsById.set(roomId, room);
    }

    if (!room.windows.some((opening: any) => opening.id === openingId)) {
      room.windows.push({
        id: openingId,
        name: openingNameFromMeasurement(measurement, room.windows.length),
        photos: [],
        videos: [],
        products: [],
      });
    }
  });

  return Array.from(roomsById.values()) as Room[];
}

function mergeRoomStructures(baseRooms: Room[], incomingRooms: Room[]): Room[] {
  const roomMap = new Map<string, any>();

  const addRoom = (room: Room) => {
    const current = roomMap.get(room.id);
    if (!current) {
      roomMap.set(room.id, {
        ...room,
        windows: (room.windows || []).map((opening) => ({
          ...opening,
          products: [],
        })),
      });
      return;
    }

    const openingMap = new Map<string, any>();
    (current.windows || []).forEach((opening: any) =>
      openingMap.set(opening.id, opening),
    );
    (room.windows || []).forEach((opening: any) => {
      const existingOpening = openingMap.get(opening.id);
      openingMap.set(
        opening.id,
        existingOpening
          ? { ...existingOpening, ...opening, products: [] }
          : { ...opening, products: [] },
      );
    });

    roomMap.set(room.id, {
      ...current,
      ...room,
      windows: Array.from(openingMap.values()),
    });
  };

  baseRooms.forEach(addRoom);
  incomingRooms.forEach(addRoom);
  return Array.from(roomMap.values()) as Room[];
}

function extractMeasurementsForCustomer(
  rooms: Room[],
  customerId: string,
): any[] {
  const measurements: any[] = [];
  rooms.forEach((room) =>
    (room.windows || []).forEach((opening) =>
      (opening.products || []).forEach((measurement: any) =>
        measurements.push({
          ...measurement,
          customerId,
          roomId: room.id,
          openingId:
            measurement.openingId || measurement.windowId || opening.id,
        }),
      ),
    ),
  );
  return measurements;
}

async function persistAndVerifyMeasurements(
  measurements: any[],
): Promise<void> {
  if (measurements.length === 0) {
    throw new Error(
      "Bu gelen kayda ait geçerli ölçü bulunamadı. Cari işlemi durduruldu.",
    );
  }

  await useMeasurementStore.getState().batchUpsertMeasurements(measurements);
  const persisted = await localMeasurementDb.measurements.bulkGet(
    measurements.map((m) => m.id),
  );
  const persistedById = new Map(
    persisted
      .filter(Boolean)
      .map((measurement: any) => [measurement.id, measurement]),
  );

  const invalid = measurements.filter((expected) => {
    const actual: any = persistedById.get(expected.id);
    if (!actual) return true;
    return (
      actual.customerId !== expected.customerId ||
      actual.roomId !== expected.roomId ||
      (actual.openingId || actual.windowId) !==
        (expected.openingId || expected.windowId)
    );
  });

  if (invalid.length > 0) {
    throw new Error(
      `Ölçü bağlantı doğrulaması başarısız: ${invalid.map((m) => m.id).join(", ")}`,
    );
  }
}

function assignMeasurementsToCustomer(
  measurements: any[],
  customerId: string,
): any[] {
  return measurements.map((measurement) => ({
    ...measurement,
    customerId,
    openingId: measurement.openingId || measurement.windowId,
  }));
}

/**
 * Creates a brand new customer from the inbound data.
 */
export async function processAsNewCustomer(
  inbound: InboundMeasurement,
  adminId: string,
  adminName: string,
): Promise<Customer> {
  const existing = await localDraftDb.inboundMeasurements.get(inbound.changeId);
  if (
    existing?.status === "CREATED_CUSTOMER" ||
    existing?.status === "LINKED_TO_CUSTOMER"
  ) {
    throw new Error("Bu kayıt daha önce işlenmiş.");
  }

  const patch = inbound.patch || {};
  const patchData = patch?.data || {};
  const customerName = (
    inbound.customerName ||
    patch.customerName ||
    patchData.customerName ||
    patch.name ||
    patchData.name ||
    "İsimsiz Müşteri"
  ).trim();
  const customerPhone = (
    inbound.customerPhone ||
    patch.customerPhone ||
    patchData.customerPhone ||
    patch.phone ||
    patchData.phone ||
    ""
  ).trim();
  const customerAddress = (
    inbound.customerAddress ||
    patch.customerAddress ||
    patchData.customerAddress ||
    patch.address ||
    patchData.address ||
    ""
  ).trim();
  const sourceCustomerIds = normalizeSourceCustomerIds(inbound, patch);

  const patchRooms = await extractRoomsFromPatch(patch);
  const nestedMeasurements = extractMeasurementsForCustomer(
    patchRooms,
    sourceCustomerIds[0] || inbound.entityId,
  );
  const sourceMeasurements = await loadMeasurementsForInbound(
    sourceCustomerIds,
    nestedMeasurements,
  );

  if (sourceMeasurements.length === 0) {
    throw new Error(
      "Bu gelen cari kaydına bağlı ölçü bulunamadı. Cari oluşturulmadı; kayıt havuzda korunuyor.",
    );
  }

  const derivedRooms = buildStructuralRoomsFromMeasurements(sourceMeasurements);
  const structuralRooms = mergeRoomStructures(patchRooms, derivedRooms);
  if (structuralRooms.length === 0) {
    throw new Error(
      "Ölçüler bulundu ancak oda/açıklık bağlantısı oluşturulamadı. Cari oluşturulmadı.",
    );
  }

  const pendingCustomerId = existing?.pendingCustomerId || generateUUID();
  if (!existing?.pendingCustomerId) {
    await localDraftDb.inboundMeasurements.update(inbound.changeId, {
      pendingCustomerId,
    });
  }

  const approvedMeasurements = assignMeasurementsToCustomer(
    sourceMeasurements,
    pendingCustomerId,
  );
  await persistAndVerifyMeasurements(approvedMeasurements);

  const now = new Date().toISOString();
  const structuralCustomer: Customer = {
    id: pendingCustomerId,
    name: customerName,
    phone: customerPhone,
    address: customerAddress,
    mapLocation: patch.mapLocation || patchData.mapLocation || "",
    notes:
      patch.notes ||
      patchData.notes ||
      patch.generalNote ||
      patchData.generalNote ||
      "",
    rooms: structuralRooms,
    createdAt: now,
    updatedAt: now,
    createdById: adminId,
    createdByName: adminName,
    addressPhotos: [],
    isDeleted: false,
  };

  await saveLocalCustomer(structuralCustomer);
  useStore.setState((state) => {
    const exists = state.customers.some(
      (customer) => customer.id === structuralCustomer.id,
    );
    return {
      customers: exists
        ? state.customers.map((customer) =>
            customer.id === structuralCustomer.id
              ? structuralCustomer
              : customer,
          )
        : [structuralCustomer, ...state.customers],
      syncStatus: "pending",
    };
  });

  await localDraftDb.inboundMeasurements.update(inbound.changeId, {
    status: "CREATED_CUSTOMER",
    createdCustomerId: structuralCustomer.id,
  });

  return structuralCustomer;
}

/**
 * Links inbound measurements to an existing customer.
 * Measurement records stay in the measurement module; only room/opening structure is added to Cari.
 */
export async function processAsMerge(
  inbound: InboundMeasurement,
  customerId: string,
): Promise<Customer> {
  const existingInbound = await localDraftDb.inboundMeasurements.get(
    inbound.changeId,
  );
  if (
    existingInbound?.status === "CREATED_CUSTOMER" ||
    existingInbound?.status === "LINKED_TO_CUSTOMER"
  ) {
    throw new Error("Bu kayıt daha önce işlenmiş.");
  }

  const customers = await loadLocalCustomers();
  const targetCustomer = customers.find((c) => c.id === customerId);
  if (!targetCustomer) {
    throw new Error("Hedef müşteri bulunamadı.");
  }

  const patch = inbound.patch || {};
  const sourceCustomerIds = normalizeSourceCustomerIds(inbound, patch);
  const patchRooms = await extractRoomsFromPatch(patch);
  const nestedMeasurements = extractMeasurementsForCustomer(
    patchRooms,
    sourceCustomerIds[0] || inbound.entityId,
  );
  const sourceMeasurements = await loadMeasurementsForInbound(
    sourceCustomerIds,
    nestedMeasurements,
  );

  if (sourceMeasurements.length === 0) {
    throw new Error(
      "Bu gelen kayda bağlı ölçü bulunamadı. Cari bağlantısı yapılmadı; kayıt havuzda korunuyor.",
    );
  }

  const derivedRooms = buildStructuralRoomsFromMeasurements(sourceMeasurements);
  const incomingStructures = mergeRoomStructures(patchRooms, derivedRooms);
  if (incomingStructures.length === 0) {
    throw new Error(
      "Ölçüler bulundu ancak oda/açıklık bağlantısı oluşturulamadı. Cari bağlantısı yapılmadı.",
    );
  }

  const approvedMeasurements = assignMeasurementsToCustomer(
    sourceMeasurements,
    targetCustomer.id,
  );
  await persistAndVerifyMeasurements(approvedMeasurements);

  const structuralUpdatedCustomer: Customer = {
    ...targetCustomer,
    rooms: mergeRoomStructures(targetCustomer.rooms || [], incomingStructures),
    updatedAt: new Date().toISOString(),
  };

  await saveLocalCustomer(structuralUpdatedCustomer);
  useStore.setState((state) => ({
    customers: state.customers.map((customer) =>
      customer.id === structuralUpdatedCustomer.id
        ? structuralUpdatedCustomer
        : customer,
    ),
    syncStatus: "pending",
  }));

  await localDraftDb.inboundMeasurements.update(inbound.changeId, {
    status: "LINKED_TO_CUSTOMER",
    linkedCustomerId: structuralUpdatedCustomer.id,
  });

  return structuralUpdatedCustomer;
}