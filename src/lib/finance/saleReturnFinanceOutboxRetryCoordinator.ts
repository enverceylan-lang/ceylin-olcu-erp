import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  SaleReturnFinanceOutboxExecutionResult
} from "@/lib/finance/saleReturnFinanceOutboxExecutor";

import {
  executePendingSaleReturnFinanceOutbox
} from "@/lib/finance/saleReturnFinanceOutboxExecutor";

export interface SaleReturnFinanceOutboxRetryAuthSnapshot {
  currentUserId:
    string | null;
  sessionToken:
    string | null;
}

export interface SaleReturnFinanceOutboxRetryDependencies {
  isOnline(): boolean;

  readAuth():
    SaleReturnFinanceOutboxRetryAuthSnapshot;

  loadVerifiedScope(
    sessionToken: string
  ): Promise<ErpScope>;

  executePending(
    scope: ErpScope
  ): Promise<
    SaleReturnFinanceOutboxExecutionResult[]
  >;

  schedule(
    callback: () => void,
    delayMs: number
  ): void;

  onExecutionErrors(
    errorCount: number
  ): void;

  onFailure(
    error: unknown
  ): void;
}

export interface SaleReturnFinanceOutboxRetryCoordinator {
  run(): Promise<void>;

  state(): {
    running: boolean;
    queued: boolean;
  };
}

export function createSaleReturnFinanceOutboxRetryCoordinator(
  dependencies:
    SaleReturnFinanceOutboxRetryDependencies
): SaleReturnFinanceOutboxRetryCoordinator {
  let running = false;
  let queued = false;

  const run = async (): Promise<void> => {
    if (!dependencies.isOnline()) {
      return;
    }

    if (running) {
      queued = true;
      return;
    }

    const auth =
      dependencies.readAuth();

    if (
      !auth.currentUserId ||
      !auth.sessionToken
    ) {
      return;
    }

    running = true;

    try {
      const activeScope =
        await dependencies.loadVerifiedScope(
          auth.sessionToken
        );

      const results =
        await dependencies.executePending(
          activeScope
        );

      const errorCount =
        results.filter(
          result =>
            result.outcome === "ERROR"
        ).length;

      if (errorCount > 0) {
        dependencies.onExecutionErrors(
          errorCount
        );
      }
    }
    catch (error: unknown) {
      dependencies.onFailure(
        error
      );
    }
    finally {
      running = false;

      if (queued) {
        queued = false;

        dependencies.schedule(
          () => {
            void run();
          },
          300
        );
      }
    }
  };

  return {
    run,

    state: () => ({
      running,
      queued
    })
  };
}