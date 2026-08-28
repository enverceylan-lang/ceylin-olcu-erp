import { createHash } from "node:crypto";

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
  decideSupplierReceiptStockServerContract
} from "@/lib/supplierReceiptStockServerContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0"
} as const;

function json(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: NO_STORE_HEADERS
    }
  );
}

function hashStablePayload(
  value: {
    action: string;
    receiptId: string;
    idempotencyKey: string;
    supplierOrderId: string;
    supplierOrderLineId: string;
    allocationId: string;
    stockItemId: string;
    receivedQuantity: number;
    receivedUnit: string;
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(value)
    )
    .digest("hex");
}

export async function POST(
  request: NextRequest
) {
  const user =
    await verifyAuth(request);

  if (!user) {
    return json(
      {
        success: false,
        error: "UNAUTHORIZED"
      },
      401
    );
  }

  if (
    String(user.role || "")
      .toUpperCase() !== "ADMIN"
  ) {
    return json(
      {
        success: false,
        error:
          "SUPPLIER_RECEIPT_ADMIN_REQUIRED"
      },
      403
    );
  }

  const body =
    await request
      .json()
      .catch(() => null);

  const decision =
    decideSupplierReceiptStockServerContract(
      body
    );

  if (!decision.allowed) {
    return json(
      {
        success: false,
        error: decision.code
      },
      decision.status
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return json(
      {
        success: false,
        error:
          "SERVER_CONFIGURATION_MISSING"
      },
      500
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

  const context =
    await loadShadowErpContext(
      supabase,
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
        success: false,
        error:
          "ERP_CONTEXT_NOT_READY",
        reason: context.reason
      },
      context.reason ===
        "READ_FAILED"
        ? 503
        : 409
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
      context.scope
        .accountingPeriodId
  };

  const payloadHash =
    hashStablePayload({
      action: command.action,
      receiptId:
        command.receiptId,
      idempotencyKey:
        command.idempotencyKey,
      supplierOrderId:
        command.supplierOrderId,
      supplierOrderLineId:
        command.supplierOrderLineId,
      allocationId:
        command.allocationId,
      stockItemId:
        command.stockItemId,
      receivedQuantity:
        command.receivedQuantity,
      receivedUnit:
        command.receivedUnit,
      tenantId:
        command.tenantId,
      companyId:
        command.companyId,
      branchId:
        command.branchId,
      accountingPeriodId:
        command.accountingPeriodId
    });

  const {
    data,
    error
  } =
    await supabase.rpc(
      "persist_supplier_receipt_stock_v1",
      {
        p_command: command,
        p_actor_user_id:
          String(user.id),
        p_payload_hash:
          payloadHash
      }
    );

  if (error) {
    console.error(
      "[Supplier Receipt API] Persistence failed."
    );

    return json(
      {
        success: false,
        error:
          "SUPPLIER_RECEIPT_PERSISTENCE_FAILED"
      },
      503
    );
  }

  const result =
    data &&
    typeof data === "object"
      ? data as
          Record<string, unknown>
      : {};

  const outcome =
    String(
      result.outcome || ""
    );

  return json(
    {
      success:
        outcome === "CREATED" ||
        outcome === "REPLAY",
      ...result
    },
    outcome === "CREATED"
      ? 201
      : outcome === "REPLAY"
        ? 200
        : 409
  );
}