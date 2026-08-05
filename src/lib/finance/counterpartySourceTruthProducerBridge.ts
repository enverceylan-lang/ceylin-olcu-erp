import type {
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "./counterpartySourceTruthPersistenceGateway";

export type SupplierPurchaseVatRate =
  | 0
  | 1
  | 10
  | 20;

export interface SupplierReceiptProducerSnapshot {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  supplierCustomerId: string;
  supplierOrderId: string;
  receiptId: string;
  sourceDocumentId: string;
  stockItemId: string;

  receivedQuantity: number;
  actualPurchaseUnitPrice: number;
  purchaseVatRate:
    SupplierPurchaseVatRate;

  receivedAt: string;
  recordedAt: string;
}

export interface ProviderEarningProducerSnapshot {
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;

  providerCustomerId: string;
  providerType:
    | "TAILOR"
    | "INSTALLER";

  assignmentType:
    | "EXTERNAL"
    | "INTERNAL";

  operationId: string;
  earningsEntryId: string;
  sourceDocumentId?: string;

  finalizedAmount: number;
  currency: "TRY";

  occurredAt: string;
  finalizedAt: string;
  recordedAt: string;
}

export type SourceTruthProjectionResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      reason:
        | "INVALID_SCOPE"
        | "INVALID_IDENTITY"
        | "INVALID_AMOUNT"
        | "INVALID_DATE"
        | "INTERNAL_PROVIDER";
    };

function hasText(
  value: string
): boolean {
  return Boolean(
    value.trim()
  );
}

function validIsoDate(
  value: string
): boolean {
  if (!hasText(value)) {
    return false;
  }

  return Number.isFinite(
    Date.parse(value)
  );
}

function roundMoney(
  value: number
): number {
  return Number(
    value.toFixed(2)
  );
}

function validScope(
  input: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): boolean {
  return (
    hasText(input.tenantId) &&
    hasText(input.companyId) &&
    hasText(input.branchId) &&
    hasText(
      input.accountingPeriodId
    )
  );
}

export function projectSupplierReceiptSourceTruth(
  input:
    SupplierReceiptProducerSnapshot
): SourceTruthProjectionResult<
  SupplierReceiptSourceTruth
> {
  if (!validScope(input)) {
    return {
      ok: false,
      reason:
        "INVALID_SCOPE"
    };
  }

  if (
    !hasText(
      input.supplierCustomerId
    ) ||
    !hasText(
      input.supplierOrderId
    ) ||
    !hasText(
      input.receiptId
    ) ||
    !hasText(
      input.stockItemId
    )
  ) {
    return {
      ok: false,
      reason:
        "INVALID_IDENTITY"
    };
  }

  if (
    !Number.isFinite(
      input.receivedQuantity
    ) ||
    input.receivedQuantity <= 0 ||
    !Number.isFinite(
      input.actualPurchaseUnitPrice
    ) ||
    input.actualPurchaseUnitPrice <= 0
  ) {
    return {
      ok: false,
      reason:
        "INVALID_AMOUNT"
    };
  }

  if (
    !validIsoDate(
      input.receivedAt
    ) ||
    !validIsoDate(
      input.recordedAt
    )
  ) {
    return {
      ok: false,
      reason:
        "INVALID_DATE"
    };
  }

  const netAmount =
    roundMoney(
      input.receivedQuantity *
      input.actualPurchaseUnitPrice
    );

  const payableAmount =
    roundMoney(
      netAmount *
      (
        1 +
        input.purchaseVatRate / 100
      )
    );

  return {
    ok: true,
    value: {
      sourceId:
        `supplier-receipt-source:${input.receiptId}`,

      tenantId:
        input.tenantId,
      companyId:
        input.companyId,
      branchId:
        input.branchId,
      accountingPeriodId:
        input.accountingPeriodId,

      supplierCustomerId:
        input.supplierCustomerId,
      supplierOrderId:
        input.supplierOrderId,
      receiptId:
        input.receiptId,
      sourceDocumentId:
        input.sourceDocumentId,
      stockItemId:
        input.stockItemId,

      receivedQuantity:
        input.receivedQuantity,
      actualPurchaseUnitPrice:
        input.actualPurchaseUnitPrice,
      purchaseVatRate:
        input.purchaseVatRate,

      netAmount,
      payableAmount,

      currency:
        "TRY",

      receivedAt:
        input.receivedAt,
      recordedAt:
        input.recordedAt
    }
  };
}

export function projectProviderEarningSourceTruth(
  input:
    ProviderEarningProducerSnapshot
): SourceTruthProjectionResult<
  ProviderEarningSourceTruth
> {
  if (
    input.assignmentType ===
    "INTERNAL"
  ) {
    return {
      ok: false,
      reason:
        "INTERNAL_PROVIDER"
    };
  }

  if (!validScope(input)) {
    return {
      ok: false,
      reason:
        "INVALID_SCOPE"
    };
  }

  if (
    !hasText(
      input.providerCustomerId
    ) ||
    !hasText(
      input.operationId
    ) ||
    !hasText(
      input.earningsEntryId
    )
  ) {
    return {
      ok: false,
      reason:
        "INVALID_IDENTITY"
    };
  }

  if (
    !Number.isFinite(
      input.finalizedAmount
    ) ||
    input.finalizedAmount <= 0
  ) {
    return {
      ok: false,
      reason:
        "INVALID_AMOUNT"
    };
  }

  if (
    !validIsoDate(
      input.occurredAt
    ) ||
    !validIsoDate(
      input.finalizedAt
    ) ||
    !validIsoDate(
      input.recordedAt
    )
  ) {
    return {
      ok: false,
      reason:
        "INVALID_DATE"
    };
  }

  return {
    ok: true,
    value: {
      sourceId:
        `provider-earning-source:${input.earningsEntryId}`,

      tenantId:
        input.tenantId,
      companyId:
        input.companyId,
      branchId:
        input.branchId,
      accountingPeriodId:
        input.accountingPeriodId,

      providerCustomerId:
        input.providerCustomerId,
      providerType:
        input.providerType,

      assignmentType:
        "EXTERNAL",

      operationId:
        input.operationId,
      earningsEntryId:
        input.earningsEntryId,

      ...(input.sourceDocumentId
        ? {
            sourceDocumentId:
              input.sourceDocumentId
          }
        : {}),

      status:
        "FINALIZED",

      finalizedAmount:
        roundMoney(
          input.finalizedAmount
        ),

      currency:
        input.currency,

      occurredAt:
        input.occurredAt,
      finalizedAt:
        input.finalizedAt,
      recordedAt:
        input.recordedAt
    }
  };
}