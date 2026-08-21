import assert from "node:assert/strict";

import {
  createSalesFinanceOutboxRetryCoordinator,
  type SalesFinanceOutboxRetryDependencies
} from "../src/lib/finance/salesFinanceOutboxRetryCoordinator";

import type {
  ErpScope
} from "../src/lib/erpScope";

const scope: ErpScope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a"
};

function dependencies():
{
  value:
    SalesFinanceOutboxRetryDependencies;
  stats: {
    online: boolean;
    userId: string | null;
    token: string | null;
    loadScopeCalls: number;
    executeCalls: number;
    activeExecutions: number;
    maxActiveExecutions: number;
    scheduled:
      Array<{
        callback: () => void;
        delayMs: number;
      }>;
    executionErrorCounts:
      number[];
    failures:
      unknown[];
  };
} {
  const stats = {
    online: true,
    userId: "user-a" as string | null,
    token: "session-a" as string | null,
    loadScopeCalls: 0,
    executeCalls: 0,
    activeExecutions: 0,
    maxActiveExecutions: 0,
    scheduled:
      [] as Array<{
        callback: () => void;
        delayMs: number;
      }>,
    executionErrorCounts:
      [] as number[],
    failures:
      [] as unknown[]
  };

  return {
    stats,

    value: {
      isOnline:
        () => stats.online,

      readAuth:
        () => ({
          currentUserId:
            stats.userId,
          sessionToken:
            stats.token
        }),

      loadVerifiedScope:
        async token => {
          assert.equal(
            token,
            "session-a"
          );
          stats.loadScopeCalls += 1;
          return scope;
        },

      executePending:
        async receivedScope => {
          assert.deepEqual(
            receivedScope,
            scope
          );
          stats.executeCalls += 1;
          return [];
        },

      schedule:
        (callback, delayMs) => {
          stats.scheduled.push({
            callback,
            delayMs
          });
        },

      onExecutionErrors:
        count => {
          stats.executionErrorCounts.push(
            count
          );
        },

      onFailure:
        error => {
          stats.failures.push(
            error
          );
        }
    }
  };
}

async function main(): Promise<void> {
  {
    const test =
      dependencies();

    test.stats.online =
      false;

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.equal(
      test.stats.loadScopeCalls,
      0,
      "offline retry must be no-op"
    );
  }

  {
    const test =
      dependencies();

    test.stats.userId =
      null;

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.equal(
      test.stats.loadScopeCalls,
      0,
      "missing user must fail closed"
    );
  }

  {
    const test =
      dependencies();

    test.stats.token =
      null;

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.equal(
      test.stats.loadScopeCalls,
      0,
      "missing session must fail closed"
    );
  }

  {
    const test =
      dependencies();

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.equal(
      test.stats.loadScopeCalls,
      1
    );

    assert.equal(
      test.stats.executeCalls,
      1
    );

    assert.deepEqual(
      coordinator.state(),
      {
        running: false,
        queued: false
      }
    );
  }

  {
    const test =
      dependencies();

    let releaseFirstRun:
      () => void =
        () => {
          throw new Error(
            "TEST_RELEASE_NOT_READY"
          );
        };

    let startedResolve:
      (() => void) | null =
        null;

    const started =
      new Promise<void>(
        resolve => {
          startedResolve =
            resolve;
        }
      );

    test.value.executePending =
      async receivedScope => {
        assert.deepEqual(
          receivedScope,
          scope
        );

        test.stats.executeCalls += 1;
        test.stats.activeExecutions += 1;
        test.stats.maxActiveExecutions =
          Math.max(
            test.stats.maxActiveExecutions,
            test.stats.activeExecutions
          );

        if (
          test.stats.executeCalls === 1
        ) {
          if (startedResolve) {
            startedResolve();
          }

          await new Promise<void>(
            resolve => {
              releaseFirstRun =
                resolve;
            }
          );
        }

        test.stats.activeExecutions -= 1;
        return [];
      };

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    const first =
      coordinator.run();

    await started;

    await coordinator.run();

    assert.deepEqual(
      coordinator.state(),
      {
        running: true,
        queued: true
      },
      "concurrent trigger must queue instead of starting parallel execution"
    );

    releaseFirstRun();

    await first;

    assert.equal(
      test.stats.maxActiveExecutions,
      1,
      "single-flight must prevent parallel executePending calls"
    );

    assert.equal(
      test.stats.scheduled.length,
      1,
      "queued trigger must schedule one bounded follow-up"
    );

    assert.equal(
      test.stats.scheduled[0]?.delayMs,
      300
    );

    test.stats.scheduled[0]?.callback();

    await new Promise<void>(
      resolve =>
        setTimeout(
          resolve,
          0
        )
    );

    assert.equal(
      test.stats.executeCalls,
      2,
      "queued follow-up must execute after the first run completes"
    );

    assert.equal(
      test.stats.maxActiveExecutions,
      1
    );
  }

  {
    const test =
      dependencies();

    test.value.executePending =
      async () => [
        {
          outcome: "ERROR",
          record:
            {} as never,
          reason:
            "TEST"
        }
      ];

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.deepEqual(
      test.stats.executionErrorCounts,
      [1]
    );
  }

  {
    const test =
      dependencies();

    test.value.loadVerifiedScope =
      async () => {
        throw new Error(
          "SCOPE_FAILURE"
        );
      };

    const coordinator =
      createSalesFinanceOutboxRetryCoordinator(
        test.value
      );

    await coordinator.run();

    assert.equal(
      test.stats.failures.length,
      1
    );

    assert.deepEqual(
      coordinator.state(),
      {
        running: false,
        queued: false
      }
    );
  }

  console.log(
    "salesFinanceOutboxRetryCoordinatorSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});