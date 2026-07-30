import type {
  FinanceTransaction
} from "@/lib/finance/financeContracts";

import {
  executeFinanceCommand,
  type FinanceCommandResult
} from "@/lib/finance/financeCommandService";

import {
  loadPendingSaleReturnFinanceOutbox,
  updateSaleReturnFinanceOutbox,
  type SaleReturnFinanceOutboxRecord
} from "@/lib/localSaleReturnsDb";

export type SaleReturnFinanceOutboxExecutionResult =
  | {
      outcome: "SYNCED";
      record:
        SaleReturnFinanceOutboxRecord;
      financeOutcome:
        "CREATED" | "REPLAY";
    }
  | {
      outcome: "ERROR";
      record:
        SaleReturnFinanceOutboxRecord;
      reason: string;
    };

export interface SaleReturnFinanceOutboxExecutorDependencies {
  executeFinanceCommand(
    transaction: FinanceTransaction
  ): Promise<FinanceCommandResult>;

  updateSaleReturnFinanceOutbox(
    record:
      SaleReturnFinanceOutboxRecord
  ): Promise<void>;

  now(): string;
}

const defaultDependencies:
  SaleReturnFinanceOutboxExecutorDependencies = {
    executeFinanceCommand,
    updateSaleReturnFinanceOutbox,
    now: () =>
      new Date().toISOString()
  };

function buildFinanceTransaction(
  record:
    SaleReturnFinanceOutboxRecord
): FinanceTransaction {
  const saleReturn =
    record.saleReturnSnapshot;

  const transactionId = [
    "sale-return-finance",
    encodeURIComponent(
      saleReturn.id
    )
  ].join(":");

  const idempotencyKey = [
    "sale-return",
    encodeURIComponent(
      saleReturn.id
    ),
    "finance"
  ].join(":");

  const transactionDate =
    saleReturn.updatedAt.slice(0, 10);

  return {
    tenantId:
      record.tenantId,
    companyId:
      record.companyId,
    branchId:
      record.branchId,
    accountingPeriodId:
      record.accountingPeriodId,

    id: transactionId,
    transactionId,
    idempotencyKey,

    transactionType:
      "REFUND",
    direction:
      "CREDIT",

    paymentMethod: null,
    financeAccountId: null,
    counterAccountId: null,

    customerId:
      saleReturn.customerId,
    saleId:
      saleReturn.saleId,

    sourceDocumentId:
      saleReturn.id,
    sourceDocumentType:
      "SALE_RETURN",

    grossAmount:
      saleReturn.amount,
    commissionAmount: 0,
    netAmount:
      saleReturn.amount,

    currency:
      saleReturn.currency,

    transactionDate,
    valueDate:
      transactionDate,
    dueDate: null,

    status: "POSTED",

    description:
      saleReturn.reason
        ? `Satış iadesi — ${saleReturn.reason}`
        : "Satış iadesi",

    externalReference:
      saleReturn.idempotencyKey,

    reversalOfTransactionId:
      null,

    createdBy:
      saleReturn.actorUserId,
    createdAt:
      saleReturn.updatedAt,
    postedAt:
      saleReturn.updatedAt,

    reversedAt: null,
    archivedAt: null,

    projectionSource:
      "SALE_RETURN"
  };
}

async function markError(
  record:
    SaleReturnFinanceOutboxRecord,
  reason: string,
  dependencies:
    SaleReturnFinanceOutboxExecutorDependencies
): Promise<
  SaleReturnFinanceOutboxExecutionResult
> {
  const failedAt =
    dependencies.now();

  const failedRecord:
    SaleReturnFinanceOutboxRecord = {
      ...record,
      status: "ERROR",
      retryCount:
        record.retryCount + 1,
      lastError:
        reason.slice(0, 1000),
      updatedAt:
        failedAt
    };

  await dependencies
    .updateSaleReturnFinanceOutbox(
      failedRecord
    );

  return {
    outcome: "ERROR",
    record:
      failedRecord,
    reason
  };
}

export async function executeSaleReturnFinanceOutboxRecord(
  record:
    SaleReturnFinanceOutboxRecord,
  dependencies:
    SaleReturnFinanceOutboxExecutorDependencies =
      defaultDependencies
): Promise<
  SaleReturnFinanceOutboxExecutionResult
> {
  const processingAt =
    dependencies.now();

  const processingRecord:
    SaleReturnFinanceOutboxRecord = {
      ...record,
      status: "PROCESSING",
      lastError: undefined,
      updatedAt:
        processingAt
    };

  await dependencies
    .updateSaleReturnFinanceOutbox(
      processingRecord
    );

  try {
    if (
      processingRecord
        .saleReturnSnapshot.status !==
      "ONAYLANDI"
    ) {
      return markError(
        processingRecord,
        "SALE_RETURN_NOT_APPROVED",
        dependencies
      );
    }

    const transaction =
      buildFinanceTransaction(
        processingRecord
      );

    const financeResult =
      await dependencies
        .executeFinanceCommand(
          transaction
        );

    if (
      financeResult.outcome ===
      "REJECT"
    ) {
      return markError(
        processingRecord,
        `FINANCE_COMMAND_REJECTED:${financeResult.reason}`,
        dependencies
      );
    }

    const processedAt =
      dependencies.now();

    const syncedRecord:
      SaleReturnFinanceOutboxRecord = {
      ...processingRecord,
      status: "SYNCED",
      lastError: undefined,
      processedAt,
      updatedAt:
        processedAt
    };

    await dependencies
      .updateSaleReturnFinanceOutbox(
        syncedRecord
      );

    return {
      outcome: "SYNCED",
      record:
        syncedRecord,
      financeOutcome:
        financeResult.outcome
    };
  }
  catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "UNKNOWN_EXECUTOR_ERROR";

    return markError(
      processingRecord,
      `EXECUTOR_ERROR:${message}`,
      dependencies
    );
  }
}

export async function executePendingSaleReturnFinanceOutbox():
Promise<
  SaleReturnFinanceOutboxExecutionResult[]
> {
  const records =
    await loadPendingSaleReturnFinanceOutbox();

  const results:
    SaleReturnFinanceOutboxExecutionResult[] = [];

  for (const record of records) {
    results.push(
      await executeSaleReturnFinanceOutboxRecord(
        record
      )
    );
  }

  return results;
}