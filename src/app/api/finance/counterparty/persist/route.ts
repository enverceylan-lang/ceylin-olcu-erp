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
  erpScopeMatches,
  validateErpScope,
  type ErpScope
} from "@/lib/erpScope";

import {
  loadShadowErpContext
} from "@/lib/serverErpContext";

import {
  persistCounterpartyPayableMovement
} from "@/lib/finance/counterpartyPayablePersistenceGateway";

import {
  CounterpartyPayableSupabaseGatewayAdapter,
  type CounterpartyPayableSupabaseRpcClient
} from "@/lib/finance/counterpartyPayableSupabaseGatewayAdapter";

import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";
import {
  authorizeCounterpartyAccrualAgainstSourceTruth
} from "@/lib/finance/counterpartySourceTruthAuthorizationGateway";
import {
  createCounterpartySourceTruthAuthorizationSupabaseGatewayAdapter,
  type CounterpartySourceTruthAuthorizationSupabaseRpcClient
} from "@/lib/finance/counterpartySourceTruthAuthorizationSupabaseGatewayAdapter";

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

function isRecord(
  value:
    unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

function hasText(
  value:
    unknown
): value is string {
  return (
    typeof value ===
      "string" &&
    Boolean(value.trim())
  );
}

function isMovement(
  value:
    unknown
): value is CounterpartyPayableMovement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasText(value.tenantId) &&
    hasText(value.companyId) &&
    hasText(value.branchId) &&
    hasText(value.accountingPeriodId) &&
    hasText(value.id) &&
    hasText(value.idempotencyKey) &&
    hasText(value.counterpartyCustomerId) &&
    (
      value.counterpartyType ===
        "SUPPLIER" ||
      value.counterpartyType ===
        "TAILOR" ||
      value.counterpartyType ===
        "INSTALLER"
    ) &&
    (
      value.kind ===
        "ACCRUAL" ||
      value.kind ===
        "PAYMENT" ||
      value.kind ===
        "REVERSAL"
    ) &&
    typeof value.amount ===
      "number" &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    value.currency ===
      "TRY" &&
    hasText(value.occurredAt) &&
    hasText(value.recordedAt)
  );
}

function movementScope(
  movement:
    CounterpartyPayableMovement
): ErpScope {
  return {
    tenantId:
      movement.tenantId,
    companyId:
      movement.companyId,
    branchId:
      movement.branchId,
    accountingPeriodId:
      movement.accountingPeriodId
  };
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

  const body =
    await request
      .json()
      .catch(
        () =>
          null
      );

  if (
    !isRecord(body) ||
    !isMovement(
      body.movement
    )
  ) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_REQUEST"
      },
      400
    );
  }

  const movement =
    body.movement;

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

  const resourceScope =
    movementScope(
      movement
    );

  if (
    !validateErpScope(
      resourceScope
    ).valid
  ) {
    return json(
      {
        success:
          false,
        error:
          "INVALID_SCOPE"
      },
      400
    );
  }

  if (
    !erpScopeMatches(
      context.scope,
      resourceScope
    )
  ) {
    return json(
      {
        success:
          false,
        error:
          "SCOPE_MISMATCH"
      },
      403
    );
  }
  if (movement.kind === "ACCRUAL") {
    const sourceAuthorizationGateway =
      createCounterpartySourceTruthAuthorizationSupabaseGatewayAdapter(
        supabaseServer as unknown as
          CounterpartySourceTruthAuthorizationSupabaseRpcClient
      );

    const sourceAuthorization =
      await authorizeCounterpartyAccrualAgainstSourceTruth(
        movement,
        sourceAuthorizationGateway
      );

    if (!sourceAuthorization.ok) {
      return json(
        {
          success: false,
          error:
            "COUNTERPARTY_ACCRUAL_SOURCE_NOT_AUTHORIZED",
          reason:
            sourceAuthorization.reason
        },
        409
      );
    }
  }

  /*
   * C2 bridge boundary:
   * - scope is server-derived and mandatory.
   * - persistence uses only service-role RPC.
   * - counterparty source-document authorization remains a C3 hardening item.
   *   Until then, this endpoint is NOT claimed as final production authorization.
   */
  try {
    const gateway =
      new CounterpartyPayableSupabaseGatewayAdapter(
        supabaseServer as unknown as
          CounterpartyPayableSupabaseRpcClient
      );

    const result =
      await persistCounterpartyPayableMovement(
        {
          movement,
          audit: {
            actorUserId:
              String(user.id),
            action:
              "CREATE",
            recordedAt:
              new Date().toISOString(),
            source:
              "COUNTERPARTY_PAYABLE"
          }
        },
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
          movementId:
            result.movementId,
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
        movementId:
          result.movementId
      },
      result.outcome ===
        "CREATED"
        ? 201
        : 200
    );
  }
  catch {
    console.error(
      "[Counterparty Payable Persist API] Persistence failed."
    );

    return json(
      {
        success:
          false,
        error:
          "COUNTERPARTY_PAYABLE_PERSISTENCE_FAILED"
      },
      503
    );
  }
}