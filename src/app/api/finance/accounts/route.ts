import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { guardServerFinanceAccess } from "@/lib/serverFinanceAccessGuard";
import { loadShadowErpContext } from "@/lib/serverErpContext";

export const dynamic = "force-dynamic";

type AccountKind = "CASH" | "BANK" | "POS";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function isKind(value: unknown): value is AccountKind {
  return value === "CASH" || value === "BANK" || value === "POS";
}

async function createContext(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return {
      ok: false as const,
      response: json({ success: false, error: "UNAUTHORIZED" }, 401),
    };
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false as const,
      response: json(
        { success: false, error: "SERVER_CONFIGURATION_ERROR" },
        500,
      ),
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const context = await loadShadowErpContext(supabase, user.id, {
    requestedScopeId: readRequestedErpScopeId(req),
  });

  if (!context.ready) {
    return {
      ok: false as const,
      response: json(
        {
          success: false,
          error: "ERP_CONTEXT_NOT_READY",
          reason: context.reason,
        },
        context.reason === "READ_FAILED" ? 503 : 409,
      ),
    };
  }

  const access = guardServerFinanceAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion,
    },
    requestedPermission: "finance.account.manage",
    requestedCapability: "ACCOUNT_MANAGE",
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
  });

  if (!access.allowed) {
    return {
      ok: false as const,
      response: json(
        {
          success: false,
          error: "FINANCE_ACCESS_DENIED",
          reason: access.reasonCode,
        },
        403,
      ),
    };
  }

  return {
    ok: true as const,
    user,
    supabase,
    context,
  };
}

export async function GET(req: NextRequest) {
  const resolved = await createContext(req);
  if (!resolved.ok) {
    return resolved.response;
  }

  const scope = resolved.context.scope;
  const filter = {
    tenant_id: scope.tenantId,
    company_id: scope.companyId,
    branch_id: scope.branchId,
    accounting_period_id: scope.accountingPeriodId,
  };

  const [finance, cash, bank, pos] = await Promise.all([
    resolved.supabase
      .from("finance_accounts")
      .select(
        "id,code,name,account_type,currency,is_active,is_default_collection,is_default_payment,created_at,updated_at,archived_at",
      )
      .match(filter)
      .order("code", { ascending: true }),
    resolved.supabase
      .from("cash_accounts")
      .select(
        "id,cash_code,cash_name,ledger_account_id,currency,is_active,created_at,updated_at,archived_at",
      )
      .match(filter)
      .order("cash_code", { ascending: true }),
    resolved.supabase
      .from("bank_accounts")
      .select(
        "id,bank_code,bank_name,account_name,branch_name,iban,account_number,ledger_account_id,currency,is_active,created_at,updated_at,archived_at",
      )
      .match(filter)
      .order("bank_code", { ascending: true }),
    resolved.supabase
      .from("pos_accounts")
      .select(
        "id,pos_code,pos_name,bank_account_id,clearing_ledger_account_id,kind,merchant_number,terminal_number,currency,is_active,created_at,updated_at,archived_at",
      )
      .match(filter)
      .order("pos_code", { ascending: true }),
  ]);

  const firstError =
    finance.error || cash.error || bank.error || pos.error;

  if (firstError) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCOUNT_MASTER_READ_FAILED",
      },
      503,
    );
  }

  return json(
    {
      success: true,
      financeAccounts: finance.data || [],
      cashAccounts: cash.data || [],
      bankAccounts: bank.data || [],
      posAccounts: pos.data || [],
    },
    200,
  );
}

export async function POST(req: NextRequest) {
  const resolved = await createContext(req);
  if (!resolved.ok) {
    return resolved.response;
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return json({ success: false, error: "INVALID_JSON" }, 400);
  }

  const record = body as Record<string, unknown>;
  const action = String(record.action || "").trim().toUpperCase();
  const kind = String(record.kind || "").trim().toUpperCase();
  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : null;
  const idempotencyKey =
    typeof record.idempotencyKey === "string"
      ? record.idempotencyKey.trim()
      : "";

  if (
    (action !== "CREATE" && action !== "ARCHIVE") ||
    !isKind(kind) ||
    !payload ||
    !idempotencyKey
  ) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCOUNT_MASTER_REQUEST_INVALID",
      },
      400,
    );
  }

  const scope = resolved.context.scope;
  const canonicalForHash = {
    action,
    kind,
    scope: {
      tenantId: scope.tenantId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accountingPeriodId: scope.accountingPeriodId,
    },
    payload,
  };

  const { data, error } = await resolved.supabase.rpc(
    "manage_finance_account_master_v1",
    {
      p_action: action,
      p_kind: kind,
      p_scope: {
        tenant_id: scope.tenantId,
        company_id: scope.companyId,
        branch_id: scope.branchId,
        accounting_period_id: scope.accountingPeriodId,
      },
      p_payload: payload,
      p_actor_user_id: String(resolved.user.id),
      p_idempotency_key: idempotencyKey,
      p_payload_hash: hashPayload(canonicalForHash),
    },
  );

  if (error) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCOUNT_MASTER_PERSISTENCE_FAILED",
      },
      503,
    );
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result || typeof result !== "object") {
    return json(
      {
        success: false,
        error: "FINANCE_ACCOUNT_MASTER_EMPTY_RESULT",
      },
      503,
    );
  }

  const value = result as Record<string, unknown>;
  const outcome = String(value.outcome || "");
  const reason =
    typeof value.reason === "string" ? value.reason : null;

  if (outcome === "CONFLICT") {
    return json(
      {
        success: false,
        outcome,
        financeAccountId: value.finance_account_id,
        operationalAccountId: value.operational_account_id,
        reason,
      },
      409,
    );
  }

  if (outcome === "REJECT") {
    return json(
      {
        success: false,
        outcome,
        financeAccountId: value.finance_account_id,
        operationalAccountId: value.operational_account_id,
        reason,
      },
      422,
    );
  }

  return json(
    {
      success: true,
      outcome,
      financeAccountId: value.finance_account_id,
      operationalAccountId: value.operational_account_id,
      reason,
    },
    outcome === "CREATED" ? 201 : 200,
  );
}