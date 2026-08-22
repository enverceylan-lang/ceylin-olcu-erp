import { loadVerifiedClientErpScope } from './clientErpScope';
import { erpScopeMatches, validateErpScope, type ErpScope } from './erpScope';
import { useMeasurementStore } from "@/store/measurementStore";
import { getLocalMeasurementById } from "./localMeasurementDb";
import { useStore } from "@/store/useStore";
import { loadLocalCustomers, saveLocalCustomerWithoutSync } from "./localCustomerDb";
import {
  getPendingSyncEvents,
  markSyncEventsSynced,
  markSyncEventsError,
  type SyncPatchRoom,
  type SyncPatchOpening,
  type SyncPatchProduct,
} from "./localSyncQueueDb";
import {
  getSyncCursor,
  setSyncCursor,
  saveInboundMeasurement,
  saveTransferReceipt,
  localDraftDb,
  type InboundMeasurement,
  type TransferReceipt,
} from "./localDraftDb";
import { validateMeasurementRecord } from "@/lib/measurementValidationEngine";
import { useAuthStore } from "@/store/useAuthStore";
import { getDeviceId } from "./deviceIdentity";

type LocalCustomer = Awaited<
  ReturnType<typeof loadLocalCustomers>
>[number];

type LocalMeasurement = ReturnType<
  typeof useMeasurementStore.getState
>["measurements"][number];

interface InboundCustomerReference {
  name?: string;
  phone?: string;
  address?: string;
}

interface MeasurementPayload extends Partial<LocalMeasurement> {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customer?: InboundCustomerReference;
  entity?: string;
  timestamp?: string;
}

type CanonicalMeasurement = LocalMeasurement & {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customer?: InboundCustomerReference;
};

interface DeltaChangePatch extends MeasurementPayload {
  data?: MeasurementPayload;
  rooms?: SyncPatchRoom[];
  name?: string;
  phone?: string;
  address?: string;
  syncStatus?: string;
}

interface MeasurementChangeEnvelope {
  change_id?: string;
  patch?: DeltaChangePatch;
}

interface DeltaChange {
  change_id: string;
  revision: number;
  entity_type: InboundMeasurement["entityType"];
  entity_id: string;
  operation: InboundMeasurement["operation"];
  sourceTable: InboundMeasurement["sourceTable"];
  user_id?: string;
  device_id?: string;
  tenant_id?: string;
  company_id?: string;
  branch_id?: string;
  accounting_period_id?: string;
  patch?: DeltaChangePatch;
}

interface DeltaPullResponse {
  success?: boolean;
  error?: string;
  changes?: DeltaChange[];
}

interface OpeningReference {
  openingId?: string;
  windowId?: string;
}

interface CustomerSuggestionInput {
  customerName?: string;
  customerPhone?: string;
}

interface CustomerSuggestion {
  id: string;
  score: number;
}

interface DeltaPushResponse {
  success?: boolean;
  syncedIds?: string[];
  errorIds?: string[];
  errors?: string[] | string;
  measurementResults?: Array<{
    changeId?: string;
    entityId?: string;
    entityVersion?: number;
    outcome?: string;
  }>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// btoa() fails on non-Latin1 characters (e.g. Å, Ä, Ä°, Ãœ, Ã–, Ã‡).
function getOpeningId(measurement: OpeningReference): string {
  return measurement?.openingId || measurement?.windowId || "";
}


async function buildCompletedInboundCustomerMap(): Promise<Map<string, string>> {
  const rows = await localDraftDb.inboundMeasurements.toArray();
  const completed = rows
    .filter((item) =>
      (item.status === "LINKED_TO_CUSTOMER" ||
        item.status === "CREATED_CUSTOMER") &&
      Boolean(item.linkedCustomerId || item.createdCustomerId),
    )
    .sort((a, b) => Number(a.revision || 0) - Number(b.revision || 0));

  const result = new Map<string, string>();
  for (const item of completed) {
    const sourceCustomerId = String(item.entityId || "").trim();
    const targetCustomerId = String(
      item.linkedCustomerId || item.createdCustomerId || "",
    ).trim();
    if (sourceCustomerId && targetCustomerId) {
      result.set(sourceCustomerId, targetCustomerId);
    }
  }
  return result;
}

function getInboundCustomerMeta(
  change: DeltaChange,
  canonical: CanonicalMeasurement,
): {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
} {
  const patch = change?.patch || {};
  const data = patch?.data || {};
  return {
    customerName:
      canonical?.customerName ||
      canonical?.customer?.name ||
      data?.customerName ||
      data?.customer?.name ||
      patch?.customerName ||
      patch?.customer?.name,
    customerPhone:
      canonical?.customerPhone ||
      canonical?.customer?.phone ||
      data?.customerPhone ||
      data?.customer?.phone ||
      patch?.customerPhone ||
      patch?.customer?.phone,
    customerAddress:
      canonical?.customerAddress ||
      canonical?.customer?.address ||
      data?.customerAddress ||
      data?.customer?.address ||
      patch?.customerAddress ||
      patch?.customer?.address,
  };
}

async function ensureCustomerStructureForMeasurement(
  customer: LocalCustomer,
  measurement: LocalMeasurement,
): Promise<LocalCustomer> {
  const roomId = measurement?.roomId;
  const openingId = getOpeningId(measurement);
  if (!roomId || !openingId) return customer;

  type LocalRoom = LocalCustomer["rooms"][number];
  type CompatibleRoom = LocalRoom & {
    openings?: LocalRoom["windows"];
  };

  const rooms: CompatibleRoom[] = Array.isArray(customer.rooms)
    ? [...customer.rooms]
    : [];
  const roomIndex = rooms.findIndex((room) => room.id === roomId);
  const incomingRoomName =
    measurement.roomName || measurement.roomLabel || "Gelen Oda";
  const incomingOpeningName =
    measurement.openingName ||
    measurement.windowName ||
    measurement.openingLabel ||
    "Gelen Açıklık";

  if (roomIndex === -1) {
    rooms.push({
      id: roomId,
      name: incomingRoomName,
      photos: [],
      videos: [],
      windows: [
        {
          id: openingId,
          name: incomingOpeningName,
          photos: [],
          videos: [],
          products: [],
        },
      ],
    });
  } else {
    const room = rooms[roomIndex];
    const windows = Array.isArray(room.windows)
      ? [...room.windows]
      : Array.isArray(room.openings)
        ? [...room.openings]
        : [];

    if (!windows.some((opening) => opening.id === openingId)) {
      windows.push({
        id: openingId,
        name: incomingOpeningName,
        photos: [],
        videos: [],
        products: [],
      });
    }

    rooms[roomIndex] = {
      ...room,
      windows,
    };
  }

  const updatedCustomer = {
    ...customer,
    rooms,
    updatedAt: new Date().toISOString(),
  };

  await saveLocalCustomerWithoutSync(updatedCustomer);
  useStore.setState((state) => ({
    customers: state.customers.map((item) =>
      item.id === updatedCustomer.id ? updatedCustomer : item,
    ),
  }));

  return updatedCustomer;
}

export function extractMeasurementFromChange(
  change: { patch: { data: MeasurementPayload } },
): CanonicalMeasurement;
export function extractMeasurementFromChange(
  change: MeasurementChangeEnvelope,
): CanonicalMeasurement | null;
export function extractMeasurementFromChange(
  change: MeasurementChangeEnvelope,
): CanonicalMeasurement | null {
  if (!change) return null;
  const patch = change.patch || {};

  // Rule 1: New format has change.patch.data as canonical measurement
  if (patch && patch.data && typeof patch.data === "object" && patch.data.id) {
    const canonical = patch.data;
    if (canonical.id && typeof canonical.id === "string") {
      return canonical as CanonicalMeasurement;
    }
  }

  // Rule 2: Legacy format has change.patch directly as canonical measurement
  if (patch && patch.id && typeof patch.id === "string") {
    if (
      patch.customerId ||
      patch.windowId ||
      patch.roomId ||
      patch.templateType ||
      patch.rawValues
    ) {
      return patch as CanonicalMeasurement;
    }
  }

  return null;
}

export function isMeasurementEmpty(
  m: Partial<LocalMeasurement> | null | undefined,
): boolean {
  if (!m) return true;
  if (!m.id || !m.customerId || !m.roomId || !(m.openingId || m.windowId)) return true;
  if (!m.templateType) return true;
  if (
    !m.rawValues ||
    typeof m.rawValues !== "object" ||
    Object.keys(m.rawValues).length === 0
  ) {
    return true;
  }
  return false;
}

export function shouldOverwriteMeasurement(
  existing: Partial<LocalMeasurement> | null | undefined,
  incoming: Partial<LocalMeasurement> | null | undefined,
): { shouldOverwrite: boolean; error?: string } {
  if (!existing) return { shouldOverwrite: true };
  if (!incoming)
    return { shouldOverwrite: false, error: "Incoming measurement is null" };

  const existingEmpty = isMeasurementEmpty(existing);
  const incomingEmpty = isMeasurementEmpty(incoming);

  // Rule A & B: empty cannot overwrite full, but full can repair empty
  if (!existingEmpty && incomingEmpty) {
    return {
      shouldOverwrite: false,
      error:
        "Cannot overwrite full local measurement with empty inbound payload",
    };
  }

  // Rule C: version and updatedAt checks
  const existingVersion = Number(existing.version || 0);
  const incomingVersion = Number(incoming.version || 0);

  if (incomingVersion < existingVersion) {
    return {
      shouldOverwrite: false,
      error: "Older version cannot overwrite newer local measurement",
    };
  }

  if (incomingVersion === existingVersion) {
    const existingTime = new Date(
      existing.updatedAt || existing.createdAt || 0,
    ).getTime();
    const incomingTime = new Date(
      incoming.updatedAt || incoming.createdAt || 0,
    ).getTime();
    if (incomingTime < existingTime) {
      return {
        shouldOverwrite: false,
        error: "Older timestamp cannot overwrite newer local measurement",
      };
    }
  }

  return { shouldOverwrite: true };
}

export async function pushDeltaSyncEvents(): Promise<{
  success: boolean;
  pushedCount: number;
  errors: string[];
  debug: {
    pendingCount: number;
    apiStatus: number | string;
    syncedCount: number;
    errorCount: number;
    firstStatus: string;
  };
}> {
  try {
    const pendingEvents = await getPendingSyncEvents(50);

    if (pendingEvents.length === 0) {
      return {
        success: true,
        pushedCount: 0,
        errors: [],
        debug: {
          pendingCount: 0,
          apiStatus: "N/A",
          syncedCount: 0,
          errorCount: 0,
          firstStatus: "NONE",
        },
      };
    }

    const firstStatus = pendingEvents[0].syncStatus;

    const { currentUser, sessionToken } = useAuthStore.getState();
    if (!currentUser || !sessionToken) {
      return {
        success: false,
        pushedCount: 0,
        errors: ["Oturum anahtarÄ± bulunamadı. Ã‡Ä±kÄ±ÅŸ yapÄ±p yeniden giriÅŸ yapÄ±n."],
        debug: {
          pendingCount: pendingEvents.length,
          apiStatus: 401,
          syncedCount: 0,
          errorCount: 0,
          firstStatus,
        },
      };
    }

    const token = sessionToken;
    const activeScope = await loadVerifiedClientErpScope(sessionToken);
    const activeScopeEvents = pendingEvents.filter((event) =>
      erpScopeMatches(event.scope, activeScope),
    );
    if (activeScopeEvents.length === 0) {
      return {
        success: true,
        pushedCount: 0,
        errors: [],
        debug: { pendingCount: pendingEvents.length, apiStatus: 'SCOPE_FILTERED', syncedCount: 0, errorCount: 0, firstStatus },
      };
    }

    // Call the server-side API route which uses the Service Role Key

    let rCount = 0,
      pCount = 0;
    let hasRaw = false;
    pendingEvents.forEach((ev) => {
      const p = ev.patch;
      if (p && p.rooms && Array.isArray(p.rooms)) {
        rCount += p.rooms.length;
        p.rooms.forEach((r: SyncPatchRoom) => {
          const w = r.windows || r.openings || [];
          w.forEach((wi: SyncPatchOpening) => {
            const prods = wi.products || wi.measurements || [];
            pCount += prods.length;
            prods.forEach((pr: SyncPatchProduct) => {
              if (pr.rawValues) hasRaw = true;
            });
          });
        });
      }
    });
    console.log(
      `[SYNC-DIAGNOSTIC] Push API: eventCount=${pendingEvents.length}, roomsCount=${rCount}, productsCount=${pCount}, hasRawValues=${hasRaw}`,
    );
    const response = await fetch("/api/delta-sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: activeScopeEvents }),
    });

    let data: DeltaPushResponse = {};
    let errText = "";

    if (!response.ok) {
      errText = await response.text();
      try {
        const json = JSON.parse(errText);
        errText = json.error || json.details || errText;
      } catch {}

      return {
        success: false,
        pushedCount: 0,
        errors: [`API returned ${response.status}: ${errText}`],
        debug: {
          pendingCount: pendingEvents.length,
          apiStatus: response.status,
          syncedCount: 0,
          errorCount: 0,
          firstStatus,
        },
      };
    }

    data = await response.json();

    const {
      success,
      syncedIds,
      errorIds,
      errors,
      measurementResults,
    } = data;

    const resultByChangeId = new Map(
      (measurementResults || []).map((result) => [
        String(result.changeId || ""),
        result,
      ]),
    );

    const pendingByChangeId = new Map(
      activeScopeEvents.map((event) => [event.changeId, event]),
    );

    const safeSyncedIds: string[] = [];
    const clientRejectedIds: string[] = [];

    for (const changeId of syncedIds || []) {
      const pendingEvent = pendingByChangeId.get(changeId);

      if (pendingEvent?.entityType !== "MEASUREMENT") {
        safeSyncedIds.push(changeId);
        continue;
      }

      const authorityResult = resultByChangeId.get(changeId);
      const entityId = String(authorityResult?.entityId || "").trim();
      const entityVersion = Number(authorityResult?.entityVersion);

      if (
        !authorityResult ||
        entityId !== pendingEvent.entityId ||
        !Number.isInteger(entityVersion) ||
        entityVersion < 1
      ) {
        clientRejectedIds.push(changeId);
        continue;
      }

      const localMeasurement =
        useMeasurementStore
          .getState()
          .measurements.find(
            (measurement) => measurement.id === entityId,
          ) ??
        await getLocalMeasurementById(entityId);
      if (!localMeasurement) {
        clientRejectedIds.push(changeId);
        continue;
      }

      await useMeasurementStore
        .getState()
        .batchUpsertMeasurements([
          {
            ...localMeasurement,
            version: entityVersion,
          },
        ]);

      safeSyncedIds.push(changeId);
    }

    if (safeSyncedIds.length > 0) {
      await markSyncEventsSynced(safeSyncedIds);
    }

    const combinedErrorIds = Array.from(
      new Set([...(errorIds || []), ...clientRejectedIds]),
    );

    if (combinedErrorIds.length > 0) {
      const errMsgs = Array.isArray(errors)
        ? errors.join(", ")
        : errors || "Measurement canonical ACK validation failed";
      await markSyncEventsError(combinedErrorIds, errMsgs);
    }

    return {
      success: Boolean(success) && combinedErrorIds.length === 0,
      pushedCount: safeSyncedIds.length,
      errors: [
        ...(Array.isArray(errors) ? errors : errors ? [String(errors)] : []),
        ...(clientRejectedIds.length > 0
          ? ["Measurement canonical ACK validation failed"]
          : []),
      ],
      debug: {
        pendingCount: pendingEvents.length,
        apiStatus: response.status,
        syncedCount: safeSyncedIds.length,
        errorCount: combinedErrorIds.length,
        firstStatus,
      },
    };
  } catch (err: unknown) {
    console.error("[DeltaSyncClient] Push failed:", err);
    return {
      success: false,
      pushedCount: 0,
      errors: [getErrorMessage(err)],
      debug: {
        pendingCount: -1,
        apiStatus: "EXCEPTION",
        syncedCount: 0,
        errorCount: 0,
        firstStatus: "UNKNOWN",
      },
    };
  }
}

export async function pullInboundMeasurements(
  allLocalCustomers: LocalCustomer[],
): Promise<{
  success: boolean;
  fetchedCount: number;
  appliedMeasurements?: number;
  newInboundItems?: number;
  updatedInboundItems?: number;
  alreadyRecorded?: number;
  ignoredOwnDevice?: number;
  failed?: number;
  errors: string[];
}> {
  try {
    const { currentUser, sessionToken } = useAuthStore.getState();
    if (!currentUser || !sessionToken) {
      return {
        success: false,
        fetchedCount: 0,
        errors: ["Oturum anahtarÄ± bulunamadı. Ã‡Ä±kÄ±ÅŸ yapÄ±p yeniden giriÅŸ yapÄ±n."],
      };
    }

    const token = sessionToken;
    const activeScope = await loadVerifiedClientErpScope(sessionToken);
    const draftCursor = await getSyncCursor("draft_changes_cursor");
    const measurementCursor = await getSyncCursor("measurement_changes_cursor");

    const response = await fetch("/api/delta-sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ draftCursor, measurementCursor }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        fetchedCount: 0,
        errors: [`API Error: ${response.status} - ${errText}`],
      };
    }

    const data = (await response.json()) as DeltaPullResponse;
    if (!data.success) {
      return {
        success: false,
        fetchedCount: 0,
        errors: [data.error || "Unknown API Error"],
      };
    }

    const rawChanges: DeltaChange[] = data.changes || [];
    for (const change of rawChanges) {
      const changeScope: ErpScope = {
        tenantId: change.tenant_id ?? "",
        companyId: change.company_id ?? "",
        branchId: change.branch_id ?? "",
        accountingPeriodId: change.accounting_period_id ?? "",
      };
      const changeScopeValidation = validateErpScope(changeScope);
      if (!changeScopeValidation.valid) {
        throw new Error(
          `DELTA_PULL_SCOPE_INVALID::`,
        );
      }
      if (!erpScopeMatches(changeScope, activeScope)) {
        throw new Error(`DELTA_PULL_SCOPE_MISMATCH:`);
      }
    }
    let maxDraftRevision = draftCursor;
    let maxMeasurementRevision = measurementCursor;

    // The UI snapshot can be stale immediately after an inbound approval.
    // Merge the persisted customer database into the working set before matching.
    const persistedCustomers = await loadLocalCustomers();
    for (const persistedCustomer of persistedCustomers) {
      const index = allLocalCustomers.findIndex(
        (customer) => customer.id === persistedCustomer.id,
      );
      if (index >= 0) allLocalCustomers[index] = persistedCustomer;
      else allLocalCustomers.push(persistedCustomer);
    }

    // Permanent source->target reconciliation created by the admin's earlier
    // "Mevcut Cariye BaÄŸla" or "Yeni Cari AÃ§" decision.
    const completedInboundCustomerMap =
      await buildCompletedInboundCustomerMap();

    // Deduplicate changes by entity_id, merging properties for the same entity in order of revision
    rawChanges.sort((a, b) => a.revision - b.revision);

    const latestChanges = new Map<string, DeltaChange>();
    for (const change of rawChanges) {
      const key = `${change.entity_type}_${change.entity_id}`;
      const existing = latestChanges.get(key);

      if (!existing) {
        latestChanges.set(key, change);
      } else {
        // Merge the patches
        const mergedPatch = { ...existing.patch, ...change.patch };

        // Ensure critical arrays are not overwritten by undefined, missing fields, or empty arrays in subsequent patches
        // An empty array in a later patch shouldn't wipe out existing rooms unless explicitly instructed via a deletion operation (which we don't have for rooms yet).
        if (
          existing.patch &&
          existing.patch.rooms &&
          existing.patch.rooms.length > 0
        ) {
          if (
            !change.patch ||
            !change.patch.rooms ||
            change.patch.rooms.length === 0
          ) {
            mergedPatch.rooms = existing.patch.rooms;
          }
        }

        latestChanges.set(key, {
          ...change,
          patch: mergedPatch,
        });
      }

      // Advance cursors based on raw changes to not miss any revisions
      if (
        change.sourceTable === "draft_changes" &&
        change.revision > maxDraftRevision
      ) {
        maxDraftRevision = change.revision;
      }
      if (
        change.sourceTable === "measurement_changes" &&
        change.revision > maxMeasurementRevision
      ) {
        maxMeasurementRevision = change.revision;
      }
    }

    const changes = Array.from(latestChanges.values());

    let rCount = 0,
      pCount = 0;
    let hasRaw = false;
    changes.forEach((change) => {
      const p = change.patch || {};
      if (p.rooms && Array.isArray(p.rooms)) {
        rCount += p.rooms.length;
        p.rooms.forEach((r: SyncPatchRoom) => {
          const w = r.windows || r.openings || [];
          w.forEach((wi: SyncPatchOpening) => {
            const prods = wi.products || wi.measurements || [];
            pCount += prods.length;
            prods.forEach((pr: SyncPatchProduct) => {
              if (pr.rawValues) hasRaw = true;
            });
          });
        });
      }
    });
    console.log(
      `[SYNC-DIAGNOSTIC] PC pull sonrasÄ±: pulledRawEventCount=${rawChanges.length}, uniqueMergedCount=${changes.length}, mergedRoomsCount=${rCount}, mergedProductsCount=${pCount}, hasRawValues=${hasRaw}`,
    );

    const unmatchedMeasurementGroups = new Map<
      string,
      {
        latestChange: (typeof changes)[number];
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        measurements: CanonicalMeasurement[];
      }
    >();

    let appliedMeasurements = 0;
    let newInboundItems = 0;
    let updatedInboundItems = 0;
    let alreadyRecorded = 0;
    let ignoredOwnDevice = 0;
    let failed = 0;
    let measurementCursorAdvanceBlocked = false;

    for (const change of changes) {
      const patch = change.patch || {};

      // Allow DRAFT, CUSTOMER, ROOM, OPENING, MEASUREMENT events
      const isDraftEvent =
        change.entity_type === "DRAFT" &&
        (change.operation === "INSERT" || change.operation === "UPDATE");
      const isMeasurementEvent =
        ["CUSTOMER", "ROOM", "OPENING"].includes(change.entity_type) &&
        (change.operation === "INSERT" || change.operation === "UPDATE");

      if (
        change.entity_type === "MEASUREMENT" &&
        (change.operation === "INSERT" || change.operation === "UPDATE")
      ) {
        const now = new Date().toISOString();
        const receiverDeviceId = getDeviceId();
        const receiverUserId = currentUser.id;
        const senderUserId = change.user_id || "unknown";
        const senderDeviceId = change.device_id || "unknown";

        try {
          const canonical = extractMeasurementFromChange(change);
          if (!canonical) {
            throw new Error(
              `Invalid or empty wrapper payload for measurement change ${change.change_id}`,
            );
          }

          const existing = useMeasurementStore
            .getState()
            .measurements.find(
              (measurement) => measurement.id === canonical.id,
            );

          const check = shouldOverwriteMeasurement(existing, canonical);

          if (!check.shouldOverwrite) {
            console.warn(
              `[DeltaSyncClient] Skipping measurement change ${change.change_id}: ${check.error}`,
            );
            alreadyRecorded += 1;
          } else {
            const sourceCustomerId = String(
              canonical.customerId || "",
            ).trim();
            const resolvedCustomerId =
              completedInboundCustomerMap.get(sourceCustomerId) ||
              sourceCustomerId;

            const localCustomer = allLocalCustomers.find(
              (customer) =>
                !customer.isDeleted && customer.id === resolvedCustomerId,
            );

            const openingId = getOpeningId(canonical);
            const measurementToPersist = {
              ...canonical,
              ...activeScope,
              customerId: resolvedCustomerId,
              openingId,
              windowId: openingId,
            };

            if (localCustomer) {
              const validationIssues = validateMeasurementRecord(
                measurementToPersist,
                {
                  roomId: measurementToPersist.roomId,
                  roomName:
                    measurementToPersist.roomName ||
                    measurementToPersist.roomLabel,
                  openingId,
                  openingName:
                    measurementToPersist.openingName ||
                    measurementToPersist.windowName ||
                    measurementToPersist.openingLabel,
                },
              );

              if (validationIssues.length > 0) {
                const quarantine: InboundMeasurement = {
                  ...activeScope,
                  changeId: `quarantine-${change.change_id}`,
                  revision: change.revision,
                  entityType: "MEASUREMENT_QUARANTINE",
                  entityId: canonical.id,
                  operation: change.operation,
                  sourceTable: change.sourceTable,
                  customerName: localCustomer.name,
                  customerPhone: localCustomer.phone,
                  customerAddress: localCustomer.address,
                  patch: {
                    customerId: resolvedCustomerId,
                    temporaryCustomerId: sourceCustomerId,
                    sourceMeasurementChangeId: change.change_id,
                    measurements: [measurementToPersist],
                  },
                  senderId: change.user_id,
                  createdAt: now,
                  status: "QUARANTINE",
                  validationIssues,
                  quarantineAt: now,
                  measurementId: canonical.id,
                  measuredBy: measurementToPersist.measuredBy,
                  measuredById: measurementToPersist.measuredById,
                  roomName:
                    measurementToPersist.roomName ||
                    measurementToPersist.roomLabel,
                  openingName:
                    measurementToPersist.openingName ||
                    measurementToPersist.windowName ||
                    measurementToPersist.openingLabel,
                  sourceDeviceId: senderDeviceId,
                };

                const outcome = await saveInboundMeasurement(quarantine);

                if (outcome === "INSERTED") {
                  newInboundItems += 1;
                }
                if (outcome === "UPDATED_OPEN_ITEM") {
                  updatedInboundItems += 1;
                }
                if (
                  outcome !== "INSERTED" &&
                  outcome !== "UPDATED_OPEN_ITEM"
                ) {
                  alreadyRecorded += 1;
                }

                const quarantineReceipt: TransferReceipt = {
                  transferId: change.change_id,
                  entityType: "MEASUREMENT",
                  entityId: canonical.id,
                  senderUserId,
                  receiverUserId,
                  senderDeviceId,
                  receiverDeviceId,
                  status: "FAILED",
                  failedAt: now,
                  failureReason: "VALIDATION_QUARANTINED",
                  entityVersion: Number(canonical.version || 1),
                  createdAt: now,
                  updatedAt: now,
                };

                await saveTransferReceipt(quarantineReceipt);

                console.warn(
                  `[DeltaSyncClient] Measurement ${canonical.id} quarantined by CENTRAL_INBOUND validation.`,
                  validationIssues,
                );

                continue;
              }

              const updatedCustomer =
                await ensureCustomerStructureForMeasurement(
                  localCustomer,
                  measurementToPersist,
                );
              const customerIndex = allLocalCustomers.findIndex(
                (customer) => customer.id === updatedCustomer.id,
              );
              if (customerIndex >= 0) {
                allLocalCustomers[customerIndex] = updatedCustomer;
              }

              if (resolvedCustomerId !== sourceCustomerId) {
                console.log(
                  `[DeltaSyncClient] Reconciled inbound measurement ${canonical.id}: ${sourceCustomerId} -> ${resolvedCustomerId}`,
                );
              }
            } else if (sourceCustomerId) {
              const meta = getInboundCustomerMeta(change, canonical);
              const existingGroup =
                unmatchedMeasurementGroups.get(sourceCustomerId);
              const measurementsById = new Map(
                (existingGroup?.measurements || []).map((measurement) => [
                  measurement.id,
                  measurement,
                ]),
              );
              measurementsById.set(canonical.id, canonical);

              unmatchedMeasurementGroups.set(sourceCustomerId, {
                latestChange: change,
                customerName:
                  existingGroup?.customerName || meta.customerName,
                customerPhone:
                  existingGroup?.customerPhone || meta.customerPhone,
                customerAddress:
                  existingGroup?.customerAddress || meta.customerAddress,
                measurements: Array.from(measurementsById.values()),
              });
            }

            if (localCustomer) {
              await useMeasurementStore
                .getState()
                .batchUpsertMeasurements([measurementToPersist]);
              appliedMeasurements += 1;

              const receipt: TransferReceipt = {
                transferId: change.change_id,
                entityType: "MEASUREMENT",
                entityId: canonical.id,
                senderUserId,
                receiverUserId,
                senderDeviceId,
                receiverDeviceId,
                status: "DELIVERED",
                deliveredAt: now,
                entityVersion: Number(canonical.version || 1),
                createdAt: now,
                updatedAt: now,
              };

              await saveTransferReceipt(receipt);

              console.log(
                `[DeltaSyncClient] Successfully applied/upserted MEASUREMENT ${canonical.id}`,
              );
            } else {
              console.warn(
                `[DeltaSyncClient] Measurement ${canonical.id} kept in inbound matching because customer is unresolved.`,
              );
            }
          }
        } catch (err: unknown) {
          const failedReceipt: TransferReceipt = {
            transferId: change.change_id,
            entityType: "MEASUREMENT",
            entityId: change.entity_id || "unknown",
            senderUserId,
            receiverUserId,
            senderDeviceId,
            receiverDeviceId,
            status: "FAILED",
            failedAt: now,
            failureReason: "LOCAL_WRITE_FAILED",
            entityVersion: Number(
              change.patch?.data?.version || change.patch?.version || 1,
            ),
            createdAt: now,
            updatedAt: now,
          };

          await saveTransferReceipt(failedReceipt);
          console.error(
            "[DeltaSyncClient] Failed to apply MEASUREMENT event",
            err,
          );
          failed += 1;
          measurementCursorAdvanceBlocked = true;
        }

        continue;
      }

      if (isDraftEvent || isMeasurementEvent) {
        // Safety check: if this is a DRAFT event and it lacks rooms/measurements and also lacks a customerName,
        // and is essentially just a status-only patch, do not process it into the inbound pool.
        if (isDraftEvent) {
          const hasRooms =
            patch.rooms && Array.isArray(patch.rooms) && patch.rooms.length > 0;
          const isStatusOnly =
            Object.keys(patch).length <= 3 && patch.syncStatus;

          if (!hasRooms && isStatusOnly) {
            console.warn(
              `[DeltaSyncClient] Skipping status-only DRAFT patch lacking measurements: ${change.change_id}`,
            );
            continue;
          }
        }

        const customerName = patch.customerName || patch.name;
        const customerPhone = patch.customerPhone || patch.phone;
        const customerAddress = patch.customerAddress || patch.address;

        const suggested = suggestCustomers(
          { customerName, customerPhone },
          allLocalCustomers,
        );

        const inbound: InboundMeasurement = {
          ...activeScope,
          changeId: change.change_id,
          revision: change.revision,
          entityType: change.entity_type,
          entityId: change.entity_id,
          operation: change.operation,
          sourceTable: change.sourceTable,
          customerName: customerName,
          customerPhone: customerPhone,
          customerAddress: customerAddress,
          patch: patch,
          senderId: change.user_id,
          createdAt: new Date().toISOString(),
          status: "NEW",
          suggestedCustomerIds: suggested.map((s) => s.id),
        };

        // Don't import changes produced by this same device back into the pool.
        if (change.device_id !== getDeviceId()) {
          const outcome = await saveInboundMeasurement(inbound);

          if (outcome === "INSERTED") newInboundItems += 1;
          else if (outcome === "UPDATED_OPEN_ITEM") updatedInboundItems += 1;
          else alreadyRecorded += 1;
        }
        else {
          ignoredOwnDevice += 1;
        }
      }
    }

    for (const [sourceCustomerId, group] of unmatchedMeasurementGroups) {
      if (!Array.isArray(group.measurements) || group.measurements.length === 0) {
        console.warn(
          `[DeltaSyncClient] Empty measurement group was not added to inbound pool: ${sourceCustomerId}`,
        );
        alreadyRecorded += 1;
        continue;
      }

      const change = group.latestChange;
      const suggested = suggestCustomers(
        {
          customerName: group.customerName,
          customerPhone: group.customerPhone,
        },
        allLocalCustomers,
      );

      const inbound: InboundMeasurement = {
        changeId: `measurement-group-${change.change_id}`,
        revision: change.revision,
        entityType: "MEASUREMENT_GROUP",
        entityId: sourceCustomerId,
        operation: "UPDATE",
        sourceTable: change.sourceTable,
        customerName: group.customerName,
        customerPhone: group.customerPhone,
        customerAddress: group.customerAddress,
        patch: {
          customerId: sourceCustomerId,
          temporaryCustomerId: sourceCustomerId,
          sourceMeasurementChangeId: change.change_id,
          measurements: group.measurements,
        },
        senderId: change.user_id,
        createdAt: new Date().toISOString(),
        status: "NEW",
        suggestedCustomerIds: suggested.map((item) => item.id),
      };

      if (change.device_id !== getDeviceId()) {
        const outcome = await saveInboundMeasurement(inbound);

        if (outcome === "INSERTED") newInboundItems += 1;
        else if (outcome === "UPDATED_OPEN_ITEM") updatedInboundItems += 1;
        else alreadyRecorded += 1;
      }
      else {
        ignoredOwnDevice += 1;
      }
    }

    if (maxDraftRevision > draftCursor) {
      await setSyncCursor("draft_changes_cursor", maxDraftRevision);
    }
    if (!measurementCursorAdvanceBlocked && maxMeasurementRevision > measurementCursor) {
      await setSyncCursor("measurement_changes_cursor", maxMeasurementRevision);
    }

    const fetchedCount = appliedMeasurements + newInboundItems;

    return {
      success: true,
      fetchedCount,
      appliedMeasurements,
      newInboundItems,
      updatedInboundItems,
      alreadyRecorded,
      ignoredOwnDevice,
      failed,
      errors: [],
    };
  } catch (err: unknown) {
    console.error("[DeltaSyncClient] Pull failed:", err);
    return { success: false, fetchedCount: 0, errors: [getErrorMessage(err)] };
  }
}

// Basic fuzzy matching
export function suggestCustomers(
  patch: CustomerSuggestionInput,
  localCustomers: LocalCustomer[],
): CustomerSuggestion[] {
  const suggestions: CustomerSuggestion[] = [];
  if (!patch.customerName && !patch.customerPhone) return suggestions;

  const phone = (patch.customerPhone || "").replace(/\D/g, "");
  const name = (patch.customerName || "").toLowerCase().trim();

  for (const c of localCustomers) {
    if (c.isDeleted) continue;

    const cPhone = (c.phone || "").replace(/\D/g, "");
    const cName = (c.name || "").toLowerCase().trim();

    let score = 0;

    if (phone && cPhone && cPhone === phone) {
      score += 100; // Exact phone match is very strong
    }

    if (name && cName) {
      if (cName === name) score += 50;
      else if (cName.includes(name) || name.includes(cName)) score += 20;
    }

    if (score > 0) {
      suggestions.push({ id: c.id, score });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
}
