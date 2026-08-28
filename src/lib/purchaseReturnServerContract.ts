import type {
  ErpScope,
} from "./erpScope";

export interface PurchaseReturnLineRequest {
  purchaseDocumentLineId: string;
  quantity: number;
}

export interface PurchaseReturnRequest
extends ErpScope {
  purchaseReturnId: string;
  purchaseDocumentId: string;
  idempotencyKey: string;
  returnedAt: string;
  reason: string;
  lines: PurchaseReturnLineRequest[];
}

function text(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function assertScope(
  input: ErpScope,
): void {
  for (const key of [
    "tenantId",
    "companyId",
    "branchId",
    "accountingPeriodId",
  ] as const) {
    if (!text(input[key])) {
      throw new Error(
        "PURCHASE_RETURN_SCOPE_REQUIRED",
      );
    }
  }
}

export function assertPurchaseReturnRequest(
  input: PurchaseReturnRequest,
  expectedScope: ErpScope,
): void {
  assertScope(input);

  for (const key of [
    "tenantId",
    "companyId",
    "branchId",
    "accountingPeriodId",
  ] as const) {
    if (
      text(input[key]) !==
      text(expectedScope[key])
    ) {
      throw new Error(
        "PURCHASE_RETURN_SCOPE_MISMATCH",
      );
    }
  }

  if (!text(input.purchaseReturnId)) {
    throw new Error(
      "PURCHASE_RETURN_ID_REQUIRED",
    );
  }

  if (!text(input.purchaseDocumentId)) {
    throw new Error(
      "PURCHASE_RETURN_DOCUMENT_REQUIRED",
    );
  }

  if (!text(input.idempotencyKey)) {
    throw new Error(
      "PURCHASE_RETURN_IDEMPOTENCY_REQUIRED",
    );
  }

  if (!text(input.reason)) {
    throw new Error(
      "PURCHASE_RETURN_REASON_REQUIRED",
    );
  }

  if (
    !text(input.returnedAt) ||
    Number.isNaN(
      new Date(
        input.returnedAt,
      ).getTime(),
    )
  ) {
    throw new Error(
      "PURCHASE_RETURN_DATE_INVALID",
    );
  }

  if (
    !Array.isArray(input.lines) ||
    input.lines.length === 0
  ) {
    throw new Error(
      "PURCHASE_RETURN_LINE_REQUIRED",
    );
  }

  const ids = new Set<string>();

  for (const line of input.lines) {
    const lineId =
      text(
        line.purchaseDocumentLineId,
      );

    if (!lineId) {
      throw new Error(
        "PURCHASE_RETURN_LINE_ID_REQUIRED",
      );
    }

    if (ids.has(lineId)) {
      throw new Error(
        "PURCHASE_RETURN_DUPLICATE_LINE",
      );
    }

    ids.add(lineId);

    if (
      !Number.isFinite(
        line.quantity,
      ) ||
      line.quantity <= 0
    ) {
      throw new Error(
        "PURCHASE_RETURN_QUANTITY_INVALID",
      );
    }
  }
}
