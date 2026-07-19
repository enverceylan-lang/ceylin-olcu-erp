import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";

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
    const changeId = cleanString(event.changeId, MAX_CHANGE_ID_LENGTH);
    const entityId = cleanString(event.entityId, MAX_ID_LENGTH);
    const entityType = cleanString(event.entityType, 40).toUpperCase();
    const operation = cleanString(event.operation, 40).toUpperCase();
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

    const payload = {
      change_id: changeId,
      operation,
      patch: deepSanitizeMedia(event.patch),
      device_id: deviceId,
      user_id: user.id,
      created_at: normalizeCreatedAt(event.createdAt),
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

  try {
    if (measurementChanges.length > 0) {
      const { error } = await supabaseServer
        .from("measurement_changes")
        .upsert(measurementChanges, {
          onConflict: "change_id",
        });

      if (error) {
        console.error("[Delta Push] Measurement write failed.");
        errors.push("Failed to push measurement changes");
        errorIds.push(
          ...measurementChanges.map((change) => String(change.change_id)),
        );
      } else {
        syncedIds.push(
          ...measurementChanges.map((change) => String(change.change_id)),
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