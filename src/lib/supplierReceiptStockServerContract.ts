export type SupplierReceiptStockUnit =
  | "mt"
  | "m2"
  | "adet";

export interface SupplierReceiptStockCommand {
  action: "RECEIVE_SUPPLIER_ORDER";
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

export type SupplierReceiptStockContractDecision =
  | {
      allowed: true;
      command: SupplierReceiptStockCommand;
    }
  | {
      allowed: false;
      code: string;
      status: 400 | 403;
    };

function text(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function quantity(
  value: unknown
): number {
  return Number(value);
}

export function decideSupplierReceiptStockServerContract(
  body: unknown
): SupplierReceiptStockContractDecision {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      allowed: false,
      code: "SUPPLIER_RECEIPT_INVALID_JSON",
      status: 400
    };
  }

  const source =
    body as Record<string, unknown>;

  if (
    text(source.action).toUpperCase() !==
    "RECEIVE_SUPPLIER_ORDER"
  ) {
    return {
      allowed: false,
      code: "SUPPLIER_RECEIPT_ACTION_INVALID",
      status: 400
    };
  }

  const receivedUnit =
    text(source.receivedUnit) as
      SupplierReceiptStockUnit;

  const receivedQuantity =
    quantity(source.receivedQuantity);

  const receivedAt =
    text(source.receivedAt);

  if (
    !text(source.receiptId) ||
    !text(source.idempotencyKey) ||
    !text(source.supplierOrderId) ||
    !text(source.supplierOrderLineId) ||
    !text(source.allocationId) ||
    !text(source.stockItemId) ||
    !Number.isFinite(
      receivedQuantity
    ) ||
    receivedQuantity <= 0 ||
    (
      receivedUnit !== "mt" &&
      receivedUnit !== "m2" &&
      receivedUnit !== "adet"
    ) ||
    !receivedAt ||
    !Number.isFinite(
      Date.parse(receivedAt)
    )
  ) {
    return {
      allowed: false,
      code:
        "SUPPLIER_RECEIPT_REQUIRED_FIELDS_INVALID",
      status: 400
    };
  }

  return {
    allowed: true,
    command: {
      action:
        "RECEIVE_SUPPLIER_ORDER",
      receiptId:
        text(source.receiptId),
      idempotencyKey:
        text(source.idempotencyKey),
      supplierOrderId:
        text(source.supplierOrderId),
      supplierOrderLineId:
        text(source.supplierOrderLineId),
      allocationId:
        text(source.allocationId),
      stockItemId:
        text(source.stockItemId),
      receivedQuantity,
      receivedUnit,
      receivedAt
    }
  };
}