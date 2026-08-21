import type {
  ErpScope
} from "@/lib/erpScope";

import type {
  SalesFinanceOutboxExecutionResult
} from "@/lib/finance/salesFinanceOutboxExecutor";

export interface SalesFinanceOutboxRetryAuthSnapshot {
  currentUserId:
    string | null;
  sessionToken:
    string | null;
}

export interface SalesFinanceOutboxRetryDependencies {
  isOnline(): boolean;

  readAuth():
    SalesFinanceOutboxRetryAuthSnapshot;

  loadVerifiedScope(
    sessionToken: string
  ): Promise<ErpScope>;

  executePending(
    scope: ErpScope
  ): Promise<
    SalesFinanceOutboxExecutionResult[]
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

export interface SalesFinanceOutboxRetryCoordinator {
  run(): Promise<void>;

  state(): {
    running: boolean;
    queued: boolean;
  };
}

export function createSalesFinanceOutboxRetryCoordinator(
  dependencies:
    SalesFinanceOutboxRetryDependencies
): SalesFinanceOutboxRetryCoordinator {
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