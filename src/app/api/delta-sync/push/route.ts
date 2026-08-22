import { erpScopeMatches, validateErpScope, type ErpScope } from '@/lib/erpScope';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { persistMeasurementAuthorityCommand } from "@/lib/serverMeasurementAuthority";

const ALLOWED_PUSH_ROLES = new Set([
  "ADMIN",
  "MODERATOR",
  "OFFICE",
  "SALES",
  "FIELD",
  "MEASUREMENT",
]);

const ALLOWED_ENTITY_TYPES = new Set([
  "DRAFT",
  "CUSTOMER",
  "ROOM",
  "OPENING",
  "MEASUREMENT",
]);

const ALLOWED_OPERATIONS = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "SOFT_DELETE",
]);

const MAX_EVENTS_PER_REQUEST = 50;
const MAX_ID_LENGTH = 200;
const MAX_DEVICE_ID_LENGTH = 100;
const MAX_CHANGE_ID_LENGTH = 100;

function deepSanitizeMedia(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (
      value.startsWith("data:image") ||
      value.startsWith("data:video") ||
      value.includes(";base64,") ||
      value.length > 10000
    ) {
      return "[REDACTED_MEDIA]";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepSanitizeMedia(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (["photos", "videos", "addressPhotos"].includes(key)) {
        continue;
      }

      result[key] = deepSanitizeMedia(nestedValue);
    }

    return result;
  }

  return value;
}

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeCreatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  if (!ALLOWED_PUSH_ROLES.has(String(user.role).toUpperCase())) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Delta Push Config] Required server configuration is missing.");

    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
      },
      { status: 500 },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON body",
      },
      { status: 400 },
    );
  }

  const events = (body as { events?: unknown })?.events;

  if (!Array.isArray(events)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid payload: events must be an array",
      },
      { status: 400 },
    );
  }

  if (events.length === 0) {
    return NextResponse.json({
      success: true,
      syncedIds: [],
      errorIds: [],
      errors: [],
    });
  }

  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return NextResponse.json(
      {
        success: false,
        error: `Payload too large: maximum ${MAX_EVENTS_PER_REQUEST} events allowed`,
      },
      { status: 400 },
    );
  }

  const measurementChanges: Record<string, unknown>[] = [];
  const draftChanges: Record<string, unknown>[] = [];
  const rejectedIds: string[] = [];
  const errors: string[] = [];

  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") {
      errors.push("Invalid event object");
      continue;
    }

    const event = rawEvent as Record<string, unknown>;
    const eventScopeCandidate = event.scope as Partial<ErpScope> | undefined;
    const eventScopeValidation = validateErpScope(eventScopeCandidate ?? {});
    if (!eventScopeValidation.valid) {
      errors.push('Missing or invalid ERP scope on sync event');
      continue;
    }
    const eventScope = eventScopeCandidate as ErpScope;
    const changeId = cleanString(event.changeId, MAX_CHANGE_ID_LENGTH);
    const entityId = cleanString(event.entityId, MAX_ID_LENGTH);
    const entityType = cleanString(event.entityType, 40).toUpperCase();
    const operation = cleanString(event.operation, 40).toUpperCase();
    const expectedVersion = event.expectedVersion;
    const deviceId =
      cleanString(event.deviceId, MAX_DEVICE_ID_LENGTH) || "unknown";

    if (!changeId) {
      errors.push("Invalid or missing changeId");
      continue;
    }

    if (!entityId) {
      rejectedIds.push(changeId);
      errors.push(`Invalid or missing entityId for event ${changeId}`);
      continue;
    }

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      rejectedIds.push(changeId);
      errors.push(`Invalid entityType for event ${changeId}`);
      continue;
    }

    if (!ALLOWED_OPERATIONS.has(operation)) {
      rejectedIds.push(changeId);
      errors.push(`Invalid operation for event ${changeId}`);
      continue;
    }

    if (entityType === "MEASUREMENT") {
      if (operation === "DELETE") {
        rejectedIds.push(changeId);
        errors.push(`Physical measurement delete is unsupported for event ${changeId}`);
        continue;
      }

      if (
        typeof expectedVersion !== "number" ||
        !Number.isInteger(expectedVersion) ||
        expectedVersion < 0
      ) {
        rejectedIds.push(changeId);
        errors.push(`Missing or invalid expectedVersion for measurement event ${changeId}`);
        continue;
      }

      if (
        (operation === "INSERT" && expectedVersion !== 0) ||
        (operation !== "INSERT" && expectedVersion < 1)
      ) {
        rejectedIds.push(changeId);
        errors.push(`Invalid expectedVersion for measurement operation ${changeId}`);
        continue;
      }
    }

    const payload = {
      change_id: changeId,
      operation,
      patch: deepSanitizeMedia(event.patch),
      device_id: deviceId,
      user_id: user.id,
      created_at: normalizeCreatedAt(event.createdAt),
      expected_version: expectedVersion,
      _event_scope: eventScope,
    };

    if (entityType === "DRAFT") {
      draftChanges.push({
        ...payload,
        draft_id: entityId,
      });
    } else {
      measurementChanges.push({
        ...payload,
        entity_type: entityType,
        entity_id: entityId,
      });
    }
  }

  const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const syncedIds: string[] = [];
  const errorIds: string[] = [...rejectedIds];
  const measurementResults: Array<{
    changeId: string;
    entityId: string;
    entityVersion: number;
    outcome: string;
  }> = [];

  try {
    const erpContext = await loadShadowErpContext(
      supabaseServer,
      user.id,
      { requestedScopeId: readRequestedErpScopeId(req) },
    );

    if (!erpContext.ready) {
      return NextResponse.json(
        {
          success: false,
          error: "ERP scope is not ready",
          reason: erpContext.reason,
        },
        { status: erpContext.reason === "READ_FAILED" ? 503 : 409 },
      );
    }

    const scopeColumns = {
      tenant_id: erpContext.scope.tenantId,
      company_id: erpContext.scope.companyId,
      branch_id: erpContext.scope.branchId,
      accounting_period_id:
        erpContext.scope.accountingPeriodId,
    };

    for (const change of [...measurementChanges, ...draftChanges]) {
      const eventScope = change._event_scope as ErpScope | undefined;
      if (!eventScope || !erpScopeMatches(eventScope, erpContext.scope)) {
        return NextResponse.json({ success: false, error: 'ERP_SCOPE_MISMATCH' }, { status: 409 });
      }
      delete change._event_scope;
    }

    for (const change of measurementChanges) {
      Object.assign(change, scopeColumns);
    }
    for (const change of draftChanges) {
      Object.assign(change, scopeColumns);
    }

    const canonicalMeasurementChanges = measurementChanges.filter(
      (change) => String(change.entity_type || "").toUpperCase() === "MEASUREMENT",
    );
    const eventOnlyChanges = measurementChanges.filter(
      (change) => String(change.entity_type || "").toUpperCase() !== "MEASUREMENT",
    );

    for (const change of canonicalMeasurementChanges) {
      const changeId = String(change.change_id || "");
      try {
        const result = await persistMeasurementAuthorityCommand({
          supabase: supabaseServer,
          actorUserId: user.id,
          scope: erpContext.scope,
          change: {
            change_id: change.change_id,
            entity_id: change.entity_id,
            operation: change.operation,
            patch: change.patch,
            device_id: change.device_id,
            expected_version: change.expected_version,
          },
        });
        measurementResults.push(result);
        syncedIds.push(changeId);
      } catch (error: unknown) {
        console.error("[Delta Push] Canonical measurement commit failed.");
        errorIds.push(changeId);

        const publicError =
          error instanceof Error &&
          /^MEASUREMENT_[A-Z0-9_]+$/.test(error.message)
            ? error.message
            : `Failed to commit measurement ${changeId}`;

        errors.push(publicError);      }
    }

    if (eventOnlyChanges.length > 0) {
      const { error } = await supabaseServer
        .from("measurement_changes")
        .upsert(eventOnlyChanges, {
          onConflict: "change_id",
        });

      if (error) {
        console.error("[Delta Push] Non-measurement event write failed.");
        errors.push("Failed to push non-measurement changes");
        errorIds.push(
          ...eventOnlyChanges.map((change) => String(change.change_id)),
        );
      } else {
        syncedIds.push(
          ...eventOnlyChanges.map((change) => String(change.change_id)),
        );
      }
    }
    if (draftChanges.length > 0) {
      const { error } = await supabaseServer
        .from("draft_changes")
        .upsert(draftChanges, {
          onConflict: "change_id",
        });

      if (error) {
        console.error("[Delta Push] Draft write failed.");
        errors.push("Failed to push draft changes");
        errorIds.push(...draftChanges.map((change) => String(change.change_id)));
      } else {
        syncedIds.push(...draftChanges.map((change) => String(change.change_id)));
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      syncedIds,
      errorIds: Array.from(new Set(errorIds)),
      errors,
      measurementResults,
    });
  } catch {
    console.error("[Delta Push] Internal error.");

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
