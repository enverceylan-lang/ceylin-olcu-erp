import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { guardServerFinanceAccess } from "@/lib/serverFinanceAccessGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

type PaymentChannel = "CASH" | "BANK";

interface FinancePaymentHistoryRow {
  transaction_id: string;
  operation_group_id: string | null;
  finance_account_id: string | null;
  counterparty_id: string;
  source_document_id: string | null;
  gross_amount: number | string;
  currency: string;
  payment_method: string | null;
  status: string;
  description: string | null;
  posted_at: string | null;
  created_at: string;
  reversed_at: string | null;
  transaction_type: string;
  projection_source: string;
}

function channelFromRequest(request: NextRequest): PaymentChannel | null {
  const value = (request.nextUrl.searchParams.get("channel") || "")
    .trim()
    .toUpperCase();
  return value === "CASH" || value === "BANK" ? value : null;
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);

  const channel = channelFromRequest(request);
  if (!channel) {
    return json({ success: false, error: "FINANCE_PAYMENT_HISTORY_CHANNEL_INVALID" }, 400);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "SERVER_CONFIGURATION_MISSING" }, 500);
  }

  const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const context = await loadShadowErpContext(supabaseServer, user.id, {
    requestedScopeId: readRequestedErpScopeId(request),
  });

  if (!context.ready) {
    return json(
      { success: false, error: "ERP_CONTEXT_NOT_READY", reason: context.reason },
      context.reason === "READ_FAILED" ? 503 : 409,
    );
  }

  const requestedPermission =
    channel === "CASH"
      ? "finance.cash.payment.reverse"
      : "finance.bank.payment.reverse";
  const requestedCapability =
    channel === "CASH"
      ? "CASH_PAYMENT_REVERSE"
      : "BANK_PAYMENT_REVERSE";

  const access = guardServerFinanceAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion,
    },
    requestedPermission,
    requestedCapability,
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
  });

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: access.reasonCode || "FINANCE_ACCESS_DENIED",
      },
      403,
    );
  }

  const { tenantId, companyId, branchId, accountingPeriodId } = context.scope;

  const query = await supabaseServer
    .from("finance_transactions")
    .select(
      [
        "transaction_id",
        "operation_group_id",
        "finance_account_id",
        "counterparty_id",
        "source_document_id",
        "gross_amount",
        "currency",
        "payment_method",
        "status",
        "description",
        "posted_at",
        "created_at",
        "reversed_at",
        "transaction_type",
        "projection_source",
      ].join(","),
    )
    .eq("tenant_id", tenantId)
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .eq("accounting_period_id", accountingPeriodId)
    .eq("projection_source", "PAYMENT")
    .eq("payment_method", channel)
    .not("counterparty_id", "is", null)
    .not("operation_group_id", "is", null)
    .neq("transaction_type", "REVERSAL")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (query.error) {
    console.error("[Finance Payment History API] Read failed.");
    return json({ success: false, error: "FINANCE_PAYMENT_HISTORY_READ_FAILED" }, 503);
  }

  const rows = (query.data || []) as unknown as FinancePaymentHistoryRow[];
  const payments = rows.map((row) => ({
    reversalTargetId: row.operation_group_id || row.transaction_id,
    transactionId: row.transaction_id,
    operationId: row.operation_group_id,
    financeAccountId: row.finance_account_id,
    counterpartyId: row.counterparty_id,
    sourceDocumentId: row.source_document_id,
    amount: Number(row.gross_amount),
    currency: row.currency,
    channel,
    status: row.status,
    description: row.description,
    occurredAt: row.posted_at || row.created_at,
    reversed: row.status === "REVERSED" || Boolean(row.reversed_at),
  }));

  return json({ success: true, scope: context.scope, channel, payments }, 200);
}
