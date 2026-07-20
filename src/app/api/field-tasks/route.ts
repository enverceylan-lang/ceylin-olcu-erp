import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";

const ADMIN_ROLES = new Set([
  "ADMIN",
  "MODERATOR",
  "OFFICE",
  "SALES",
]);

const FIELD_ROLES = new Set([
  "FIELD",
  "MEASUREMENT",
]);

const VALID_STATUSES = new Set([
  "ASSIGNED",
  "ON_THE_WAY",
  "MEASUREMENT_STARTED",
  "MEASUREMENT_TAKEN",
  "COMPLETED",
  "CANCELLED",
]);

function getSupabaseServer() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanString(
  value: unknown,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function optionalString(
  value: unknown,
  maxLength: number,
): string | null {
  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

function optionalDate(
  value: unknown,
): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function mapTask(row: Record<string, unknown>) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerAddress: row.customer_address,
    mapLocation: row.map_location,

    customerSnapshot:
      row.customer_snapshot &&
      typeof row.customer_snapshot === "object"
        ? row.customer_snapshot
        : {},

    assignedUserId: row.assigned_user_id,
    assignedUserName: row.assigned_user_name,

    assignedById: row.assigned_by_id,
    assignedByName: row.assigned_by_name,

    scheduledAt: row.scheduled_at,
    note: row.note,
    status: row.status,

    seenAt: row.seen_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: NextRequest) {
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

  const role =
    String(user.role || "").toUpperCase();

  if (
    !ADMIN_ROLES.has(role) &&
    !FIELD_ROLES.has(role)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  const supabase = getSupabaseServer();

  const sinceParam =
    req.nextUrl.searchParams.get("since");

  const since =
    optionalDate(sinceParam);

  let query = supabase
    .from("field_tasks")
    .select("*")
    .order("updated_at", {
      ascending: false,
    })
    .limit(200);

  if (FIELD_ROLES.has(role)) {
    query = query.eq(
      "assigned_user_id",
      String(user.id),
    );
  }

  if (since) {
    query = query.gt(
      "updated_at",
      since,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[Field Tasks GET] Database query failed:",
      error.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Database query failed.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    tasks: (data || []).map(mapTask),
    serverTime: new Date().toISOString(),
  });
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

  const role =
    String(user.role || "").toUpperCase();

  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON.",
      },
      { status: 400 },
    );
  }

  const id =
    cleanString(body.id, 200);

  const customerId =
    cleanString(body.customerId, 200);

  const customerName =
    cleanString(body.customerName, 250);

  const assignedUserId =
    cleanString(body.assignedUserId, 200);

  const assignedUserName =
    cleanString(body.assignedUserName, 250);

  if (
    !id ||
    !customerId ||
    !customerName ||
    !assignedUserId ||
    !assignedUserName
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Required task fields are missing.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();

  const {
    data: assignedUser,
    error: assignedUserError,
  } = await supabase
    .from("users")
    .select("id, name, role, isActive")
    .eq("id", assignedUserId)
    .maybeSingle();

  if (assignedUserError) {
    console.error(
      "[Field Tasks POST] Assigned user query failed:",
      assignedUserError.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Assigned user could not be validated.",
      },
      { status: 500 },
    );
  }

  const assignedRole =
    String(assignedUser?.role || "").toUpperCase();

  if (
    !assignedUser ||
    assignedUser.isActive === false ||
    !FIELD_ROLES.has(assignedRole)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Selected user is not an active field employee.",
      },
      { status: 400 },
    );
  }

  const now =
    new Date().toISOString();

  const record = {
    id,

    customer_id: customerId,
    customer_name: customerName,
    customer_phone:
      optionalString(body.customerPhone, 100),
    customer_address:
      optionalString(body.customerAddress, 1000),
    map_location:
      optionalString(body.mapLocation, 1000),

    assigned_user_id:
      String(assignedUser.id),
    assigned_user_name:
      cleanString(
        assignedUser.name ||
          assignedUserName,
        250,
      ),

    assigned_by_id:
      String(user.id),
    assigned_by_name:
      cleanString(user.name, 250) ||
      cleanString(user.username, 250) ||
      "System User",

    scheduled_at:
      optionalDate(body.scheduledAt),

    note:
      optionalString(body.note, 2000),

    customer_snapshot:
      body.customerSnapshot &&
      typeof body.customerSnapshot === "object"
        ? body.customerSnapshot
        : {},

    status: "ASSIGNED",
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("field_tasks")
    .upsert(record, {
      onConflict: "id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Field Tasks POST] Database write failed:",
      error.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Task could not be saved.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    task: mapTask(data),
  });
}

export async function PATCH(req: NextRequest) {
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

  const role =
    String(user.role || "").toUpperCase();

  if (
    !ADMIN_ROLES.has(role) &&
    !FIELD_ROLES.has(role)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON.",
      },
      { status: 400 },
    );
  }

  const id =
    cleanString(body.id, 200);

  const status =
    cleanString(body.status, 50)
      .toUpperCase();

  if (!id || !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid task update.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();

  let existingQuery = supabase
    .from("field_tasks")
    .select("*")
    .eq("id", id);

  if (FIELD_ROLES.has(role)) {
    existingQuery = existingQuery.eq(
      "assigned_user_id",
      String(user.id),
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await existingQuery.maybeSingle();

  if (existingError) {
    console.error(
      "[Field Tasks PATCH] Task query failed:",
      existingError.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Task could not be validated.",
      },
      { status: 500 },
    );
  }

  if (!existing) {
    return NextResponse.json(
      {
        success: false,
        error: "Task not found.",
      },
      { status: 404 },
    );
  }

  const now =
    new Date().toISOString();

  const updateRecord: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (
    body.markSeen === true &&
    !existing.seen_at
  ) {
    updateRecord.seen_at = now;
  }

  if (status === "COMPLETED") {
    updateRecord.completed_at = now;
  }

  if (
    status !== "COMPLETED" &&
    existing.completed_at
  ) {
    updateRecord.completed_at = null;
  }

  const { data, error } = await supabase
    .from("field_tasks")
    .update(updateRecord)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Field Tasks PATCH] Database update failed:",
      error.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Task could not be updated.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    task: mapTask(data),
  });
}


