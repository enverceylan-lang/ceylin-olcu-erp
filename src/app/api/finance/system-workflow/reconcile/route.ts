import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";

export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) {
    return json({ success: false, error: "UNAUTHORIZED" }, 401);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "SERVER_CONFIGURATION_MISSING" }, 500);
  }

  const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const context = await loadShadowErpContext(supabaseServer, user.id, {
    requestedScopeId: readRequestedErpScopeId(request)
  });

  if (!context.ready) {
    return json(
      {
        success: false,
        error: "ERP_CONTEXT_NOT_READY",
        reason: context.reason
      },
      context.reason === "READ_FAILED" ? 503 : 409
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "INVALID_JSON" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ success: false, error: "INVALID_BODY" }, 400);
  }

  const record = body as {
    workflow?: unknown;
    scope?: unknown;
    sourceId?: unknown;
    idempotencyKey?: unknown;
    transactionId?: unknown;
    auditPayloadHash?: unknown;
  };

  const workflow = typeof record.workflow === "string" ? record.workflow : null;
  const scope = record.scope && typeof record.scope === "object" && !Array.isArray(record.scope)
    ? record.scope as Record<string, unknown>
    : null;
  const sourceId = typeof record.sourceId === "string" ? record.sourceId : null;
  const idempotencyKey = typeof record.idempotencyKey === "string" ? record.idempotencyKey : null;
  const transactionId = typeof record.transactionId === "string" ? record.transactionId : null;
  const auditPayloadHash = typeof record.auditPayloadHash === "string" ? record.auditPayloadHash : null;

  if (!workflow || (workflow !== "SALE_APPROVAL" && workflow !== "SALE_RETURN_APPROVAL")) {
    return json({ success: false, error: "INVALID_WORKFLOW" }, 400);
  }
  if (!scope) {
    return json({ success: false, error: "SCOPE_REQUIRED" }, 400);
  }
  if (!sourceId || !idempotencyKey || !transactionId || !auditPayloadHash) {
    return json({ success: false, error: "REQUIRED_FIELDS_MISSING" }, 400);
  }

  // Scope validation
  const tenantId = typeof scope.tenantId === "string" ? scope.tenantId.trim() : "";
  const companyId = typeof scope.companyId === "string" ? scope.companyId.trim() : "";
  const branchId = typeof scope.branchId === "string" ? scope.branchId.trim() : "";
  const accountingPeriodId = typeof scope.accountingPeriodId === "string" ? scope.accountingPeriodId.trim() : "";

  if (!tenantId || !companyId || !branchId || !accountingPeriodId) {
    return json({ success: false, error: "SCOPE_REQUIRED" }, 400);
  }

  // Actor authorization - ensure user has access to this scope
  if (!context.scope || context.scope.tenantId !== tenantId || context.scope.companyId !== companyId || context.scope.branchId !== branchId || context.scope.accountingPeriodId !== accountingPeriodId) {
    return json({ success: false, error: "SCOPE_MISMATCH" }, 403);
  }

  try {
    const { data, error } = await supabaseServer.rpc("reconcile_finance_system_workflow_v1", {
      p_workflow: workflow,
      p_scope: scope,
      p_source_id: sourceId,
      p_idempotency_key: idempotencyKey,
      p_transaction_id: transactionId,
      p_audit_payload_hash: auditPayloadHash
    });

    if (error) {
      console.error("[Finance Workflow Reconcile] RPC error:", error);
      return json({ success: false, error: "RECONCILIATION_FAILED" }, 503);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return json({ success: false, error: "RECONCILIATION_NO_RESULT" }, 503);
    }

    const row = data[0];
    return NextResponse.json({
      success: true,
      outcome: row.outcome,
      transactionId: row.transaction_id,
      reason: row.reason,
      occurredAt: row.occurred_at,
      serverPayloadHash: row.server_payload_hash
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("[Finance Workflow Reconcile] Unexpected error:", err);
    return json({ success: false, error: "RECONCILIATION_FAILED" }, 503);
  }
}