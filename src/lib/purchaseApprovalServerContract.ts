import { createHash } from "node:crypto";

import type { ErpScope } from "./erpScope";
import type {
  PurchaseQuantityUnit,
  PurchaseTaxRate,
} from "./purchaseContracts";

export interface PurchaseDraftLineInput {
  id: string;
  kind: "GOODS" | "SERVICE";
  stockItemId?: string;
  stockCode?: string;
  description: string;
  quantity: number;
  unit: PurchaseQuantityUnit;
  unitPrice: number;
  discountRate?: number;
  taxRate: PurchaseTaxRate;
  taxIncluded: boolean;
}

export interface PurchaseDraftPersistRequest
extends ErpScope {
  purchaseDocumentId: string;
  documentNo: string;
  supplierId: string;
  supplierName?: string | null;
  documentDate: string;
  dueDate?: string | null;
  currency: "TRY";
  status: "DRAFT";
  lines: PurchaseDraftLineInput[];
  notes?: string | null;
}

export interface PurchaseApprovalRequest
extends ErpScope {
  purchaseDocumentId: string;
  approvalIdempotencyKey: string;
  expectedDraftPayloadHash: string;
}

export interface PurchaseCanonicalLine {
  id: string;
  kind: "GOODS" | "SERVICE";
  stockItemId: string | null;
  stockCode: string | null;
  description: string;
  quantity: number;
  unit: PurchaseQuantityUnit;
  unitPrice: number;
  discountRate: number;
  taxRate: PurchaseTaxRate;
  taxIncluded: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface PurchasePrice1Update {
  stockItemId: string;
  purchasePrice1: number;
  purchaseDocumentLineId: string;
}

export interface PurchaseCanonicalDraft
extends ErpScope {
  purchaseDocumentId: string;
  documentNo: string;
  supplierId: string;
  supplierName: string | null;
  documentDate: string;
  dueDate: string | null;
  currency: "TRY";
  status: "DRAFT";
  lines: PurchaseCanonicalLine[];
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  taxTotal: number;
  grandTotal: number;
  price1Updates: PurchasePrice1Update[];
  notes: string | null;
}

const MONEY_SCALE = 100;

function money(value: number): number {
  return Math.round(
    (value + Number.EPSILON) *
      MONEY_SCALE,
  ) / MONEY_SCALE;
}

function normalizedText(
  value: string | null | undefined,
): string {
  return String(value ?? "").trim();
}

function requiredText(
  value: string | null | undefined,
  code: string,
): string {
  const result = normalizedText(value);
  if (!result) {
    throw new Error(code);
  }
  return result;
}

function validIso(
  value: string,
  code: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(code);
  }
  return date.toISOString();
}

function assertScope(
  input: ErpScope,
): void {
  if (
    !normalizedText(input.tenantId) ||
    !normalizedText(input.companyId) ||
    !normalizedText(input.branchId) ||
    !normalizedText(
      input.accountingPeriodId,
    )
  ) {
    throw new Error(
      "PURCHASE_DRAFT_SCOPE_REQUIRED",
    );
  }
}

function calculateLine(
  line: PurchaseDraftLineInput,
): PurchaseCanonicalLine {
  const id = requiredText(
    line.id,
    "PURCHASE_DRAFT_LINE_ID_REQUIRED",
  );
  const description = requiredText(
    line.description,
    "PURCHASE_DRAFT_LINE_DESCRIPTION_REQUIRED",
  );

  if (
    !Number.isFinite(line.quantity) ||
    line.quantity <= 0
  ) {
    throw new Error(
      "PURCHASE_DRAFT_QUANTITY_INVALID",
    );
  }

  if (
    !Number.isFinite(line.unitPrice) ||
    line.unitPrice < 0
  ) {
    throw new Error(
      "PURCHASE_DRAFT_UNIT_PRICE_INVALID",
    );
  }

  const discountRate =
    line.discountRate ?? 0;

  if (
    !Number.isFinite(discountRate) ||
    discountRate < 0 ||
    discountRate > 100
  ) {
    throw new Error(
      "PURCHASE_DRAFT_DISCOUNT_INVALID",
    );
  }

  if (
    ![0, 1, 10, 20].includes(
      line.taxRate,
    )
  ) {
    throw new Error(
      "PURCHASE_DRAFT_TAX_RATE_INVALID",
    );
  }

  if (
    typeof line.taxIncluded !==
    "boolean"
  ) {
    throw new Error(
      "PURCHASE_DRAFT_TAX_INCLUDED_REQUIRED",
    );
  }

  const stockItemId =
    normalizedText(
      line.stockItemId,
    ) || null;

  if (
    line.kind === "GOODS" &&
    !stockItemId
  ) {
    throw new Error(
      "PURCHASE_DRAFT_GOODS_STOCK_ITEM_REQUIRED",
    );
  }

  const quantity = money(
    line.quantity,
  );
  const unitPrice = money(
    line.unitPrice,
  );
  const discount = money(
    discountRate,
  );
  const enteredAmount = money(
    quantity * unitPrice,
  );
  const discountedEntered =
    money(
      enteredAmount *
        (1 - discount / 100),
    );

  let netAmount: number;
  let taxAmount: number;
  let grossAmount: number;

  if (line.taxIncluded) {
    grossAmount =
      discountedEntered;
    netAmount = money(
      grossAmount /
        (1 + line.taxRate / 100),
    );
    taxAmount = money(
      grossAmount - netAmount,
    );
  } else {
    netAmount =
      discountedEntered;
    taxAmount = money(
      netAmount *
        line.taxRate / 100,
    );
    grossAmount = money(
      netAmount + taxAmount,
    );
  }

  return {
    id,
    kind: line.kind,
    stockItemId,
    stockCode:
      normalizedText(
        line.stockCode,
      ) || null,
    description,
    quantity,
    unit: line.unit,
    unitPrice,
    discountRate: discount,
    taxRate: line.taxRate,
    taxIncluded: line.taxIncluded,
    netAmount,
    taxAmount,
    grossAmount,
  };
}

function buildPrice1Updates(
  lines: readonly PurchaseCanonicalLine[],
): PurchasePrice1Update[] {
  const byStock =
    new Map<
      string,
      PurchasePrice1Update
    >();

  for (const line of lines) {
    if (!line.stockItemId) {
      continue;
    }

    const existing =
      byStock.get(
        line.stockItemId,
      );

    if (
      existing &&
      existing.purchasePrice1 !==
        line.unitPrice
    ) {
      throw new Error(
        "PURCHASE_DRAFT_DUPLICATE_STOCK_PRICE_CONFLICT",
      );
    }

    if (!existing) {
      byStock.set(
        line.stockItemId,
        {
          stockItemId:
            line.stockItemId,
          purchasePrice1:
            line.unitPrice,
          purchaseDocumentLineId:
            line.id,
        },
      );
    }
  }

  return [
    ...byStock.values(),
  ];
}

export function buildPurchaseCanonicalDraft(
  request: PurchaseDraftPersistRequest,
): PurchaseCanonicalDraft {
  assertScope(request);

  if (request.status !== "DRAFT") {
    throw new Error(
      "PURCHASE_DRAFT_STATUS_REQUIRED",
    );
  }

  const purchaseDocumentId =
    requiredText(
      request.purchaseDocumentId,
      "PURCHASE_DRAFT_DOCUMENT_ID_REQUIRED",
    );
  const documentNo =
    requiredText(
      request.documentNo,
      "PURCHASE_DRAFT_DOCUMENT_NO_REQUIRED",
    );
  const supplierId =
    requiredText(
      request.supplierId,
      "PURCHASE_DRAFT_SUPPLIER_REQUIRED",
    );
  const documentDate =
    validIso(
      requiredText(
        request.documentDate,
        "PURCHASE_DRAFT_DOCUMENT_DATE_REQUIRED",
      ),
      "PURCHASE_DRAFT_DOCUMENT_DATE_INVALID",
    );

  const dueDate =
    normalizedText(
      request.dueDate,
    )
      ? validIso(
          normalizedText(
            request.dueDate,
          ),
          "PURCHASE_DRAFT_DUE_DATE_INVALID",
        )
      : null;

  if (
    dueDate &&
    new Date(dueDate).getTime() <
      new Date(
        documentDate,
      ).getTime()
  ) {
    throw new Error(
      "PURCHASE_DRAFT_DUE_BEFORE_DOCUMENT",
    );
  }

  if (request.currency !== "TRY") {
    throw new Error(
      "PURCHASE_DRAFT_CURRENCY_INVALID",
    );
  }

  if (
    !Array.isArray(request.lines) ||
    request.lines.length === 0
  ) {
    throw new Error(
      "PURCHASE_DRAFT_LINE_REQUIRED",
    );
  }

  const lines =
    request.lines.map(
      calculateLine,
    );

  if (
    new Set(
      lines.map(
        line => line.id,
      ),
    ).size !== lines.length
  ) {
    throw new Error(
      "PURCHASE_DRAFT_DUPLICATE_LINE_ID",
    );
  }

  const subtotal = money(
    lines.reduce(
      (sum, line) =>
        sum +
        line.quantity *
          line.unitPrice,
      0,
    ),
  );
  const netTotal = money(
    lines.reduce(
      (sum, line) =>
        sum + line.netAmount,
      0,
    ),
  );
  const taxTotal = money(
    lines.reduce(
      (sum, line) =>
        sum + line.taxAmount,
      0,
    ),
  );
  const grandTotal = money(
    lines.reduce(
      (sum, line) =>
        sum + line.grossAmount,
      0,
    ),
  );
  const discountedInputTotal =
    money(
      lines.reduce(
        (sum, line) =>
          sum +
          (
            line.taxIncluded
              ? line.grossAmount
              : line.netAmount
          ),
        0,
      ),
    );
  const discountTotal = money(
    subtotal -
      discountedInputTotal,
  );

  if (grandTotal <= 0) {
    throw new Error(
      "PURCHASE_DRAFT_TOTAL_INVALID",
    );
  }

  return {
    tenantId:
      normalizedText(
        request.tenantId,
      ),
    companyId:
      normalizedText(
        request.companyId,
      ),
    branchId:
      normalizedText(
        request.branchId,
      ),
    accountingPeriodId:
      normalizedText(
        request.accountingPeriodId,
      ),
    purchaseDocumentId,
    documentNo,
    supplierId,
    supplierName:
      normalizedText(
        request.supplierName,
      ) || null,
    documentDate,
    dueDate,
    currency: "TRY",
    status: "DRAFT",
    lines,
    subtotal,
    discountTotal,
    netTotal,
    taxTotal,
    grandTotal,
    price1Updates:
      buildPrice1Updates(
        lines,
      ),
    notes:
      normalizedText(
        request.notes,
      ) || null,
  };
}

function stableValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      stableValue,
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    return Object.keys(
      record,
    )
      .sort()
      .reduce<
        Record<string, unknown>
      >(
        (result, key) => {
          result[key] =
            stableValue(
              record[key],
            );
          return result;
        },
        {},
      );
  }

  return value;
}

export function hashPurchaseCanonicalDraft(
  draft: PurchaseCanonicalDraft,
): string {
  return createHash(
    "sha256",
  )
    .update(
      JSON.stringify(
        stableValue(
          draft,
        ),
      ),
    )
    .digest("hex");
}

export function assertPurchaseApprovalRequest(
  request: PurchaseApprovalRequest,
  expectedScope: ErpScope,
): void {
  assertScope(request);

  for (const key of [
    "tenantId",
    "companyId",
    "branchId",
    "accountingPeriodId",
  ] as const) {
    if (
      normalizedText(
        request[key],
      ) !==
      normalizedText(
        expectedScope[key],
      )
    ) {
      throw new Error(
        "PURCHASE_APPROVAL_SCOPE_MISMATCH",
      );
    }
  }

  requiredText(
    request.purchaseDocumentId,
    "PURCHASE_APPROVAL_DOCUMENT_ID_REQUIRED",
  );
  requiredText(
    request.approvalIdempotencyKey,
    "PURCHASE_APPROVAL_IDEMPOTENCY_KEY_REQUIRED",
  );

  if (
    !/^[a-f0-9]{64}$/i.test(
      normalizedText(
        request.expectedDraftPayloadHash,
      ),
    )
  ) {
    throw new Error(
      "PURCHASE_APPROVAL_DRAFT_HASH_INVALID",
    );
  }
}
