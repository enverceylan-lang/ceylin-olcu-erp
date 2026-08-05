import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";

import type {
  ProviderEarningSourceTruth,
  SupplierReceiptSourceTruth
} from "./counterpartySourceTruthPersistenceGateway";

export interface CounterpartySourceTruthAuthorizationGateway {
  readSupplierReceiptSource(input: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
    receiptId: string;
  }): Promise<SupplierReceiptSourceTruth | null>;

  readProviderEarningSource(input: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
    earningsEntryId: string;
  }): Promise<ProviderEarningSourceTruth | null>;
}

export type CounterpartyAccrualSourceAuthorizationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason:
        | "SUPPLIER_RECEIPT_ID_REQUIRED"
        | "SOURCE_DOCUMENT_ID_REQUIRED"
        | "PROVIDER_EARNINGS_ENTRY_ID_REQUIRED"
        | "PROVIDER_OPERATION_ID_REQUIRED"
        | "SOURCE_TRUTH_NOT_FOUND"
        | "SOURCE_SCOPE_MISMATCH"
        | "SOURCE_COUNTERPARTY_MISMATCH"
        | "SOURCE_DOCUMENT_MISMATCH"
        | "SOURCE_OPERATION_MISMATCH"
        | "SOURCE_PROVIDER_TYPE_MISMATCH"
        | "SOURCE_PROVIDER_ASSIGNMENT_NOT_EXTERNAL"
        | "SOURCE_PROVIDER_STATUS_NOT_FINALIZED"
        | "SOURCE_AMOUNT_MISMATCH"
        | "SOURCE_DATE_MISMATCH";
    };

function sameText(
  left: string | undefined,
  right: string | undefined
): boolean {
  return (left || "") === (right || "");
}

function sameMoney(
  left: number,
  right: number
): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

function sameInstant(
  left: string,
  right: string
): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime === rightTime
  );
}

function scopeMatches(
  movement: CounterpartyPayableMovement,
  source: {
    tenantId: string;
    companyId: string;
    branchId: string;
    accountingPeriodId: string;
  }
): boolean {
  return (
    movement.tenantId === source.tenantId &&
    movement.companyId === source.companyId &&
    movement.branchId === source.branchId &&
    movement.accountingPeriodId === source.accountingPeriodId
  );
}

export async function authorizeCounterpartyAccrualAgainstSourceTruth(
  movement: CounterpartyPayableMovement,
  gateway: CounterpartySourceTruthAuthorizationGateway
): Promise<CounterpartyAccrualSourceAuthorizationResult> {
  if (movement.kind !== "ACCRUAL") {
    return {
      ok: true
    };
  }

  if (movement.counterpartyType === "SUPPLIER") {
    if (!movement.supplierReceiptId?.trim()) {
      return {
        ok: false,
        reason: "SUPPLIER_RECEIPT_ID_REQUIRED"
      };
    }

    if (!movement.sourceDocumentId?.trim()) {
      return {
        ok: false,
        reason: "SOURCE_DOCUMENT_ID_REQUIRED"
      };
    }

    const source =
      await gateway.readSupplierReceiptSource({
        tenantId: movement.tenantId,
        companyId: movement.companyId,
        branchId: movement.branchId,
        accountingPeriodId: movement.accountingPeriodId,
        receiptId: movement.supplierReceiptId
      });

    if (!source) {
      return {
        ok: false,
        reason: "SOURCE_TRUTH_NOT_FOUND"
      };
    }

    if (!scopeMatches(movement, source)) {
      return {
        ok: false,
        reason: "SOURCE_SCOPE_MISMATCH"
      };
    }

    if (
      source.supplierCustomerId !==
      movement.counterpartyCustomerId
    ) {
      return {
        ok: false,
        reason: "SOURCE_COUNTERPARTY_MISMATCH"
      };
    }

    if (
      !sameText(
        source.sourceDocumentId,
        movement.sourceDocumentId
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_DOCUMENT_MISMATCH"
      };
    }

    if (
      !sameMoney(
        source.payableAmount,
        movement.amount
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_AMOUNT_MISMATCH"
      };
    }

    if (
      !sameInstant(
        source.receivedAt,
        movement.occurredAt
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_DATE_MISMATCH"
      };
    }

    return {
      ok: true
    };
  }

  if (
    movement.counterpartyType === "TAILOR" ||
    movement.counterpartyType === "INSTALLER"
  ) {
    if (!movement.providerEarningsEntryId?.trim()) {
      return {
        ok: false,
        reason: "PROVIDER_EARNINGS_ENTRY_ID_REQUIRED"
      };
    }

    if (!movement.operationId?.trim()) {
      return {
        ok: false,
        reason: "PROVIDER_OPERATION_ID_REQUIRED"
      };
    }

    const source =
      await gateway.readProviderEarningSource({
        tenantId: movement.tenantId,
        companyId: movement.companyId,
        branchId: movement.branchId,
        accountingPeriodId: movement.accountingPeriodId,
        earningsEntryId: movement.providerEarningsEntryId
      });

    if (!source) {
      return {
        ok: false,
        reason: "SOURCE_TRUTH_NOT_FOUND"
      };
    }

    if (!scopeMatches(movement, source)) {
      return {
        ok: false,
        reason: "SOURCE_SCOPE_MISMATCH"
      };
    }

    if (
      source.providerCustomerId !==
      movement.counterpartyCustomerId
    ) {
      return {
        ok: false,
        reason: "SOURCE_COUNTERPARTY_MISMATCH"
      };
    }

    if (
      source.providerType !==
      movement.counterpartyType
    ) {
      return {
        ok: false,
        reason: "SOURCE_PROVIDER_TYPE_MISMATCH"
      };
    }

    if (source.assignmentType !== "EXTERNAL") {
      return {
        ok: false,
        reason: "SOURCE_PROVIDER_ASSIGNMENT_NOT_EXTERNAL"
      };
    }

    if (source.status !== "FINALIZED") {
      return {
        ok: false,
        reason: "SOURCE_PROVIDER_STATUS_NOT_FINALIZED"
      };
    }

    if (
      source.operationId !==
      movement.operationId
    ) {
      return {
        ok: false,
        reason: "SOURCE_OPERATION_MISMATCH"
      };
    }

    if (
      !sameText(
        source.sourceDocumentId,
        movement.sourceDocumentId
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_DOCUMENT_MISMATCH"
      };
    }

    if (
      !sameMoney(
        source.finalizedAmount,
        movement.amount
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_AMOUNT_MISMATCH"
      };
    }

    if (
      !sameInstant(
        source.occurredAt,
        movement.occurredAt
      )
    ) {
      return {
        ok: false,
        reason: "SOURCE_DATE_MISMATCH"
      };
    }

    return {
      ok: true
    };
  }

  return {
    ok: false,
    reason: "SOURCE_COUNTERPARTY_MISMATCH"
  };
}