import type {
  SaleFinanceProjectionResult
} from "@/lib/finance/financeContracts";

import { persistApprovedSaleFinanceSource } from "@/lib/finance/financeSystemWorkflowClient";

import {
  projectSaleFinance,
  type ProjectSaleFinanceInput
} from "@/lib/finance/saleFinanceProjection";

import {
  loadPendingSalesFinanceOutbox,
  updateSalesFinanceOutbox,
  type SalesFinanceOutboxRecord
} from "@/lib/localSalesDb";

import type {
  ErpScope
} from "@/lib/erpScope";

export type SalesFinanceOutboxExecutionResult =
  | {
      outcome: "SYNCED";
      record: SalesFinanceOutboxRecord;
      createdCount: number;
      replayCount: number;
    }
  | {
      outcome: "ERROR";
      record: SalesFinanceOutboxRecord;
      reason: string;
    };

export interface SalesFinanceOutboxExecutorDependencies {
  projectSaleFinance(
    input: ProjectSaleFinanceInput
  ): SaleFinanceProjectionResult;

  executeFinanceCommand(
    transaction:
      SaleFinanceProjectionResult["transactions"][number],
    record: SalesFinanceOutboxRecord
  ): Promise<
    | { outcome: "CREATED" | "REPLAY"; transaction: SaleFinanceProjectionResult["transactions"][number] }
    | { outcome: "REJECT"; reason: string }
  >;

  updateSalesFinanceOutbox(
    record: SalesFinanceOutboxRecord
  ): Promise<void>;

  now(): string;
}

const defaultDependencies:
  SalesFinanceOutboxExecutorDependencies = {
    projectSaleFinance,
    executeFinanceCommand: persistApprovedSaleFinanceSource,
    updateSalesFinanceOutbox,
    now: () => new Date().toISOString()
  };

function errorText(
  projection: SaleFinanceProjectionResult
): string | null {
  const errors =
    projection.issues.filter(
      issue => issue.severity === "ERROR"
    );

  if (errors.length > 0) {
    return [
      "PROJECTION_ERROR",
      ...errors.map(
        issue => `${issue.code}:${issue.message}`
      )
    ].join("|");
  }

  if (!projection.summary.reconciled) {
    return "PROJECTION_RECONCILIATION_FAILED";
  }

  return null;
}

async function markError(
  record: SalesFinanceOutboxRecord,
  reason: string,
  dependencies:
    SalesFinanceOutboxExecutorDependencies
): Promise<SalesFinanceOutboxExecutionResult> {
  const failedAt =
    dependencies.now();

  const failedRecord:
    SalesFinanceOutboxRecord = {
      ...record,
      status: "ERROR",
      retryCount:
        record.retryCount + 1,
      lastError:
        reason.slice(0, 1000),
      updatedAt:
        failedAt
    };

  await dependencies.updateSalesFinanceOutbox(
    failedRecord
  );

  return {
    outcome: "ERROR",
    record: failedRecord,
    reason
  };
}

export async function executeSalesFinanceOutboxRecord(
  record: SalesFinanceOutboxRecord,
  dependencies:
    SalesFinanceOutboxExecutorDependencies =
      defaultDependencies
): Promise<SalesFinanceOutboxExecutionResult> {
  const processingAt =
    dependencies.now();

  const processingRecord:
    SalesFinanceOutboxRecord = {
      ...record,
      status: "PROCESSING",
      lastError: undefined,
      updatedAt:
        processingAt
    };

  await dependencies.updateSalesFinanceOutbox(
    processingRecord
  );

  try {
    const projection =
      dependencies.projectSaleFinance({
        sale:
          processingRecord.saleSnapshot,

        scope: {
          tenantId:
            processingRecord.tenantId,

          companyId:
            processingRecord.companyId,

          branchId:
            processingRecord.branchId,

          accountingPeriodId:
            processingRecord.accountingPeriodId
        },

        currency:
          processingRecord.currency,

        projectionAt:
          processingAt
      });

    const projectionError =
      errorText(projection);

    if (projectionError) {
      return markError(
        processingRecord,
        projectionError,
        dependencies
      );
    }

    let createdCount = 0;
    let replayCount = 0;

    for (
      const transaction of
      projection.transactions
    ) {
      const commandResult =
        await dependencies
          .executeFinanceCommand(
            transaction,
            processingRecord
          );

      if (
        commandResult.outcome ===
        "REJECT"
      ) {
        return markError(
          processingRecord,
          `FINANCE_COMMAND_REJECTED:${commandResult.reason}`,
          dependencies
        );
      }

      if (
        commandResult.outcome ===
        "CREATED"
      ) {
        createdCount += 1;
      }
      else {
        replayCount += 1;
      }
    }

    const processedAt =
      dependencies.now();

    const syncedRecord:
      SalesFinanceOutboxRecord = {
        ...processingRecord,
        status: "SYNCED",
        lastError: undefined,
        processedAt,
        updatedAt:
          processedAt
      };

    await dependencies.updateSalesFinanceOutbox(
      syncedRecord
    );

    return {
      outcome: "SYNCED",
      record: syncedRecord,
      createdCount,
      replayCount
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

export interface SalesFinancePendingOutboxDependencies {
  loadPending(
    scope: ErpScope
  ): Promise<SalesFinanceOutboxRecord[]>;
  executeRecord(
    record: SalesFinanceOutboxRecord
  ): Promise<SalesFinanceOutboxExecutionResult>;
}

const defaultPendingDependencies:
  SalesFinancePendingOutboxDependencies = {
    loadPending:
      loadPendingSalesFinanceOutbox,
    executeRecord:
      executeSalesFinanceOutboxRecord
  };

export async function executePendingSalesFinanceOutbox(
  scope: ErpScope,
  dependencies:
    SalesFinancePendingOutboxDependencies =
      defaultPendingDependencies
): Promise<SalesFinanceOutboxExecutionResult[]> {
  const records =
    await dependencies.loadPending(
      scope
    );

  const results:
    SalesFinanceOutboxExecutionResult[] = [];

  for (const record of records) {
    results.push(
      await dependencies.executeRecord(
        record
      )
    );
  }

  return results;
}
