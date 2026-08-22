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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

  const { data, error } = await args.supabase.rpc(
    "persist_measurement_authority_v1",
    {
      p_command: command,
      p_context: context,
    },
  );

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