import type {
  SupplierReceiptStockUnit
} from "@/lib/supplierReceiptStockServerContract";

export type PersistSupplierReceiptStockAuthorityResult =
  | {
      ok: true;
      outcome:
        | "CREATED"
        | "REPLAY";
      receiptId: string;
      supplierOrderStatus: string;
      cumulativeReceivedQuantity: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function persistSupplierReceiptStockAuthority(
  input: {
    receiptId: string;
    idempotencyKey: string;
    supplierOrderId: string;
    supplierOrderLineId: string;
    allocationId: string;
    stockItemId: string;
    receivedQuantity: number;
    receivedUnit: SupplierReceiptStockUnit;
    receivedAt: string;
  }
): Promise<PersistSupplierReceiptStockAuthorityResult> {
  try {
    const response =
      await fetch(
        "/api/operations/supplier-receipts",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            action:
              "RECEIVE_SUPPLIER_ORDER",
            ...input
          })
        }
      );

    const payload =
      await response
        .json()
        .catch(() => null) as
          | Record<string, unknown>
          | null;

    if (
      !response.ok ||
      !payload ||
      payload.success !== true
    ) {
      return {
        ok: false,
        error:
          payload &&
          typeof payload.error ===
            "string"
            ? payload.error
            : "SUPPLIER_RECEIPT_AUTHORITY_FAILED"
      };
    }

    const outcome =
      String(
        payload.outcome || ""
      );

    if (
      outcome !== "CREATED" &&
      outcome !== "REPLAY"
    ) {
      return {
        ok: false,
        error:
          "SUPPLIER_RECEIPT_AUTHORITY_RESULT_INVALID"
      };
    }

    return {
      ok: true,
      outcome,
      receiptId:
        String(
          payload.receiptId || ""
        ),
      supplierOrderStatus:
        String(
          payload.supplierOrderStatus ||
            ""
        ),
      cumulativeReceivedQuantity:
        Number(
          payload
            .cumulativeReceivedQuantity ||
            0
        )
    };
  }
  catch {
    return {
      ok: false,
      error:
        "SUPPLIER_RECEIPT_AUTHORITY_UNREACHABLE"
    };
  }
}