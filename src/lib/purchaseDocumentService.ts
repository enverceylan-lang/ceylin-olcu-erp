import type {
  CreatePurchaseDocumentRequest,
  CreatePurchaseDocumentResult,
  PurchaseDocument,
  PurchaseDocumentLine,
  PurchaseDocumentRejectionReason,
  PurchaseDocumentTotals,
  PurchaseTaxRate
} from "./purchaseContracts";
import {
  erpScopeMatches
} from "./erpScope";

const MONEY_SCALE = 100;

function roundMoney(
  value: number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
      MONEY_SCALE
    ) /
    MONEY_SCALE
  );
}

function isNonEmpty(
  value: string | undefined
): boolean {
  return Boolean(
    value?.trim()
  );
}

function hasScope(
  request: CreatePurchaseDocumentRequest
): boolean {
  return (
    isNonEmpty(request.tenantId) &&
    isNonEmpty(request.companyId) &&
    isNonEmpty(request.branchId) &&
    isNonEmpty(
      request.accountingPeriodId
    )
  );
}

function reject(
  reason: PurchaseDocumentRejectionReason
): CreatePurchaseDocumentResult {
  return {
    outcome: "REJECTED",
    reason
  };
}

function calculateLine(
  line:
    CreatePurchaseDocumentRequest["lines"][number]
): PurchaseDocumentLine {
  const quantity =
    roundMoney(line.quantity);

  const unitPrice =
    roundMoney(line.unitPrice);

  const discountRate =
    roundMoney(
      line.discountRate ?? 0
    );

  const taxRate =
    (line.taxRate ??
      20) as PurchaseTaxRate;

  const receivedQuantity =
    roundMoney(
      line.receivedQuantity ?? 0
    );

  const subtotal =
    roundMoney(
      quantity * unitPrice
    );

  const discountAmount =
    roundMoney(
      subtotal *
      discountRate /
      100
    );

  const netAmount =
    roundMoney(
      subtotal - discountAmount
    );

  const taxAmount =
    roundMoney(
      netAmount *
      taxRate /
      100
    );

  const grossAmount =
    roundMoney(
      netAmount + taxAmount
    );

  return {
    id: line.id.trim(),

    kind: line.kind,

    stockItemId:
      line.stockItemId?.trim() ||
      undefined,

    stockCode:
      line.stockCode?.trim() ||
      undefined,

    description:
      line.description.trim(),

    quantity,
    unit: line.unit,
    unitPrice,
    discountRate,
    taxRate,

    netAmount,
    taxAmount,
    grossAmount,

    receivedQuantity
  };
}

export function calculatePurchaseTotals(
  lines: readonly PurchaseDocumentLine[]
): PurchaseDocumentTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let netTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;
  let receivedValue = 0;

  for (const line of lines) {
    const lineSubtotal =
      roundMoney(
        line.quantity *
        line.unitPrice
      );

    const lineDiscount =
      roundMoney(
        lineSubtotal -
        line.netAmount
      );

    const unitGross =
      line.quantity > 0
        ? line.grossAmount /
          line.quantity
        : 0;

    subtotal += lineSubtotal;
    discountTotal += lineDiscount;
    netTotal += line.netAmount;
    taxTotal += line.taxAmount;
    grandTotal += line.grossAmount;

    receivedValue +=
      roundMoney(
        line.receivedQuantity *
        unitGross
      );
  }

  const roundedGrandTotal =
    roundMoney(grandTotal);

  const roundedReceivedValue =
    roundMoney(receivedValue);

  return {
    subtotal:
      roundMoney(subtotal),

    discountTotal:
      roundMoney(discountTotal),

    netTotal:
      roundMoney(netTotal),

    taxTotal:
      roundMoney(taxTotal),

    grandTotal:
      roundedGrandTotal,

    receivedValue:
      roundedReceivedValue,

    remainingValue:
      roundMoney(
        Math.max(
          0,
          roundedGrandTotal -
          roundedReceivedValue
        )
      )
  };
}

function samePayload(
  request: CreatePurchaseDocumentRequest,
  document: PurchaseDocument
): boolean {
  if (
    request.documentNo.trim() !==
      document.documentNo ||
    request.supplierId.trim() !==
      document.supplierId ||
    request.lines.length !==
      document.lines.length
  ) {
    return false;
  }

  const calculatedLines =
    request.lines.map(
      calculateLine
    );

  return calculatedLines.every(
    (line, index) => {
      const existing =
        document.lines[index];

      return (
        existing?.id === line.id &&
        existing.kind === line.kind &&
        existing.stockItemId ===
          line.stockItemId &&
        existing.description ===
          line.description &&
        existing.quantity ===
          line.quantity &&
        existing.unit === line.unit &&
        existing.unitPrice ===
          line.unitPrice &&
        existing.discountRate ===
          line.discountRate &&
        existing.taxRate ===
          line.taxRate
      );
    }
  );
}

function validateRequest(
  request: CreatePurchaseDocumentRequest
): PurchaseDocumentRejectionReason | null {
  if (!hasScope(request)) {
    return "SCOPE_REQUIRED";
  }

  if (!isNonEmpty(request.id)) {
    return "ID_REQUIRED";
  }

  if (!isNonEmpty(request.idempotencyKey)) {
    return "IDEMPOTENCY_KEY_REQUIRED";
  }

  if (!isNonEmpty(request.documentNo)) {
    return "DOCUMENT_NO_REQUIRED";
  }

  if (
    !isNonEmpty(request.supplierId) ||
    !isNonEmpty(request.supplierName)
  ) {
    return "SUPPLIER_REQUIRED";
  }

  if (!isNonEmpty(request.createdByUserId)) {
    return "ACTOR_REQUIRED";
  }

  const documentDate =
    new Date(request.documentDate);

  if (
    Number.isNaN(
      documentDate.getTime()
    )
  ) {
    return "INVALID_DOCUMENT_DATE";
  }

  if (request.dueDate) {
    const dueDate =
      new Date(request.dueDate);

    if (
      Number.isNaN(
        dueDate.getTime()
      )
    ) {
      return "INVALID_DUE_DATE";
    }

    if (
      dueDate.getTime() <
      documentDate.getTime()
    ) {
      return "DUE_DATE_BEFORE_DOCUMENT_DATE";
    }
  }

  if (request.lines.length === 0) {
    return "LINE_REQUIRED";
  }

  const validTaxRates =
    new Set<number>([
      0,
      1,
      10,
      20
    ]);

  for (const line of request.lines) {
    if (!isNonEmpty(line.id)) {
      return "LINE_ID_REQUIRED";
    }

    if (!isNonEmpty(line.description)) {
      return "LINE_DESCRIPTION_REQUIRED";
    }

    if (
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0
    ) {
      return "INVALID_QUANTITY";
    }

    if (
      !Number.isFinite(line.unitPrice) ||
      line.unitPrice < 0
    ) {
      return "INVALID_UNIT_PRICE";
    }

    const discountRate =
      line.discountRate ?? 0;

    if (
      !Number.isFinite(discountRate) ||
      discountRate < 0 ||
      discountRate > 100
    ) {
      return "INVALID_DISCOUNT_RATE";
    }

    const taxRate =
      line.taxRate ?? 20;

    if (!validTaxRates.has(taxRate)) {
      return "INVALID_TAX_RATE";
    }

    const receivedQuantity =
      line.receivedQuantity ?? 0;

    if (
      !Number.isFinite(
        receivedQuantity
      ) ||
      receivedQuantity < 0 ||
      receivedQuantity >
        line.quantity
    ) {
      return "INVALID_RECEIVED_QUANTITY";
    }

    if (
      line.kind === "GOODS" &&
      !isNonEmpty(line.stockItemId)
    ) {
      return "STOCK_ITEM_REQUIRED_FOR_GOODS";
    }
  }

  return null;
}

export function decideCreatePurchaseDocument(
  request: CreatePurchaseDocumentRequest,
  existing:
    readonly PurchaseDocument[]
): CreatePurchaseDocumentResult {
  const validationError =
    validateRequest(request);

  if (validationError) {
    return reject(
      validationError
    );
  }

  const idempotentDocument =
    existing.find(
      document =>
        document.idempotencyKey ===
          request.idempotencyKey &&
        erpScopeMatches(
          document,
          request
        )
    );

  if (idempotentDocument) {
    if (
      samePayload(
        request,
        idempotentDocument
      )
    ) {
      return {
        outcome: "REPLAY",
        document:
          idempotentDocument
      };
    }

    return reject(
      "IDEMPOTENCY_CONFLICT"
    );
  }

  const duplicateDocumentNo =
    existing.find(
      document =>
        document.documentNo ===
          request.documentNo.trim() &&
        document.status !==
          "CANCELLED" &&
        erpScopeMatches(
          document,
          request
        )
    );

  if (duplicateDocumentNo) {
    return reject(
      "DUPLICATE_DOCUMENT_NO"
    );
  }

  const lines =
    request.lines.map(
      calculateLine
    );

  const document: PurchaseDocument = {
    tenantId:
      request.tenantId,

    companyId:
      request.companyId,

    branchId:
      request.branchId,

    accountingPeriodId:
      request.accountingPeriodId,

    id:
      request.id.trim(),

    idempotencyKey:
      request.idempotencyKey.trim(),

    documentNo:
      request.documentNo.trim(),

    supplierId:
      request.supplierId.trim(),

    supplierName:
      request.supplierName.trim(),

    documentDate:
      new Date(
        request.documentDate
      ).toISOString(),

    dueDate:
      request.dueDate
        ? new Date(
            request.dueDate
          ).toISOString()
        : undefined,

    currency: "TRY",

    status: "DRAFT",

    lines,

    totals:
      calculatePurchaseTotals(
        lines
      ),

    notes:
      request.notes?.trim() ||
      undefined,

    sourceOperationId:
      request.sourceOperationId?.trim() ||
      undefined,

    supplierOrderId:
      request.supplierOrderId?.trim() ||
      undefined,

    createdByUserId:
      request.createdByUserId.trim(),

    createdAt:
      request.now,

    updatedAt:
      request.now
  };

  return {
    outcome: "CREATED",
    document
  };
}