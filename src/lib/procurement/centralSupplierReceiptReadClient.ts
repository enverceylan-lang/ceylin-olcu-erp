import type {
  CentralProcurementLine
} from "@/lib/procurement/procurementOrderRehydration";

export type CentralSupplierReceiptReadResult =
  | {
      ok: true;
      lines: CentralProcurementLine[];
    }
  | {
      ok: false;
      error: string;
    };

export async function readCentralSupplierReceiptLines(
  saleId: string
): Promise<CentralSupplierReceiptReadResult> {
  const normalizedSaleId =
    saleId.trim();

  if (!normalizedSaleId) {
    return {
      ok: false,
      error: "PROCUREMENT_SALE_ID_REQUIRED"
    };
  }

  try {
    const response =
      await fetch(
        `/api/operations/procurement/receipt-lines?saleId=${encodeURIComponent(normalizedSaleId)}`,
        {
          method: "GET",
          headers: {
            "Cache-Control": "no-store"
          }
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
      payload.success !== true ||
      !Array.isArray(payload.lines)
    ) {
      return {
        ok: false,
        error:
          payload &&
          typeof payload.error ===
            "string"
            ? payload.error
            : "PROCUREMENT_READ_FAILED"
      };
    }

    return {
      ok: true,
      lines:
        payload.lines as
          CentralProcurementLine[]
    };
  }
  catch {
    return {
      ok: false,
      error:
        "PROCUREMENT_READ_UNREACHABLE"
    };
  }
}
