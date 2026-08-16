import { stableFinanceOperationHash } from "@/lib/finance/stableFinanceOperationHash";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { guardServerFinanceChannelAccess } from "@/lib/serverFinanceAccessGuard";
import { decideFinanceServerOperationContract } from "@/lib/finance/financeOperationsServerContract";
import {
  persistFinanceOperationV1,
  type FinanceOperationsRpcClient
} from "@/lib/finance/financeOperationsSupabaseGateway";
import { decidePosServerAuthorityContract } from "@/lib/finance/posServerAuthorityPolicy";
import {
  persistFinancePosAuthorityV1,
  type PosServerAuthorityRpcClient
} from "@/lib/finance/posServerAuthoritySupabaseGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0"
} as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function hasPosCommand(body: unknown): boolean {
  return Boolean(
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "posCommand")
  );
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

  const body = await request.json().catch(() => null);

  if (hasPosCommand(body)) {
    const decision = decidePosServerAuthorityContract(body, context.scope);

    if (!decision.allowed) {
      return json({ success: false, error: decision.code }, decision.status);
    }

    if (user.role !== "ADMIN") {
      return json({ success: false, error: "FINANCE_POS_ADMIN_REQUIRED" }, 403);
    }

    const serverOperation = {
      ...decision.command,
      tenantId: context.scope.tenantId,
      companyId: context.scope.companyId,
      branchId: context.scope.branchId,
      accountingPeriodId: context.scope.accountingPeriodId
    };

    try {
      const result = await persistFinancePosAuthorityV1(
        supabaseServer as unknown as PosServerAuthorityRpcClient,
        serverOperation as unknown as Record<string, unknown>,
        user.id,
        stableFinanceOperationHash(serverOperation)
      );

      if (result.outcome === "CONFLICT") {
        return json(
          {
            success: false,
            outcome: result.outcome,
            operationId: result.operation_id,
            transactionIds: result.transaction_ids,
            reason: result.reason
          },
          409
        );
      }

      if (result.outcome === "REJECT") {
        return json(
          {
            success: false,
            outcome: result.outcome,
            operationId: result.operation_id,
            transactionIds: result.transaction_ids,
            reason: result.reason
          },
          422
        );
      }

      return json(
        {
          success: true,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids
        },
        result.outcome === "CREATED" ? 201 : 200
      );
    } catch {
      console.error("[Finance POS Authority API] Persistence failed.");
      return json({ success: false, error: "FINANCE_POS_PERSISTENCE_FAILED" }, 503);
    }
  }

  const contract = decideFinanceServerOperationContract(body, context.scope);

  if (!contract.allowed) {
    return json({ success: false, error: contract.code }, contract.status);
  }

  const access = guardServerFinanceChannelAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion
    },
    channel: contract.guard.channel,
    operation: contract.guard.operation,
    direction: contract.guard.direction,
    requestedPermission: contract.guard.requestedPermission as never,
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
    customerId: contract.command.source.customerId ?? undefined,
    saleId: contract.command.source.saleId ?? undefined
  });

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCESS_DENIED",
        reason: access.reasonCode
      },
      403
    );
  }

  const serverOperation = {
    ...contract.command,
    tenantId: context.scope.tenantId,
    companyId: context.scope.companyId,
    branchId: context.scope.branchId,
    accountingPeriodId: context.scope.accountingPeriodId
  };

  try {
    const result = await persistFinanceOperationV1(
      supabaseServer as unknown as FinanceOperationsRpcClient,
      serverOperation as unknown as Record<string, unknown>,
      user.id,
      stableFinanceOperationHash(serverOperation)
    );

    if (result.outcome === "CONFLICT") {
      return json(
        {
          success: false,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids,
          reason: result.reason
        },
        409
      );
    }

    if (result.outcome === "REJECT") {
      return json(
        {
          success: false,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids,
          reason: result.reason
        },
        422
      );
    }

    return json(
      {
        success: true,
        outcome: result.outcome,
        operationId: result.operation_id,
        transactionIds: result.transaction_ids
      },
      result.outcome === "CREATED" ? 201 : 200
    );
  } catch {
    console.error("[Finance Operations API] Persistence failed.");
    return json({ success: false, error: "FINANCE_OPERATION_PERSISTENCE_FAILED" }, 503);
  }
}
