import { useMeasurementStore } from "@/store/measurementStore";
import { InboundMeasurement, localDraftDb } from "./localDraftDb";
import { Customer, Room, generateUUID, useStore } from "@/store/useStore";
import { saveLocalCustomer, loadLocalCustomers } from "./localCustomerDb";
import { ensureMeasurementId } from "./measurementIdHelper";
import { localMeasurementDb } from "./localMeasurementDb";

type LocalMeasurement = ReturnType<
  typeof useMeasurementStore.getState
>["measurements"][number];

interface MeasurementNameReference {
  roomName?: string;
  roomLabel?: string;
  openingName?: string;
  windowName?: string;
  openingLabel?: string;
}

type MeasurementPayload = Omit<
  Partial<LocalMeasurement>,
  "photos" | "videos"
> &
  MeasurementNameReference & {
    details?: MeasurementNameReference;
    data?: MeasurementPayload;
    patch?: MeasurementNameReference & {
      data?: MeasurementNameReference;
    };
    room?: { name?: string };
    opening?: { name?: string };
    window?: { name?: string };
    type?: string;
    photos?: unknown[];
    videos?: unknown[];
  };

type RoomOpening = NonNullable<Room["windows"]>[number];

type IncomingOpening = Omit<
  Partial<RoomOpening>,
  "photos" | "videos" | "products"
> & {
  id?: string;
  name?: string;
  products?: MeasurementPayload[];
  measurements?: MeasurementPayload[];
  photos?: unknown[];
  videos?: unknown[];
};

type IncomingRoom = Omit<
  Partial<Room>,
  "photos" | "videos" | "windows"
> & {
  id?: string;
  name?: string;
  customerId?: string;
  windows?: IncomingOpening[];
  openings?: IncomingOpening[];
  photos?: unknown[];
  videos?: unknown[];
};

interface InboundCustomerPatch {
  id?: string;
  rooms?: IncomingRoom[];
}

interface InboundPatch {
  customerId?: string;
  temporaryCustomerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  name?: string;
  phone?: string;
  address?: string;
  mapLocation?: string;
  notes?: string;
  generalNote?: string;
  rooms?: IncomingRoom[];
  customer?: InboundCustomerPatch;
  measurements?: MeasurementPayload[];
  data?: InboundPatch;
}

type StructuralRoom = Room & {
  windows: NonNullable<Room["windows"]>;
};

/**
 * Strip only heavy binary/base64 data from media arrays, keeping all metadata
 * (localKey, thumbnailRef, mimeType, size, etc.) so references are not lost.
 */
function sanitizeMediaArray(arr: unknown[]): unknown[] {
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
        const record = item as Record<string, unknown>;
        const { data: _data, base64: _base64, ...rest } = record;
        void _data;
        void _base64;
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
export async function cleanMediaFromRoom(
  room: IncomingRoom,
): Promise<Room> {
  const roomId = room.id || `legacy-r-${(room.name || "").replace(/\s/g, "")}`;
  const rawWindows = room.windows || room.openings || [];

  const cleanWindows = await Promise.all(
    rawWindows.map(async (w: IncomingOpening, wIndex: number) => {
      const winId =
        w.id ||
        `legacy-w-${roomId}-${(w.name || wIndex).toString().replace(/\s/g, "")}`;
      const rawProducts = w.products || w.measurements || [];

      const cleanProducts = await Promise.all(
        rawProducts.map(async (p: MeasurementPayload, pIndex: number) => {
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
async function extractRoomsFromPatch(
  patch: InboundPatch | string,
): Promise<Room[]> {
  let parsedPatch: InboundPatch = typeof patch === "string" ? {} : patch;
  if (typeof patch === "string") {
    try {
      parsedPatch = JSON.parse(patch) as InboundPatch;
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
  patch: InboundPatch,
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

function normalizeStandaloneMeasurement(
  measurement: MeasurementPayload,
): LocalMeasurement | null {
  const id = measurement?.id;
  const roomId = measurement?.roomId;
  const openingId = measurement?.openingId || measurement?.windowId;
  if (!id || !roomId || !openingId) return null;

  return {
    ...measurement,
    id,
    roomId,
    openingId,
  } as LocalMeasurement;
}

async function loadMeasurementsForInbound(
  sourceCustomerIds: string[],
  nestedMeasurements: MeasurementPayload[],
): Promise<LocalMeasurement[]> {
  const byId = new Map<string, LocalMeasurement>();

  nestedMeasurements.forEach((measurement) => {
    const normalized = normalizeStandaloneMeasurement(measurement);
    if (normalized) byId.set(normalized.id, normalized);
  });

  const sourceIds = new Set(sourceCustomerIds);
  const localMeasurements = await localMeasurementDb.measurements.toArray();
  localMeasurements.forEach((measurement) => {
    if (!sourceIds.has(measurement.customerId)) return;
    const normalized = normalizeStandaloneMeasurement(measurement);
    if (normalized) byId.set(normalized.id, normalized);
  });

  return Array.from(byId.values());
}

function extractStandaloneMeasurementsFromPatch(
  patch: InboundPatch,
): LocalMeasurement[] {
  const candidates = [
    patch.measurements,
    patch.data?.measurements,
  ];
  const rawMeasurements =
    candidates.find((value): value is MeasurementPayload[] =>
      Array.isArray(value),
    ) || [];

  return rawMeasurements
    .map((measurement) => normalizeStandaloneMeasurement(measurement))
    .filter(
      (measurement): measurement is LocalMeasurement =>
        measurement !== null,
    );
}

function mergeMeasurementsById(
  ...measurementSets: LocalMeasurement[][]
): LocalMeasurement[] {
  const byId = new Map<string, LocalMeasurement>();

  measurementSets.forEach((measurements) => {
    measurements.forEach((measurement) => {
      byId.set(measurement.id, measurement);
    });
  });

  return Array.from(byId.values());
}

async function loadRelatedMeasurementGroups(
  sourceCustomerIds: string[],
): Promise<{
  groups: InboundMeasurement[];
  measurements: LocalMeasurement[];
}> {
  const sourceIdSet = new Set(
    sourceCustomerIds
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  const rows = await localDraftDb.inboundMeasurements.toArray();
  const groups = rows.filter((item) => {
    if (item.entityType !== "MEASUREMENT_GROUP") return false;
    if (item.status !== "NEW" && item.status !== "MATCH_PENDING") {
      return false;
    }

    const patch = (item.patch || {}) as InboundPatch;
    const groupSourceIds = normalizeSourceCustomerIds(item, patch);
    return groupSourceIds.some((sourceId) => sourceIdSet.has(sourceId));
  });

  const measurements = groups.flatMap((group) =>
    extractStandaloneMeasurementsFromPatch(
      (group.patch || {}) as InboundPatch,
    ),
  );

  return {
    groups,
    measurements: mergeMeasurementsById(measurements),
  };
}

async function completeRelatedMeasurementGroups(
  groups: InboundMeasurement[],
  status: "CREATED_CUSTOMER" | "LINKED_TO_CUSTOMER",
  targetCustomerId: string,
  excludedChangeId: string,
): Promise<void> {
  for (const group of groups) {
    if (group.changeId === excludedChangeId) continue;

    await localDraftDb.inboundMeasurements.update(group.changeId, {
      status,
      ...(status === "CREATED_CUSTOMER"
        ? { createdCustomerId: targetCustomerId }
        : { linkedCustomerId: targetCustomerId }),
    });
  }
}

function firstTransferredName(
  values: unknown[],
  fallback: string,
): string {
  for (const value of values) {
    if (typeof value !== "string") continue;

    const cleaned = value.trim();

    if (
      cleaned &&
      cleaned !== "undefined" &&
      cleaned !== "null"
    ) {
      return cleaned;
    }
  }

  return fallback;
}

function roomNameFromMeasurement(
  measurement: MeasurementPayload,
): string {
  return firstTransferredName(
    [
      measurement.roomName,
      measurement.roomLabel,

      measurement.rawValues?.roomName,
      measurement.rawValues?.roomLabel,

      measurement.details?.roomName,
      measurement.details?.roomLabel,

      measurement.data?.roomName,
      measurement.data?.roomLabel,

      measurement.patch?.roomName,
      measurement.patch?.data?.roomName,

      measurement.room?.name,
    ],
    "İsimsiz Oda",
  ).toLocaleUpperCase("tr-TR");
}

function openingNameFromMeasurement(
  measurement: MeasurementPayload,
  index: number,
): string {
  return firstTransferredName(
    [
      measurement.openingName,
      measurement.windowName,
      measurement.openingLabel,

      measurement.rawValues?.openingName,
      measurement.rawValues?.windowName,
      measurement.rawValues?.openingLabel,

      measurement.details?.openingName,
      measurement.details?.windowName,
      measurement.details?.openingLabel,

      measurement.data?.openingName,
      measurement.data?.windowName,

      measurement.patch?.openingName,
      measurement.patch?.windowName,
      measurement.patch?.data?.openingName,
      measurement.patch?.data?.windowName,

      measurement.opening?.name,
      measurement.window?.name,
    ],
    `Açıklık ${index + 1}`,
  );
}

function buildStructuralRoomsFromMeasurements(
  measurements: LocalMeasurement[],
): Room[] {
  const roomsById = new Map<string, StructuralRoom>();

  measurements.forEach((measurement) => {
    const roomId = measurement.roomId;
    const openingId = measurement.openingId || measurement.windowId;
    if (!roomId || !openingId) return;

    let room = roomsById.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: roomNameFromMeasurement(measurement),
        photos: [],
        videos: [],
        windows: [],
      } as StructuralRoom;
      roomsById.set(roomId, room);
    }

    if (!room.windows.some((opening) => opening.id === openingId)) {
      room.windows.push({
        id: openingId,
        name: openingNameFromMeasurement(measurement, room.windows.length),
        photos: [],
        videos: [],
        products: [],
      });
    }
  });

  return Array.from(roomsById.values());
}

function mergeRoomStructures(baseRooms: Room[], incomingRooms: Room[]): Room[] {
  const roomMap = new Map<string, StructuralRoom>();

  const addRoom = (room: Room) => {
    const current = roomMap.get(room.id);
    if (!current) {
      roomMap.set(room.id, {
        ...room,
        windows: (room.windows || []).map((opening) => ({
          ...opening,
          products: [],
        })),
      } as StructuralRoom);
      return;
    }

    const openingMap = new Map<string, RoomOpening>();
    current.windows.forEach((opening) =>
      openingMap.set(opening.id, opening),
    );
    (room.windows || []).forEach((opening) => {
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
    } as StructuralRoom);
  };

  baseRooms.forEach(addRoom);
  incomingRooms.forEach(addRoom);
  return Array.from(roomMap.values());
}

function extractMeasurementsForCustomer(
  rooms: Room[],
  customerId: string,
): LocalMeasurement[] {
  const measurements: LocalMeasurement[] = [];
  rooms.forEach((room) =>
    (room.windows || []).forEach((opening) =>
      (opening.products || []).forEach((measurement) =>
        measurements.push({
          ...measurement,
          customerId,
          roomId: room.id,
          openingId:
            (measurement as MeasurementPayload).openingId ||
            (measurement as MeasurementPayload).windowId ||
            opening.id,
        } as LocalMeasurement),
      ),
    ),
  );
  return measurements;
}

async function persistAndVerifyMeasurements(
  measurements: LocalMeasurement[],
): Promise<void> {
  if (measurements.length === 0) {
    throw new Error(
      "Bu gelen kayda ait geçerli ölçü bulunamadı. Cari işlemi durduruldu.",
    );
  }

  const now = new Date().toISOString();
  const normalizedMeasurements = measurements.map((measurement) => {
    const openingId = measurement.openingId || measurement.windowId;
    if (!measurement.id || !measurement.customerId || !measurement.roomId || !openingId) {
      throw new Error(
        `Geçersiz ölçü bağlantısı: ${measurement.id || "kimliksiz ölçü"}`,
      );
    }

    return {
      ...measurement,
      openingId,
      windowId: openingId,
      updatedAt: now,
    };
  });

  // Kimlik mutabakatı (geçici cari -> gerçek cari) normal senkron sürüm
  // karşılaştırmasına takılmamalı. Aynı ölçü kimliğiyle doğrudan IndexedDB üzerinde
  // atomik olarak güncellenir; bu işlem yeni/kopya ölçü üretmez.
  await localMeasurementDb.transaction(
    "rw",
    localMeasurementDb.measurements,
    async () => {
      await localMeasurementDb.measurements.bulkPut(normalizedMeasurements);
    },
  );

  // Zustand belleğini IndexedDB'nin kesin son haliyle eşitle.
  await useMeasurementStore.getState().loadMeasurements();

  const persisted = await localMeasurementDb.measurements.bulkGet(
    normalizedMeasurements.map((measurement) => measurement.id),
  );
  const persistedById = new Map(
    persisted
      .filter(
        (measurement): measurement is LocalMeasurement =>
          measurement !== undefined,
      )
      .map((measurement) => [measurement.id, measurement]),
  );

  const invalid = normalizedMeasurements.filter((expected) => {
    const actual = persistedById.get(expected.id);
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
  measurements: LocalMeasurement[],
  customerId: string,
): LocalMeasurement[] {
  return measurements.map((measurement) => {
    const openingId = measurement.openingId || measurement.windowId;

    if (!openingId) {
      throw new Error(
        `Geçersiz ölçü açıklık bağlantısı: ${measurement.id}`,
      );
    }

    return {
      ...measurement,
      customerId,
      openingId,
    };
  });
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

  const patch = (inbound.patch || {}) as InboundPatch;
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
  const standaloneMeasurements =
    extractStandaloneMeasurementsFromPatch(patch);
  const relatedMeasurementGroups =
    await loadRelatedMeasurementGroups(sourceCustomerIds);
  const sourceMeasurements = mergeMeasurementsById(
    await loadMeasurementsForInbound(
      sourceCustomerIds,
      nestedMeasurements,
    ),
    standaloneMeasurements,
    relatedMeasurementGroups.measurements,
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
  await completeRelatedMeasurementGroups(
    relatedMeasurementGroups.groups,
    "CREATED_CUSTOMER",
    structuralCustomer.id,
    inbound.changeId,
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("local-customers-updated"));
    window.dispatchEvent(new Event("local-measurements-updated"));
  }

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

  const patch = (inbound.patch || {}) as InboundPatch;
  const sourceCustomerIds = normalizeSourceCustomerIds(inbound, patch);
  const patchRooms = await extractRoomsFromPatch(patch);
  const nestedMeasurements = extractMeasurementsForCustomer(
    patchRooms,
    sourceCustomerIds[0] || inbound.entityId,
  );
  const standaloneMeasurements =
    extractStandaloneMeasurementsFromPatch(patch);
  const relatedMeasurementGroups =
    await loadRelatedMeasurementGroups(sourceCustomerIds);
  const sourceMeasurements = mergeMeasurementsById(
    await loadMeasurementsForInbound(
      sourceCustomerIds,
      nestedMeasurements,
    ),
    standaloneMeasurements,
    relatedMeasurementGroups.measurements,
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
  await completeRelatedMeasurementGroups(
    relatedMeasurementGroups.groups,
    "LINKED_TO_CUSTOMER",
    structuralUpdatedCustomer.id,
    inbound.changeId,
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("local-customers-updated"));
    window.dispatchEvent(new Event("local-measurements-updated"));
  }

  return structuralUpdatedCustomer;
}
