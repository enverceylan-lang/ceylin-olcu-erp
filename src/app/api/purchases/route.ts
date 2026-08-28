import {
  NextRequest,
} from "next/server";

import {
  json,
  loadPurchaseServerAuthority,
} from "@/lib/purchaseApprovalRouteAuthority";

type PurchaseRow = {
  purchase_document_id: string;
  document_no: string;
  supplier_id: string;
  supplier_name: string | null;
  document_date: string;
  status: "DRAFT" | "APPROVED";
  grand_total: number | string;
  line_snapshot: unknown;
  draft_payload_hash: string;
  approved_at: string | null;
  payable_movement_id: string | null;
};

type ReturnLineRow = {
  purchase_return_id: string;
  purchase_document_id: string;
  purchase_document_line_id: string;
  quantity: number | string;
  gross_amount: number | string;
};

export async function GET(
  request: NextRequest,
) {
  const authority =
    await loadPurchaseServerAuthority(
      request,
    );

  if (!authority.ok) {
    return authority.response;
  }

  const {
    tenantId,
    companyId,
    branchId,
    accountingPeriodId,
  } = authority.context.scope;

  const purchases =
    await authority.client
      .from(
        "purchase_documents_authority_v1",
      )
      .select(
        [
          "purchase_document_id",
          "document_no",
          "supplier_id",
          "supplier_name",
          "document_date",
          "status",
          "grand_total",
          "line_snapshot",
          "draft_payload_hash",
          "approved_at",
          "payable_movement_id",
        ].join(","),
      )
      .eq(
        "tenant_id",
        tenantId,
      )
      .eq(
        "company_id",
        companyId,
      )
      .eq(
        "branch_id",
        branchId,
      )
      .eq(
        "accounting_period_id",
        accountingPeriodId,
      )
      .order(
        "document_date",
        {
          ascending: false,
        },
      );

  if (purchases.error) {
    return json(
      {
        success: false,
        error:
          "PURCHASE_LIST_READ_FAILED",
      },
      503,
    );
  }

  const returns =
    await authority.client
      .from(
        "purchase_return_lines_v1",
      )
      .select(
        [
          "purchase_return_id",
          "purchase_document_id",
          "purchase_document_line_id",
          "quantity",
          "gross_amount",
        ].join(","),
      )
      .eq(
        "tenant_id",
        tenantId,
      )
      .eq(
        "company_id",
        companyId,
      )
      .eq(
        "branch_id",
        branchId,
      )
      .eq(
        "accounting_period_id",
        accountingPeriodId,
      );

  if (returns.error) {
    return json(
      {
        success: false,
        error:
          "PURCHASE_RETURN_LIST_READ_FAILED",
      },
      503,
    );
  }

  const purchaseRows =
    (purchases.data || []) as
      unknown as PurchaseRow[];

  const returnRows =
    (returns.data || []) as
      unknown as ReturnLineRow[];

  return json(
    {
      success: true,
      result: {
        purchases:
          purchaseRows.map(
            row => ({
              purchaseDocumentId:
                row.purchase_document_id,
              documentNo:
                row.document_no,
              supplierId:
                row.supplier_id,
              supplierName:
                row.supplier_name,
              documentDate:
                row.document_date,
              status:
                row.status,
              grandTotal:
                Number(
                  row.grand_total,
                ),
              payloadHash:
                row.draft_payload_hash,
              approvedAt:
                row.approved_at,
              payableMovementId:
                row.payable_movement_id,
              lines:
                Array.isArray(
                  row.line_snapshot,
                )
                  ? row.line_snapshot
                  : [],
            }),
          ),
        returnLines:
          returnRows.map(
            row => ({
              purchaseReturnId:
                row.purchase_return_id,
              purchaseDocumentId:
                row.purchase_document_id,
              purchaseDocumentLineId:
                row.purchase_document_line_id,
              quantity:
                Number(
                  row.quantity,
                ),
              grossAmount:
                Number(
                  row.gross_amount,
                ),
            }),
          ),
      },
    },
    200,
  );
}
