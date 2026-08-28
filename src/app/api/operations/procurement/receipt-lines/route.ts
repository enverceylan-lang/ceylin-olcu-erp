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

export async function GET(
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
          "PROCUREMENT_ADMIN_REQUIRED"
      },
      403
    );
  }

  const saleId =
    String(
      request.nextUrl.searchParams
        .get("saleId") || ""
    ).trim();

  if (!saleId) {
    return json(
      {
        success: false,
        error:
          "PROCUREMENT_SALE_ID_REQUIRED"
      },
      400
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
        reason:
          context.reason
      },
      context.reason ===
        "READ_FAILED"
        ? 503
        : 409
    );
  }

  const scope =
    context.scope;

  const orderQuery =
    await supabase
      .from(
        "supplier_orders_v1"
      )
      .select(
        "supplier_order_id,idempotency_key,supplier_id,sale_id,status,created_by_user_id,created_at"
      )
      .eq(
        "tenant_id",
        scope.tenantId
      )
      .eq(
        "company_id",
        scope.companyId
      )
      .eq(
        "branch_id",
        scope.branchId
      )
      .eq(
        "accounting_period_id",
        scope.accountingPeriodId
      )
      .eq(
        "sale_id",
        saleId
      )
      .neq(
        "status",
        "CANCELLED"
      );

  if (orderQuery.error) {
    return json(
      {
        success: false,
        error:
          "PROCUREMENT_READ_FAILED"
      },
      503
    );
  }

  const orders:
    Record<string, unknown>[] =
    Array.isArray(
      orderQuery.data
    )
      ? orderQuery.data as
          Record<string, unknown>[]
      : [];

  const orderIds =
    orders
      .map(
        row =>
          String(
            row.supplier_order_id ||
              ""
          )
      )
      .filter(Boolean);

  if (
    orderIds.length === 0
  ) {
    return json(
      {
        success: true,
        lines: []
      },
      200
    );
  }

  const lineQuery =
    await supabase
      .from(
        "supplier_order_lines_v1"
      )
      .select(
        "supplier_order_line_id,supplier_order_id,sale_id,sale_item_id,stock_item_id,production_order_id,allocation_id,purpose,ordered_quantity,ordered_unit"
      )
      .eq(
        "tenant_id",
        scope.tenantId
      )
      .eq(
        "company_id",
        scope.companyId
      )
      .eq(
        "branch_id",
        scope.branchId
      )
      .eq(
        "accounting_period_id",
        scope.accountingPeriodId
      )
      .eq(
        "sale_id",
        saleId
      )
      .in(
        "supplier_order_id",
        orderIds
      );

  if (lineQuery.error) {
    return json(
      {
        success: false,
        error:
          "PROCUREMENT_LINE_READ_FAILED"
      },
      503
    );
  }

  const lines:
    Record<string, unknown>[] =
    Array.isArray(
      lineQuery.data
    )
      ? lineQuery.data as
          Record<string, unknown>[]
      : [];

  const lineIds =
    lines
      .map(
        row =>
          String(
            row.supplier_order_line_id ||
              ""
          )
      )
      .filter(Boolean);

  const receiptQuery =
    lineIds.length > 0
      ? await supabase
          .from(
            "supplier_receipts_v1"
          )
          .select(
            "supplier_order_line_id,received_quantity,status"
          )
          .eq(
            "tenant_id",
            scope.tenantId
          )
          .eq(
            "company_id",
            scope.companyId
          )
          .eq(
            "branch_id",
            scope.branchId
          )
          .eq(
            "accounting_period_id",
            scope.accountingPeriodId
          )
          .eq(
            "status",
            "POSTED"
          )
          .in(
            "supplier_order_line_id",
            lineIds
          )
      : {
          data: [],
          error: null
        };

  if (receiptQuery.error) {
    return json(
      {
        success: false,
        error:
          "PROCUREMENT_RECEIPT_READ_FAILED"
      },
      503
    );
  }

  const receivedByLine =
    new Map<
      string,
      number
    >();

  for (
    const row of
    Array.isArray(
      receiptQuery.data
    )
      ? receiptQuery.data as
          Record<string, unknown>[]
      : []
  ) {
    const lineId =
      String(
        row.supplier_order_line_id ||
          ""
      );
    const quantity =
      Number(
        row.received_quantity ||
          0
      );

    receivedByLine.set(
      lineId,
      (
        receivedByLine.get(
          lineId
        ) || 0
      ) +
        (
          Number.isFinite(
            quantity
          )
            ? quantity
            : 0
        )
    );
  }

  const ordersById =
    new Map(
      orders.map(
        row => [
          String(
            row.supplier_order_id ||
              ""
          ),
          row
        ]
      )
    );

  return json(
    {
      success: true,
      lines:
        lines.map(
          line => {
            const order =
              ordersById.get(
                String(
                  line.supplier_order_id ||
                    ""
                )
              );

            return {
              supplierOrderId:
                String(
                  line.supplier_order_id ||
                    ""
                ),
              supplierOrderLineId:
                String(
                  line.supplier_order_line_id ||
                    ""
                ),
              saleId:
                String(
                  line.sale_id ||
                    ""
                ),
              saleItemId:
                String(
                  line.sale_item_id ||
                    ""
                ),
              stockItemId:
                String(
                  line.stock_item_id ||
                    ""
                ),
              supplierId:
                String(
                  order?.supplier_id ||
                    ""
                ),
              productionOrderId:
                String(
                  line.production_order_id ||
                    ""
                ),
              allocationId:
                String(
                  line.allocation_id ||
                    ""
                ),
              purpose:
                String(
                  line.purpose ||
                    ""
                ),
              orderedQuantity:
                Number(
                  line.ordered_quantity ||
                    0
                ),
              orderedUnit:
                String(
                  line.ordered_unit ||
                    ""
                ),
              receivedQuantity:
                receivedByLine.get(
                  String(
                    line.supplier_order_line_id ||
                      ""
                  )
                ) || 0,
              idempotencyKey:
                String(
                  order?.idempotency_key ||
                    ""
                ),
              createdByUserId:
                String(
                  order?.created_by_user_id ||
                    ""
                ),
              createdAt:
                String(
                  order?.created_at ||
                    ""
                ),
              scope
            };
          }
        )
    },
    200
  );
}
