import type {
  CreatePurchaseDocumentRequest,
  CreatePurchaseDocumentResult,
  PurchaseDocument,
  PurchaseDocumentLine,
  PurchaseDocumentRejectionReason,
  PurchaseDocumentTotals,
  PurchasePricingStatus
} from "./purchaseContracts";
import { erpScopeMatches } from "./erpScope";

const MONEY_SCALE = 100;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

function isNonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function cleanNullableText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function hasScope(request: CreatePurchaseDocumentRequest): boolean {
  return (
    isNonEmpty(request.tenantId) &&
    isNonEmpty(request.companyId) &&
    isNonEmpty(request.branchId) &&
    isNonEmpty(request.accountingPeriodId)
  );
}

function reject(
  reason: PurchaseDocumentRejectionReason
): CreatePurchaseDocumentResult {
  return { outcome: "REJECTED", reason };
}

function pricingComplete(
  line: CreatePurchaseDocumentRequest["lines"][number]
): boolean {
  return (
    typeof line.unitPrice === "number" &&
    line.taxRate !== null &&
    line.taxRate !== undefined &&
    typeof line.taxIncluded === "boolean"
  );
}

function calculateLine(
  line: CreatePurchaseDocumentRequest["lines"][number]
): PurchaseDocumentLine {
  const quantity = roundMoney(line.quantity);
  const unitPrice =
    typeof line.unitPrice === "number"
      ? roundMoney(line.unitPrice)
      : null;
  const discountRate = roundMoney(line.discountRate ?? 0);
  const taxRate = line.taxRate ?? null;
  const taxIncluded =
    typeof line.taxIncluded === "boolean"
      ? line.taxIncluded
      : null;
  const receivedQuantity = roundMoney(line.receivedQuantity ?? 0);
  const linePricingStatus: PurchasePricingStatus =
    pricingComplete(line) ? "COMPLETE" : "INCOMPLETE";

  let netAmount = 0;
  let taxAmount = 0;
  let grossAmount = 0;

  if (
    linePricingStatus === "COMPLETE" &&
    unitPrice !== null &&
    taxRate !== null &&
    taxIncluded !== null
  ) {
    const enteredAmount = roundMoney(quantity * unitPrice);
    const discountedEnteredAmount = roundMoney(
      enteredAmount * (1 - discountRate / 100)
    );

    if (taxIncluded) {
      netAmount = roundMoney(
        discountedEnteredAmount / (1 + taxRate / 100)
      );
      grossAmount = discountedEnteredAmount;
      taxAmount = roundMoney(grossAmount - netAmount);
    } else {
      netAmount = discountedEnteredAmount;
      taxAmount = roundMoney(netAmount * taxRate / 100);
      grossAmount = roundMoney(netAmount + taxAmount);
    }
  }

  return {
    id: line.id.trim(),
    kind: line.kind,
    stockItemId: line.stockItemId?.trim() || undefined,
    stockCode: line.stockCode?.trim() || undefined,
    description: line.description.trim(),
    quantity,
    unit: line.unit,
    unitPrice,
    discountRate,
    taxRate,
    taxIncluded,
    pricingStatus: linePricingStatus,
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

  const totalsPricingStatus: PurchasePricingStatus =
    lines.every(line => line.pricingStatus === "COMPLETE")
      ? "COMPLETE"
      : "INCOMPLETE";

  for (const line of lines) {
    if (line.pricingStatus !== "COMPLETE" || line.unitPrice === null) {
      continue;
    }

    const lineSubtotal = roundMoney(line.quantity * line.unitPrice);
    const enteredAfterDiscount = line.taxIncluded
      ? line.grossAmount
      : line.netAmount;
    const lineDiscount = roundMoney(lineSubtotal - enteredAfterDiscount);
    const unitGross =
      line.quantity > 0 ? line.grossAmount / line.quantity : 0;

    subtotal += lineSubtotal;
    discountTotal += lineDiscount;
    netTotal += line.netAmount;
    taxTotal += line.taxAmount;
    grandTotal += line.grossAmount;
    receivedValue += roundMoney(line.receivedQuantity * unitGross);
  }

  const roundedGrandTotal = roundMoney(grandTotal);
  const roundedReceivedValue = roundMoney(receivedValue);

  return {
    pricingStatus: totalsPricingStatus,
    subtotal: roundMoney(subtotal),
    discountTotal: roundMoney(discountTotal),
    netTotal: roundMoney(netTotal),
    taxTotal: roundMoney(taxTotal),
    grandTotal: roundedGrandTotal,
    receivedValue: roundedReceivedValue,
    remainingValue: roundMoney(
      Math.max(0, roundedGrandTotal - roundedReceivedValue)
    )
  };
}

function isDocumentDraftComplete(
  request: CreatePurchaseDocumentRequest
): boolean {
  return (
    isNonEmpty(request.documentNo) &&
    isNonEmpty(request.documentDate) &&
    request.lines.every(pricingComplete)
  );
}

function samePayload(
  request: CreatePurchaseDocumentRequest,
  document: PurchaseDocument
): boolean {
  if (
    cleanNullableText(request.documentNo) !== document.documentNo ||
    request.supplierId.trim() !== document.supplierId ||
    cleanNullableText(request.supplierName) !== document.supplierName ||
    request.lines.length !== document.lines.length ||
    cleanNullableText(request.supplierReceiptId) !==
      (document.supplierReceiptId ?? null)
  ) {
    return false;
  }

  const calculatedLines = request.lines.map(calculateLine);

  return calculatedLines.every((line, index) => {
    const existing = document.lines[index];
    return (
      existing?.id === line.id &&
      existing.kind === line.kind &&
      existing.stockItemId === line.stockItemId &&
      existing.description === line.description &&
      existing.quantity === line.quantity &&
      existing.unit === line.unit &&
      existing.unitPrice === line.unitPrice &&
      existing.discountRate === line.discountRate &&
      existing.taxRate === line.taxRate &&
      existing.taxIncluded === line.taxIncluded
    );
  });
}

function validateRequest(
  request: CreatePurchaseDocumentRequest
): PurchaseDocumentRejectionReason | null {
  if (!hasScope(request)) return "SCOPE_REQUIRED";
  if (!isNonEmpty(request.id)) return "ID_REQUIRED";
  if (!isNonEmpty(request.idempotencyKey)) return "IDEMPOTENCY_KEY_REQUIRED";
  if (!isNonEmpty(request.supplierId)) return "SUPPLIER_REQUIRED";
  if (!isNonEmpty(request.createdByUserId)) return "ACTOR_REQUIRED";

  let documentDate: Date | null = null;

  if (isNonEmpty(request.documentDate)) {
    documentDate = new Date(request.documentDate as string);
    if (Number.isNaN(documentDate.getTime())) {
      return "INVALID_DOCUMENT_DATE";
    }
  }

  if (request.dueDate) {
    const dueDate = new Date(request.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return "INVALID_DUE_DATE";
    }
    if (documentDate && dueDate.getTime() < documentDate.getTime()) {
      return "DUE_DATE_BEFORE_DOCUMENT_DATE";
    }
  }

  if (request.lines.length === 0) return "LINE_REQUIRED";

  const validTaxRates = new Set<number>([0, 1, 10, 20]);

  for (const line of request.lines) {
    if (!isNonEmpty(line.id)) return "LINE_ID_REQUIRED";
    if (!isNonEmpty(line.description)) return "LINE_DESCRIPTION_REQUIRED";

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return "INVALID_QUANTITY";
    }

    if (
      line.unitPrice !== null &&
      line.unitPrice !== undefined &&
      (!Number.isFinite(line.unitPrice) || line.unitPrice < 0)
    ) {
      return "INVALID_UNIT_PRICE";
    }

    const discountRate = line.discountRate ?? 0;
    if (
      !Number.isFinite(discountRate) ||
      discountRate < 0 ||
      discountRate > 100
    ) {
      return "INVALID_DISCOUNT_RATE";
    }

    if (
      line.taxRate !== null &&
      line.taxRate !== undefined &&
      !validTaxRates.has(line.taxRate)
    ) {
      return "INVALID_TAX_RATE";
    }

    if (
      line.taxIncluded !== null &&
      line.taxIncluded !== undefined &&
      typeof line.taxIncluded !== "boolean"
    ) {
      return "INVALID_TAX_INCLUDED";
    }

    const receivedQuantity = line.receivedQuantity ?? 0;
    if (
      !Number.isFinite(receivedQuantity) ||
      receivedQuantity < 0 ||
      receivedQuantity > line.quantity
    ) {
      return "INVALID_RECEIVED_QUANTITY";
    }

    if (line.kind === "GOODS" && !isNonEmpty(line.stockItemId)) {
      return "STOCK_ITEM_REQUIRED_FOR_GOODS";
    }
  }

  return null;
}

export function decideCreatePurchaseDocument(
  request: CreatePurchaseDocumentRequest,
  existing: readonly PurchaseDocument[]
): CreatePurchaseDocumentResult {
  const validationError = validateRequest(request);
  if (validationError) return reject(validationError);

  const idempotentDocument = existing.find(
    document =>
      document.idempotencyKey === request.idempotencyKey &&
      erpScopeMatches(document, request)
  );

  if (idempotentDocument) {
    return samePayload(request, idempotentDocument)
      ? { outcome: "REPLAY", document: idempotentDocument }
      : reject("IDEMPOTENCY_CONFLICT");
  }

  const documentNo = cleanNullableText(request.documentNo);

  if (documentNo) {
    const duplicateDocumentNo = existing.find(
      document =>
        document.documentNo === documentNo &&
        document.status !== "CANCELLED" &&
        erpScopeMatches(document, request)
    );
    if (duplicateDocumentNo) return reject("DUPLICATE_DOCUMENT_NO");
  }

  const lines = request.lines.map(calculateLine);
  const documentDate = isNonEmpty(request.documentDate)
    ? new Date(request.documentDate as string).toISOString()
    : null;

  const document: PurchaseDocument = {
    tenantId: request.tenantId,
    companyId: request.companyId,
    branchId: request.branchId,
    accountingPeriodId: request.accountingPeriodId,
    id: request.id.trim(),
    idempotencyKey: request.idempotencyKey.trim(),
    documentNo,
    supplierId: request.supplierId.trim(),
    supplierName: cleanNullableText(request.supplierName),
    documentDate,
    dueDate: request.dueDate
      ? new Date(request.dueDate).toISOString()
      : undefined,
    currency: "TRY",
    status: isDocumentDraftComplete(request) ? "DRAFT" : "PENDING_INFO",
    lines,
    totals: calculatePurchaseTotals(lines),
    notes: request.notes?.trim() || undefined,
    sourceOperationId: request.sourceOperationId?.trim() || undefined,
    supplierOrderId: request.supplierOrderId?.trim() || undefined,
    supplierReceiptId: request.supplierReceiptId?.trim() || undefined,
    createdByUserId: request.createdByUserId.trim(),
    createdAt: request.now,
    updatedAt: request.now
  };

  return { outcome: "CREATED", document };
}
