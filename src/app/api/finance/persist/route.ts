import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  createClient
} from "@supabase/supabase-js";

import {
  verifyAuth
} from "@/lib/authHelper";

import {
  readRequestedErpScopeId
} from "@/lib/erpActiveScopeCookie";

import {
  loadShadowErpContext
} from "@/lib/serverErpContext";

import {
  guardServerFinanceChannelAccess
} from "@/lib/serverFinanceAccessGuard";

import {
  decideFinancePersistenceApiContract
} from "@/lib/finance/financePersistenceApiContract";

import {
  persistFinanceTransaction
} from "@/lib/finance/financePersistenceGateway";

import {
  FinanceSupabaseGatewayAdapter,
  type FinanceSupabaseRpcClient
} from "@/lib/finance/financeSupabaseGatewayAdapter";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0"
} as const;

function json(
  body:
    Record<string, unknown>,
  status:
    number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        NO_STORE_HEADERS
    }
  );
}

export async function POST(
  request:
    NextRequest
) {
  const user =
    await verifyAuth(request);

  if (!user) {
    return json(
      {
        success:
          false,
        error:
          "UNAUTHORIZED"
      },
      401
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return json(
      {
        success:
          false,
        error:
          "SERVER_CONFIGURATION_MISSING"
      },
      500
    );
  }

  const supabaseServer =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false
        }
      }
    );

  const context =
    await loadShadowErpContext(
      supabaseServer,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(
            request
          )
      }
    );

  if (!context.ready) {
    return json(
      {
        success:
          false,
        error:
          "ERP_CONTEXT_NOT_READY",
        reason:
          context.reason
      },
      context.reason ===
        "READ_FAILED"
        ? 503
        : 409
    );
  }

  const body =
    await request
      .json()
      .catch(
        () =>
          null
      );

  const contract =
    decideFinancePersistenceApiContract(
      body,
      {
        id:
          user.id
      },
      context.scope
    );

  if (!contract.allowed) {
    return json(
      {
        success:
          false,
        error:
          contract.code
      },
      contract.status
    );
  }

  const access =
    guardServerFinanceChannelAccess({
      authenticatedUser: {
        id:
          user.id,
        role:
          user.role,
        storedPermissions:
          user.permissions,
        permissionVersion:
          user.permissionVersion,
        sessionPermissionVersion:
          user.sessionPermissionVersion
      },
      channel:
        contract.guardInput.channel,
      operation:
        contract.guardInput.operation,
      direction:
        contract.guardInput.direction,
      requestedPermission:
        contract.guardInput
          .requestedPermission,
      packageType:
        context.package,
      actorScope:
        context.scope,
      resourceScope: {
        tenantId:
          contract.transaction.tenantId,
        companyId:
          contract.transaction.companyId,
        branchId:
          contract.transaction.branchId,
        accountingPeriodId:
          contract.transaction
            .accountingPeriodId
      },
      customerId:
        contract.transaction.customerId,
      saleId:
        contract.transaction.saleId
    });

  if (!access.allowed) {
    return json(
      {
        success:
          false,
        error:
          "FINANCE_ACCESS_DENIED",
        reason:
          access.reasonCode
      },
      403
    );
  }

  try {
    const gateway =
      new FinanceSupabaseGatewayAdapter(
        supabaseServer as unknown as
          FinanceSupabaseRpcClient
      );

    const result =
      await persistFinanceTransaction(
        contract.transaction,
        {
          gateway
        }
      );

    if (
      result.outcome ===
        "CONFLICT"
    ) {
      return json(
        {
          success:
            false,
          outcome:
            result.outcome,
          transactionId:
            result.transactionId,
          reason:
            result.reason
        },
        409
      );
    }

    return json(
      {
        success:
          true,
        outcome:
          result.outcome,
        transactionId:
          result.transactionId
      },
      result.outcome ===
        "CREATED"
        ? 201
        : 200
    );
  }
  catch {
    console.error(
      "[Finance Persist API] Persistence failed."
    );

    return json(
      {
        success:
          false,
        error:
          "FINANCE_PERSISTENCE_FAILED"
      },
      503
    );
  }
}