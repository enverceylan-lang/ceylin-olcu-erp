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

import type { ErpScope } from "@/lib/erpScope";

import {
  persistApprovedSaleReturnFinanceSource,
  type FinanceSystemWorkflowClientResult
} from "@/lib/finance/financeSystemWorkflowClient";

import {
  reconcileFinanceSystemWorkflow,
  type FinanceSystemWorkflowReconcileResult
} from "@/lib/finance/financeSystemWorkflowClient";

import { sha256 } from "@/lib/finance/financeSystemWorkflowClient";

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
    transaction: FinanceTransaction,
    record: SaleReturnFinanceOutboxRecord
  ): Promise<FinanceSystemWorkflowClientResult>;

  updateSaleReturnFinanceOutbox(
    record:
      SaleReturnFinanceOutboxRecord
  ): Promise<void>;

  now(): string;
}

const defaultDependencies:
  SaleReturnFinanceOutboxExecutorDependencies = {
    executeFinanceCommand: persistApprovedSaleReturnFinanceSource,
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
          transaction,
          processingRecord
        );

    if (
      financeResult.outcome ===
      "REJECT"
    ) {
      const reason = financeResult.reason;
      // CONFLICT (different payload) or REJECT (validation error) -> no retry
      if (reason.startsWith("CONFLICT:") || reason === "REFUND_EXCEEDS_SALE_LIMIT") {
        return markError(
          processingRecord,
          `FINANCE_COMMAND_REJECTED:${reason}`,
          dependencies
        );
      }
      return markError(
        processingRecord,
        `FINANCE_COMMAND_REJECTED:${reason}`,
        dependencies
      );
    }

    // CREATED or REPLAY -> success
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

    // AMBIGUOUS: network error, timeout, 5xx -> attempt reconciliation
    if (message.startsWith("AMBIGUOUS:")) {
      const record = processingRecord;
      const transaction = buildFinanceTransaction(record);
      const idempotencyKey = [
        "sale-return",
        encodeURIComponent(record.saleReturnId),
        "finance"
      ].join(":");
      const transactionId = [
        "sale-return-finance",
        encodeURIComponent(record.saleReturnId)
      ].join(":");
      const sourceBase = {
        tenantId: record.tenantId,
        companyId: record.companyId,
        branchId: record.branchId,
        accountingPeriodId: record.accountingPeriodId,
        saleReturnId: record.saleReturnId,
        saleId: record.saleId,
        customerId: record.customerId,
        amount: record.saleReturnSnapshot.amount,
        currency: record.saleReturnSnapshot.currency,
        actorUserId: record.saleReturnSnapshot.actorUserId,
        approvedAt: record.saleReturnSnapshot.updatedAt,
        sourceVersion: 1
      };
      const source = { ...sourceBase, payloadHash: await sha256(sourceBase) };

      const recon = await reconcileFinanceSystemWorkflow(
        "SALE_RETURN_APPROVAL",
        { tenantId: record.tenantId, companyId: record.companyId, branchId: record.branchId, accountingPeriodId: record.accountingPeriodId },
        record.saleReturnId,
        idempotencyKey,
        transactionId,
        source.payloadHash
      );

      if (recon.outcome === "CONFIRMED") {
        // Server confirmed created/replay -> mark SYNCED
        const syncedRecord: SaleReturnFinanceOutboxRecord = {
          ...processingRecord,
          status: "SYNCED",
          lastError: undefined,
          processedAt: dependencies.now(),
          updatedAt: dependencies.now()
        };
        await dependencies.updateSaleReturnFinanceOutbox(syncedRecord);
        return {
          outcome: "SYNCED",
          record: syncedRecord,
          financeOutcome: "CREATED"
        };
      }

      if (recon.outcome === "CONFLICT" || recon.outcome === "NOT_FOUND") {
        // Definitive conflict or not found -> ERROR, no retry
        return markError(
          processingRecord,
          `RECONCILIATION_${recon.outcome}:${recon.reason}`,
          dependencies
        );
      }

      // AMBIGUOUS from reconciliation -> remains ambiguous, mark ERROR for retry
      return markError(
        processingRecord,
        `RECONCILIATION_AMBIGUOUS:${recon.reason}`,
        dependencies
      );
    }

    return markError(
      processingRecord,
      `EXECUTOR_ERROR:${message}`,
      dependencies
    );
  }
}

export async function executePendingSaleReturnFinanceOutbox(
  scope: ErpScope
): Promise<
  SaleReturnFinanceOutboxExecutionResult[]
> {
  const records =
    await loadPendingSaleReturnFinanceOutbox(scope);

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