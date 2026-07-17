import { useMeasurementStore } from "@/store/measurementStore";
import { useStore } from "@/store/useStore";
import { loadLocalCustomers, saveLocalCustomer } from "./localCustomerDb";
import {
  getPendingSyncEvents,
  markSyncEventsSynced,
  markSyncEventsError,
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
import { useAuthStore } from "@/store/useAuthStore";
import { getDeviceId } from "./deviceIdentity";

// btoa() fails on non-Latin1 characters (e.g. Ş, Ğ, İ, Ü, Ö, Ç).
function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }),
  );
}

function getOpeningId(measurement: any): string {
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
  change: any,
  canonical: any,
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
  customer: any,
  measurement: any,
): Promise<any> {
  const roomId = measurement?.roomId;
  const openingId = getOpeningId(measurement);
  if (!roomId || !openingId) return customer;

  const rooms = Array.isArray(customer.rooms) ? [...customer.rooms] : [];
  const roomIndex = rooms.findIndex((room: any) => room.id === roomId);
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

    if (!windows.some((opening: any) => opening.id === openingId)) {
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

  await saveLocalCustomer(updatedCustomer);
  useStore.setState((state) => ({
    customers: state.customers.map((item) =>
      item.id === updatedCustomer.id ? updatedCustomer : item,
    ),
    syncStatus: "pending",
  }));

  return updatedCustomer;
}

export function extractMeasurementFromChange(change: any): any {
  if (!change) return null;
  const patch = change.patch || {};

  // Rule 1: New format has change.patch.data as canonical measurement
  if (patch && patch.data && typeof patch.data === "object" && patch.data.id) {
    const canonical = patch.data;
    if (canonical.id && typeof canonical.id === "string") {
      return canonical;
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
      return patch;
    }
  }

  return null;
}

export function isMeasurementEmpty(m: any): boolean {
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
  existing: any,
  incoming: any,
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

    const { currentUser } = useAuthStore.getState();
    if (!currentUser || !currentUser.username || !currentUser.password) {
      return {
        success: false,
        pushedCount: 0,
        errors: ["Local Auth credentials missing."],
        debug: {
          pendingCount: pendingEvents.length,
          apiStatus: 401,
          syncedCount: 0,
          errorCount: 0,
          firstStatus,
        },
      };
    }

    const token = utf8ToBase64(
      `${currentUser.username}:${currentUser.password}`,
    );

    // Call the server-side API route which uses the Service Role Key

    let rCount = 0,
      pCount = 0;
    let hasRaw = false;
    pendingEvents.forEach((ev) => {
      const p = ev.patch;
      if (p && p.rooms && Array.isArray(p.rooms)) {
        rCount += p.rooms.length;
        p.rooms.forEach((r: any) => {
          const w = r.windows || r.openings || [];
          w.forEach((wi: any) => {
            const prods = wi.products || wi.measurements || [];
            pCount += prods.length;
            prods.forEach((pr: any) => {
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
      body: JSON.stringify({ events: pendingEvents }),
    });

    let data: any = {};
    let errText = "";

    if (!response.ok) {
      errText = await response.text();
      try {
        const json = JSON.parse(errText);
        errText = json.error || json.details || errText;
      } catch (e) {}

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

    const { success, syncedIds, errorIds, errors } = data;

    // Update Local Queue based on the server response
    if (syncedIds && syncedIds.length > 0) {
      await markSyncEventsSynced(syncedIds);
    }

    if (errorIds && errorIds.length > 0) {
      const errMsgs = Array.isArray(errors)
        ? errors.join(", ")
        : errors || "Unknown error";
      await markSyncEventsError(errorIds, errMsgs);
    }

    return {
      success: success && (errorIds || []).length === 0,
      pushedCount: (syncedIds || []).length,
      errors: Array.isArray(errors) ? errors : errors ? [String(errors)] : [],
      debug: {
        pendingCount: pendingEvents.length,
        apiStatus: response.status,
        syncedCount: (syncedIds || []).length,
        errorCount: (errorIds || []).length,
        firstStatus,
      },
    };
  } catch (err: any) {
    console.error("[DeltaSyncClient] Push failed:", err);
    return {
      success: false,
      pushedCount: 0,
      errors: [err.message],
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
  allLocalCustomers: any[],
): Promise<{
  success: boolean;
  fetchedCount: number;
  errors: string[];
}> {
  try {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser || !currentUser.username || !currentUser.password) {
      return {
        success: false,
        fetchedCount: 0,
        errors: ["Local Auth credentials missing."],
      };
    }

    const token = utf8ToBase64(
      `${currentUser.username}:${currentUser.password}`,
    );
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
      let errText = await response.text();
      return {
        success: false,
        fetchedCount: 0,
        errors: [`API Error: ${response.status} - ${errText}`],
      };
    }

    const data = await response.json();
    if (!data.success) {
      return {
        success: false,
        fetchedCount: 0,
        errors: [data.error || "Unknown API Error"],
      };
    }

    const rawChanges = data.changes || [];
    let maxDraftRevision = draftCursor;
    let maxMeasurementRevision = measurementCursor;

    // The UI snapshot can be stale immediately after an inbound approval.
    // Merge the persisted customer database into the working set before matching.
    const persistedCustomers = await loadLocalCustomers();
    for (const persistedCustomer of persistedCustomers) {
      const index = allLocalCustomers.findIndex(
        (customer: any) => customer.id === persistedCustomer.id,
      );
      if (index >= 0) allLocalCustomers[index] = persistedCustomer;
      else allLocalCustomers.push(persistedCustomer);
    }

    // Permanent source->target reconciliation created by the admin's earlier
    // "Mevcut Cariye Bağla" or "Yeni Cari Aç" decision.
    const completedInboundCustomerMap =
      await buildCompletedInboundCustomerMap();

    // Deduplicate changes by entity_id, merging properties for the same entity in order of revision
    rawChanges.sort((a: any, b: any) => a.revision - b.revision);

    const latestChanges = new Map<string, any>();
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
        p.rooms.forEach((r: any) => {
          const w = r.windows || r.openings || [];
          w.forEach((wi: any) => {
            const prods = wi.products || wi.measurements || [];
            pCount += prods.length;
            prods.forEach((pr: any) => {
              if (pr.rawValues) hasRaw = true;
            });
          });
        });
      }
    });
    console.log(
      `[SYNC-DIAGNOSTIC] PC pull sonrası: pulledRawEventCount=${rawChanges.length}, uniqueMergedCount=${changes.length}, mergedRoomsCount=${rCount}, mergedProductsCount=${pCount}, hasRawValues=${hasRaw}`,
    );

    const unmatchedMeasurementGroups = new Map<
      string,
      {
        latestChange: any;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
      }
    >();

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
          } else {
            const sourceCustomerId = String(
              canonical.customerId || "",
            ).trim();
            const resolvedCustomerId =
              completedInboundCustomerMap.get(sourceCustomerId) ||
              sourceCustomerId;

            const localCustomer = allLocalCustomers.find(
              (customer: any) =>
                !customer.isDeleted && customer.id === resolvedCustomerId,
            );

            const openingId = getOpeningId(canonical);
            let measurementToPersist = {
              ...canonical,
              customerId: resolvedCustomerId,
              openingId,
              windowId: openingId,
            };

            if (localCustomer) {
              const updatedCustomer =
                await ensureCustomerStructureForMeasurement(
                  localCustomer,
                  measurementToPersist,
                );
              const customerIndex = allLocalCustomers.findIndex(
                (customer: any) => customer.id === updatedCustomer.id,
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
              unmatchedMeasurementGroups.set(sourceCustomerId, {
                latestChange: change,
                ...meta,
              });
            }

            await useMeasurementStore
              .getState()
              .batchUpsertMeasurements([measurementToPersist]);

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
          }
        } catch (err: any) {
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

        let customerName = patch.customerName || patch.name;
        let customerPhone = patch.customerPhone || patch.phone;
        let customerAddress = patch.customerAddress || patch.address;

        const suggested = suggestCustomers(
          { customerName, customerPhone },
          allLocalCustomers,
        );

        const inbound: InboundMeasurement = {
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
          await saveInboundMeasurement(inbound);
        }
      }
    }

    for (const [sourceCustomerId, group] of unmatchedMeasurementGroups) {
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
        },
        senderId: change.user_id,
        createdAt: new Date().toISOString(),
        status: "NEW",
        suggestedCustomerIds: suggested.map((item) => item.id),
      };

      if (change.device_id !== getDeviceId()) {
        await saveInboundMeasurement(inbound);
      }
    }

    if (maxDraftRevision > draftCursor) {
      await setSyncCursor("draft_changes_cursor", maxDraftRevision);
    }
    if (maxMeasurementRevision > measurementCursor) {
      await setSyncCursor("measurement_changes_cursor", maxMeasurementRevision);
    }

    return { success: true, fetchedCount: changes.length, errors: [] };
  } catch (err: any) {
    console.error("[DeltaSyncClient] Pull failed:", err);
    return { success: false, fetchedCount: 0, errors: [err.message] };
  }
}

// Basic fuzzy matching
export function suggestCustomers(patch: any, localCustomers: any[]): any[] {
  const suggestions: any[] = [];
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