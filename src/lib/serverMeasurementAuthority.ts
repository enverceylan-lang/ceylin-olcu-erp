import type { SupabaseClient } from "@supabase/supabase-js";
import type { ErpScope } from "@/lib/erpScope";

export type MeasurementAuthorityOperation =
  | "INSERT"
  | "UPDATE"
  | "SOFT_DELETE";

export interface MeasurementAuthorityResult {
  changeId: string;
  entityId: string;
  entityVersion: number;
  outcome: "CREATED" | "UPDATED" | "SOFT_DELETED" | "REPLAY";
}

export interface MeasurementAuthorityChange {
  change_id: unknown;
  entity_id: unknown;
  operation: unknown;
  patch: unknown;
  device_id?: unknown;
  expected_version?: unknown;
}

interface MeasurementParentPackage {
  room: {
    id: string;
    name: string;
    customerAddressId: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  opening: {
    id: string;
    name: string;
    width: number | null;
    height: number | null;
    fieldNotes: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string | null {
  const text = cleanId(value);
  return text || null;
}

function optionalFiniteNumber(value: unknown, errorCode: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(errorCode);
  return parsed;
}

function sanitizeCanonicalPayload(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set([
    "id",
    "customerId",
    "roomId",
    "openingId",
    "windowId",
    "templateType",
    "rawValues",
    "productId",
    "productGroup",
    "productType",
    "calculatedWidth",
    "calculatedHeight",
    "details",
    "notes",
    "status",
    "createdById",
    "measuredBy",
    "measuredById",
    "measuredDate",
    "notesHistory",
    "createdAt",
    "isDeleted",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "photos" || key === "videos" || key === "addressPhotos") {
      continue;
    }
    if (allowed.has(key)) {
      sanitized[key] = nested;
    }
  }
  return sanitized;
}

function normalizeCommandPayload(
  entityId: string,
  rawPatch: unknown,
): Record<string, unknown> {
  const wrapper = asRecord(rawPatch);
  if (!wrapper) {
    throw new Error("MEASUREMENT_PAYLOAD_INVALID");
  }

  const data = asRecord(wrapper.data) ?? wrapper;
  const payload = sanitizeCanonicalPayload(data);

  const openingId = cleanId(payload.openingId);
  const windowId = cleanId(payload.windowId);
  if (openingId && windowId && openingId !== windowId) {
    throw new Error("MEASUREMENT_OPENING_WINDOW_MISMATCH");
  }

  const canonicalOpeningId = openingId || windowId;
  const customerId = cleanId(payload.customerId);
  const roomId = cleanId(payload.roomId);

  if (!customerId || !roomId || !canonicalOpeningId) {
    throw new Error("MEASUREMENT_PARENT_ID_MISSING");
  }

  return {
    ...payload,
    id: entityId,
    customerId,
    roomId,
    openingId: canonicalOpeningId,
    windowId: windowId || canonicalOpeningId,
  };
}

function normalizeParentPackage(rawPatch: unknown, payload: Record<string, unknown>): MeasurementParentPackage | null {
  const wrapper = asRecord(rawPatch);
  const parentPackage = asRecord(wrapper?.parentPackage);
  if (!parentPackage) return null;
  const room = asRecord(parentPackage.room);
  const opening = asRecord(parentPackage.opening);
  if (!room || !opening) throw new Error("MEASUREMENT_PARENT_PACKAGE_INVALID");
  const payloadRoomId = cleanId(payload.roomId);
  const payloadOpeningId = cleanId(payload.openingId) || cleanId(payload.windowId);
  const roomId = cleanId(room.id);
  const openingId = cleanId(opening.id);
  if (!roomId || !openingId || roomId !== payloadRoomId || openingId !== payloadOpeningId) {
    throw new Error("MEASUREMENT_PARENT_PACKAGE_ID_MISMATCH");
  }
  return {
    room: {
      id: roomId,
      name: cleanId(room.name),
      customerAddressId: optionalText(room.customerAddressId),
      createdAt: optionalText(room.createdAt),
      updatedAt: optionalText(room.updatedAt),
    },
    opening: {
      id: openingId,
      name: cleanId(opening.name),
      width: optionalFiniteNumber(opening.width, "MEASUREMENT_OPENING_WIDTH_INVALID"),
      height: optionalFiniteNumber(opening.height, "MEASUREMENT_OPENING_HEIGHT_INVALID"),
      fieldNotes: typeof opening.fieldNotes === "string" ? opening.fieldNotes : "",
      createdAt: optionalText(opening.createdAt),
      updatedAt: optionalText(opening.updatedAt),
    },
  };
}

function parseExpectedVersion(
  operation: MeasurementAuthorityOperation,
  value: unknown,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("MEASUREMENT_EXPECTED_VERSION_MISSING");
  }

  if (operation === "INSERT" && value !== 0) {
    throw new Error("MEASUREMENT_INSERT_EXPECTED_VERSION_MUST_BE_ZERO");
  }
  if (operation !== "INSERT" && value < 1) {
    throw new Error("MEASUREMENT_UPDATE_EXPECTED_VERSION_INVALID");
  }

  return value;
}

function parseResult(value: unknown): MeasurementAuthorityResult {
  const record = asRecord(value);
  const changeId = cleanId(record?.changeId);
  const entityId = cleanId(record?.entityId);
  const entityVersion = Number(record?.entityVersion);
  const outcome = cleanId(record?.outcome).toUpperCase();
  if (
    !changeId ||
    !entityId ||
    !Number.isInteger(entityVersion) ||
    entityVersion < 1 ||
    !["CREATED", "UPDATED", "SOFT_DELETED", "REPLAY"].includes(outcome)
  ) {
    throw new Error("MEASUREMENT_AUTHORITY_RESULT_INVALID");
  }

  return {
    changeId,
    entityId,
    entityVersion,
    outcome: outcome as MeasurementAuthorityResult["outcome"],
  };
}

export async function persistMeasurementAuthorityCommand(args: {
  supabase: SupabaseClient;
  actorUserId: string;
  scope: ErpScope;
  change: MeasurementAuthorityChange;
}): Promise<MeasurementAuthorityResult> {
  const changeId = cleanId(args.change.change_id);
  const entityId = cleanId(args.change.entity_id);
  const operation = cleanId(args.change.operation).toUpperCase();
  if (!changeId || !entityId) {
    throw new Error("MEASUREMENT_COMMAND_IDENTITY_MISSING");
  }
  if (!["INSERT", "UPDATE", "SOFT_DELETE"].includes(operation)) {
    throw new Error("MEASUREMENT_OPERATION_UNSUPPORTED");
  }

  const typedOperation = operation as MeasurementAuthorityOperation;
  const expectedVersion = parseExpectedVersion(
    typedOperation,
    args.change.expected_version,
  );
  const payload = normalizeCommandPayload(entityId, args.change.patch);
  const parentPackage = normalizeParentPackage(args.change.patch, payload);

  const command = {
    changeId,
    entityId,
    operation: typedOperation,
    expectedVersion,
    deviceId: cleanId(args.change.device_id) || "unknown",
    payload,
  };
  const context = {
    actorUserId: args.actorUserId,
    tenantId: args.scope.tenantId,
    companyId: args.scope.companyId,
    branchId: args.scope.branchId,
    accountingPeriodId: args.scope.accountingPeriodId,
  };
  const rpcResponse = parentPackage
    ? await args.supabase.rpc(
        "persist_measurement_package_authority_v1",
        {
          p_command: command,
          p_context: context,
          p_parent_package: parentPackage,
        },
      )
    : await args.supabase.rpc(
        "persist_measurement_authority_v1",
        {
          p_command: command,
          p_context: context,
        },
      );

  const { data, error } = rpcResponse;

  if (error) {
    const publicCode =
      typeof error.message === "string" &&
      /^MEASUREMENT_[A-Z0-9_]+$/.test(error.message)
        ? error.message
        : "MEASUREMENT_AUTHORITY_RPC_FAILED";
    console.error("[MeasurementAuthority] Canonical RPC failed.");
    throw new Error(publicCode);
  }
  return parseResult(data);
}