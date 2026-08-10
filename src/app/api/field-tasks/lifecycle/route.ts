import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";

type LifecycleAction =
  | "CANCEL"
  | "ARCHIVE"
  | "RESTORE"
  | "DELETE";

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

    cancelledAt: row.cancelled_at,
    cancelledById: row.cancelled_by_id,
    cancelledByName: row.cancelled_by_name,
    cancelReason: row.cancel_reason,

    archivedAt: row.archived_at,
    archivedById: row.archived_by_id,
    archivedByName: row.archived_by_name,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadAdminContext(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      ),
    } as const;
  }

  const role =
    String(user.role || "").toUpperCase();

  if (role !== "ADMIN") {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "Forbidden",
        },
        { status: 403 },
      ),
    } as const;
  }

  const supabase = getSupabaseServer();

  const erpContext =
    await loadShadowErpContext(
      supabase,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(req),
      },
    );

  if (!erpContext.ready) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "ERP scope is not ready",
          reason: erpContext.reason,
        },
        {
          status:
            erpContext.reason === "READ_FAILED"
              ? 503
              : 409,
        },
      ),
    } as const;
  }

  return {
    user,
    supabase,
    erpContext,
  } as const;
}

export async function PATCH(req: NextRequest) {
  const context = await loadAdminContext(req);

  if ("response" in context) {
    return context.response;
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

  const action =
    cleanString(body.action, 30)
      .toUpperCase() as LifecycleAction;

  const reason =
    cleanString(body.reason, 1000);

  if (
    !id ||
    ![
      "CANCEL",
      "ARCHIVE",
      "RESTORE",
    ].includes(action)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid lifecycle update.",
      },
      { status: 400 },
    );
  }

  if (action === "CANCEL" && !reason) {
    return NextResponse.json(
      {
        success: false,
        error: "Cancellation reason is required.",
      },
      { status: 400 },
    );
  }

  const {
    supabase,
    erpContext,
    user,
  } = context;

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("field_tasks")
    .select("*")
    .eq("id", id)
    .match({
      tenant_id: erpContext.scope.tenantId,
      company_id: erpContext.scope.companyId,
      branch_id: erpContext.scope.branchId,
      accounting_period_id:
        erpContext.scope.accountingPeriodId,
    })
    .maybeSingle();

  if (existingError) {
    console.error(
      "[Field Task Lifecycle] Task query failed:",
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

  const actorName =
    cleanString(user.name, 250) ||
    cleanString(user.username, 250) ||
    "ADMIN";

  const updateRecord:
    Record<string, unknown> = {
      updated_at: now,
    };

  if (action === "CANCEL") {
    if (existing.archived_at) {
      return NextResponse.json(
        {
          success: false,
          error: "Archived task cannot be cancelled.",
        },
        { status: 409 },
      );
    }

    if (existing.status === "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "Completed task cannot be cancelled.",
        },
        { status: 409 },
      );
    }

    if (existing.status === "CANCELLED") {
      return NextResponse.json({
        success: true,
        task: mapTask(existing),
        idempotent: true,
      });
    }

    updateRecord.status = "CANCELLED";
    updateRecord.cancelled_at = now;
    updateRecord.cancelled_by_id =
      String(user.id);
    updateRecord.cancelled_by_name =
      actorName;
    updateRecord.cancel_reason = reason;
    updateRecord.completed_at = null;
  }

  if (action === "ARCHIVE") {
    if (existing.archived_at) {
      return NextResponse.json({
        success: true,
        task: mapTask(existing),
        idempotent: true,
      });
    }

    if (
      existing.status !== "COMPLETED" &&
      existing.status !== "CANCELLED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only completed or cancelled tasks can be archived.",
        },
        { status: 409 },
      );
    }

    updateRecord.archived_at = now;
    updateRecord.archived_by_id =
      String(user.id);
    updateRecord.archived_by_name =
      actorName;
  }

  if (action === "RESTORE") {
    if (!existing.archived_at) {
      return NextResponse.json({
        success: true,
        task: mapTask(existing),
        idempotent: true,
      });
    }

    updateRecord.archived_at = null;
    updateRecord.archived_by_id = null;
    updateRecord.archived_by_name = null;
  }

  const { data, error } =
    await supabase
      .from("field_tasks")
      .update(updateRecord)
      .eq("id", id)
      .match({
        tenant_id:
          erpContext.scope.tenantId,
        company_id:
          erpContext.scope.companyId,
        branch_id:
          erpContext.scope.branchId,
        accounting_period_id:
          erpContext.scope.accountingPeriodId,
      })
      .select("*")
      .single();

  if (error) {
    console.error(
      "[Field Task Lifecycle] Update failed:",
      error.message,
    );

    return NextResponse.json(
      {
        success: false,
        error: "Task lifecycle could not be updated.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    task: mapTask(data),
  });
}

export async function DELETE(req: NextRequest) {
  const context = await loadAdminContext(req);

  if ("response" in context) {
    return context.response;
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

  const reason =
    cleanString(body.reason, 1000);

  if (!id || !reason) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Task id and permanent deletion reason are required.",
      },
      { status: 400 },
    );
  }

  const {
    supabase,
    erpContext,
    user,
  } = context;

  const actorName =
    cleanString(user.name, 250) ||
    cleanString(user.username, 250) ||
    "ADMIN";

  const { data, error } =
    await supabase.rpc(
      "admin_hard_delete_field_task_v1",
      {
        p_tenant_id:
          erpContext.scope.tenantId,
        p_company_id:
          erpContext.scope.companyId,
        p_branch_id:
          erpContext.scope.branchId,
        p_accounting_period_id:
          erpContext.scope.accountingPeriodId,
        p_task_id: id,
        p_actor_id: String(user.id),
        p_actor_name: actorName,
        p_reason: reason,
      },
    );

  if (error) {
    console.error(
      "[Field Task Lifecycle DELETE] RPC failed:",
      error.message,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Task could not be permanently deleted.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    deletion: data,
  });
}
