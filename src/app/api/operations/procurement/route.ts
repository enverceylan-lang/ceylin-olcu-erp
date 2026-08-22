import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createClient,
} from "@supabase/supabase-js";

import {
  verifyAuth,
} from "@/lib/authHelper";
import {
  readRequestedErpScopeId,
} from "@/lib/erpActiveScopeCookie";
import {
  loadShadowErpContext,
} from "@/lib/serverErpContext";
import {
  decideProcurementServerContract,
} from "@/lib/procurement/procurementServerContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function json(
  body: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function hashPayload(
  value: unknown,
): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export async function POST(
  request: NextRequest,
) {
  const user =
    await verifyAuth(request);

  if (!user) {
    return json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      401,
    );
  }

  if (
    String(user.role || "")
      .toUpperCase() !== "ADMIN"
  ) {
    return json(
      {
        success: false,
        error: "PROCUREMENT_ADMIN_REQUIRED",
      },
      403,
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
        success: false,
        error: "SERVER_CONFIGURATION_MISSING",
      },
      500,
    );
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const decision =
    decideProcurementServerContract(body);

  if (!decision.allowed) {
    return json(
      {
        success: false,
        error: decision.code,
      },
      decision.status,
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

  const context =
    await loadShadowErpContext(
      supabase,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(
            request,
          ),
      },
    );

  if (!context.ready) {
    return json(
      {
        success: false,
        error: "ERP_CONTEXT_NOT_READY",
        reason: context.reason,
      },
      context.reason === "READ_FAILED"
        ? 503
        : 409,
    );
  }

  const command = {
    ...decision.command,
    tenantId:
      context.scope.tenantId,
    companyId:
      context.scope.companyId,
    branchId:
      context.scope.branchId,
    accountingPeriodId:
      context.scope.accountingPeriodId,
  };

  const payloadHash =
    hashPayload(command);

  const rpcName =
    command.action === "CREATE_ORDER"
      ? "persist_supplier_order_batch_v1"
      : "persist_procurement_decision_v1";

  const {
    data,
    error,
  } =
    await supabase.rpc(
      rpcName,
      {
        p_command: command,
        p_actor_user_id:
          String(user.id),
        p_payload_hash:
          payloadHash,
      },
    );

  if (error) {
    console.error(
      "[Procurement API] Persistence failed.",
    );

    return json(
      {
        success: false,
        error:
          "PROCUREMENT_PERSISTENCE_FAILED",
      },
      503,
    );
  }

  const result =
    data &&
    typeof data === "object"
      ? data as Record<string, unknown>
      : {};

  const outcome =
    String(result.outcome || "");

  return json(
    {
      success:
        outcome === "CREATED" ||
        outcome === "REPLAY",
      ...result,
    },
    outcome === "CREATED"
      ? 201
      : outcome === "REPLAY"
        ? 200
        : 409,
  );
}

