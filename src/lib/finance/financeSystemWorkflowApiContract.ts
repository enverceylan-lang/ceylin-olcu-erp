import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import type {
  ApprovedSaleReturnWorkflowSourceInput,
  ApprovedSaleWorkflowSourceInput
} from "@/lib/finance/financeWorkflowSourcePayload";

export type FinanceSystemWorkflowApiRequest =
  | {
      workflow:
        "SALE_APPROVAL";
      source:
        ApprovedSaleWorkflowSourceInput;
      transaction:
        FinanceTransaction;
    }
  | {
      workflow:
        "SALE_RETURN_APPROVAL";
      source:
        ApprovedSaleReturnWorkflowSourceInput;
      transaction:
        FinanceTransaction;
    };

export type FinanceSystemWorkflowApiParseResult =
  | {
      valid:
        true;
      value:
        FinanceSystemWorkflowApiRequest;
    }
  | {
      valid:
        false;
      reason:
        | "INVALID_BODY"
        | "INVALID_WORKFLOW"
        | "INVALID_SOURCE"
        | "INVALID_TRANSACTION"
        | "WORKFLOW_TRANSACTION_MISMATCH";
    };

function isRecord(
  value:
    unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

function hasText(
  value:
    unknown
): value is string {
  return (
    typeof value ===
      "string" &&
    Boolean(value.trim())
  );
}

function hasPositiveNumber(
  value:
    unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function hasScope(
  value:
    Record<string, unknown>
): boolean {
  return (
    hasText(value.tenantId) &&
    hasText(value.companyId) &&
    hasText(value.branchId) &&
    hasText(value.accountingPeriodId)
  );
}

function isFinanceTransaction(
  value:
    unknown
): value is FinanceTransaction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasScope(value) &&
    hasText(value.id) &&
    hasText(value.transactionId) &&
    hasText(value.idempotencyKey) &&
    hasText(value.transactionType) &&
    hasText(value.direction) &&
    hasText(value.customerId) &&
    hasText(value.saleId) &&
    hasText(value.sourceDocumentId) &&
    hasText(value.sourceDocumentType) &&
    hasPositiveNumber(value.grossAmount) &&
    typeof value.commissionAmount ===
      "number" &&
    hasPositiveNumber(value.netAmount) &&
    hasText(value.currency) &&
    hasText(value.transactionDate) &&
    hasText(value.status) &&
    hasText(value.createdBy) &&
    hasText(value.createdAt) &&
    hasText(value.projectionSource)
  );
}

function isSaleSource(
  value:
    unknown
): value is ApprovedSaleWorkflowSourceInput {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasScope(value) &&
    hasText(value.saleId) &&
    hasText(value.customerId) &&
    hasPositiveNumber(value.totalAmount) &&
    hasText(value.currency) &&
    hasText(value.approvedByUserId) &&
    hasText(value.approvedAt) &&
    typeof value.sourceVersion ===
      "number" &&
    hasText(value.payloadHash)
  );
}

function isSaleReturnSource(
  value:
    unknown
): value is ApprovedSaleReturnWorkflowSourceInput {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasScope(value) &&
    hasText(value.saleReturnId) &&
    hasText(value.saleId) &&
    hasText(value.customerId) &&
    hasPositiveNumber(value.amount) &&
    hasText(value.currency) &&
    hasText(value.actorUserId) &&
    hasText(value.approvedAt) &&
    typeof value.sourceVersion ===
      "number" &&
    hasText(value.payloadHash)
  );
}

export function parseFinanceSystemWorkflowApiRequest(
  body:
    unknown
): FinanceSystemWorkflowApiParseResult {
  if (!isRecord(body)) {
    return {
      valid:
        false,
      reason:
        "INVALID_BODY"
    };
  }

  if (
    body.workflow !==
      "SALE_APPROVAL" &&
    body.workflow !==
      "SALE_RETURN_APPROVAL"
  ) {
    return {
      valid:
        false,
      reason:
        "INVALID_WORKFLOW"
    };
  }

  if (!isFinanceTransaction(body.transaction)) {
    return {
      valid:
        false,
      reason:
        "INVALID_TRANSACTION"
    };
  }

  if (
    body.workflow ===
      "SALE_APPROVAL"
  ) {
    if (!isSaleSource(body.source)) {
      return {
        valid:
          false,
        reason:
          "INVALID_SOURCE"
      };
    }

    if (
      body.transaction.transactionType !==
        "SALE_CHARGE" ||
      body.transaction.sourceDocumentType !==
        "SALE" ||
      body.transaction.sourceDocumentId !==
        body.source.saleId ||
      body.transaction.saleId !==
        body.source.saleId
    ) {
      return {
        valid:
          false,
        reason:
          "WORKFLOW_TRANSACTION_MISMATCH"
      };
    }

    return {
      valid:
        true,
      value: {
        workflow:
          "SALE_APPROVAL",
        source:
          body.source,
        transaction:
          body.transaction
      }
    };
  }

  if (!isSaleReturnSource(body.source)) {
    return {
      valid:
        false,
      reason:
        "INVALID_SOURCE"
    };
  }

  if (
    body.transaction.transactionType !==
      "REFUND" ||
    body.transaction.sourceDocumentType !==
      "SALE_RETURN" ||
    body.transaction.sourceDocumentId !==
      body.source.saleReturnId ||
    body.transaction.saleId !==
      body.source.saleId
  ) {
    return {
      valid:
        false,
      reason:
        "WORKFLOW_TRANSACTION_MISMATCH"
    };
  }

  return {
    valid:
      true,
    value: {
      workflow:
        "SALE_RETURN_APPROVAL",
      source:
        body.source,
      transaction:
        body.transaction
    }
  };
}