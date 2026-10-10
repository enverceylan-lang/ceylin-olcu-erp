import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { guardServerFinanceChannelAccess } from "@/lib/serverFinanceAccessGuard";
import { stableFinanceOperationHash } from "@/lib/finance/stableFinanceOperationHash";
import { decideOpeningBalanceServerContract } from "@/lib/finance/openingBalanceContracts";
import {
  persistFinanceOpeningBalanceV1,
  type OpeningBalanceRpcClient,
} from "@/lib/finance/openingBalanceSupabaseGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
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

  const body = await request.json().catch(() => null);
  const decision = decideOpeningBalanceServerContract(body);
  if (!decision.allowed) {
    return json({ success: false, error: decision.code }, decision.status);
  }

  const access = guardServerFinanceChannelAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion,
    },
    channel: "OPENING",
    operation: "OPENING_BALANCE",
    direction: "CREATE",
    requestedPermission: "finance.opening_balance.create",
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
    customerId: decision.command.customerId,
  });

  if (!access.allowed) {
    return json(
      { success: false, error: "FINANCE_ACCESS_DENIED", reason: access.reasonCode },
      403,
    );
  }

  const serverCommand = {
    ...decision.command,
    tenantId: context.scope.tenantId,
    companyId: context.scope.companyId,
    branchId: context.scope.branchId,
    accountingPeriodId: context.scope.accountingPeriodId,
  };

  try {
    const result = await persistFinanceOpeningBalanceV1(
      supabaseServer as unknown as OpeningBalanceRpcClient,
      serverCommand as unknown as Record<string, unknown>,
      user.id,
      stableFinanceOperationHash(serverCommand),
    );

    const status =
      result.outcome === "CREATED"
        ? 201
        : result.outcome === "REPLAY"
          ? 200
          : result.outcome === "CONFLICT"
            ? 409
            : 422;

    return json(
      {
        success: result.outcome === "CREATED" || result.outcome === "REPLAY",
        outcome: result.outcome,
        operationId: result.operation_id,
        transactionIds: result.transaction_ids || [],
        reason: result.reason,
      },
      status,
    );
  } catch {
    console.error("[Finance Opening Balance API] Persistence failed.");
    return json({ success: false, error: "FINANCE_OPENING_BALANCE_PERSISTENCE_FAILED" }, 503);
  }
}
