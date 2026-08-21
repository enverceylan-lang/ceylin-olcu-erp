import assert from "node:assert/strict";

import {
  isSalesFinanceOutboxRetryCandidate,
  loadPendingSalesFinanceOutbox,
  type SalesFinanceOutboxRecord
} from "../src/lib/localSalesDb";

import {
  executePendingSalesFinanceOutbox,
  type SalesFinancePendingOutboxDependencies
} from "../src/lib/finance/salesFinanceOutboxExecutor";

import type {
  ErpScope
} from "../src/lib/erpScope";

const scope: ErpScope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a"
};

function record(
  id: string,
  status:
    SalesFinanceOutboxRecord["status"],
  patch:
    Partial<SalesFinanceOutboxRecord> = {}
): SalesFinanceOutboxRecord {
  return {
    ...scope,
    id,
    saleId: `sale-${id}`,
    saleSnapshot:
      {} as SalesFinanceOutboxRecord["saleSnapshot"],
    currency: "TRY",
    status,
    retryCount: 0,
    createdAt:
      "2026-08-21T00:00:00.000Z",
    updatedAt:
      "2026-08-21T00:00:00.000Z",
    ...patch
  };
}

async function main(): Promise<void> {
  for (
    const status of
    ["PENDING", "PROCESSING", "ERROR"] as const
  ) {
    assert.equal(
      isSalesFinanceOutboxRetryCandidate(
        record(status, status),
        scope
      ),
      true,
      `${status} exact-scope record must be retryable`
    );
  }

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("synced", "SYNCED"),
      scope
    ),
    false,
    "SYNCED record must not be retried"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record(
        "wrong-tenant",
        "ERROR",
        { tenantId: "tenant-b" }
      ),
      scope
    ),
    false,
    "wrong tenant must be excluded"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record(
        "wrong-company",
        "ERROR",
        { companyId: "company-b" }
      ),
      scope
    ),
    false,
    "wrong company must be excluded"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record(
        "wrong-branch",
        "ERROR",
        { branchId: "branch-b" }
      ),
      scope
    ),
    false,
    "wrong branch must be excluded"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record(
        "wrong-period",
        "ERROR",
        { accountingPeriodId: "period-b" }
      ),
      scope
    ),
    false,
    "wrong accounting period must be excluded"
  );

  await assert.rejects(
    () =>
      loadPendingSalesFinanceOutbox({
        ...scope,
        branchId: ""
      }),
    /SALES_FINANCE_OUTBOX_SCOPE_REQUIRED:.*branchId/,
    "invalid scope must fail closed before DB query"
  );

  const pendingRecords = [
    record("pending-1", "PENDING"),
    record("error-1", "ERROR")
  ];

  let receivedScope:
    ErpScope | null = null;

  const executedIds:
    string[] = [];

  const dependencies:
    SalesFinancePendingOutboxDependencies = {
    loadPending:
      async requestedScope => {
        receivedScope = requestedScope;
        return pendingRecords;
      },

    executeRecord:
      async current => {
        executedIds.push(
          current.id
        );

        return {
          outcome:
            "ERROR",
          record:
            current,
          reason:
            "TEST_ONLY"
        };
      }
  };

  const results =
    await executePendingSalesFinanceOutbox(
      scope,
      dependencies
    );

  assert.deepEqual(
    receivedScope,
    scope,
    "pending executor must pass exact scope to loader"
  );

  assert.deepEqual(
    executedIds,
    [
      "pending-1",
      "error-1"
    ],
    "pending executor must execute only records returned by scoped loader"
  );

  assert.equal(
    results.length,
    2
  );

  console.log(
    "salesFinanceOutboxScopedRetryBehaviorSuite: PASS"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});