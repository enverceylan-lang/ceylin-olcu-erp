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
  // 1. PENDING exact-scope record must be retryable
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("pending", "PENDING"),
      scope
    ),
    true,
    "PENDING exact-scope record must be retryable"
  );

  // 2. PROCESSING record must FAIL CLOSED (never automatically retried)
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("processing", "PROCESSING"),
      scope
    ),
    false,
    "PROCESSING record must fail closed and not be retried automatically"
  );

  // 3. SYNCED record must never be retried
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("synced", "SYNCED"),
      scope
    ),
    false,
    "SYNCED record must not be retried"
  );

  // 4. Permanent errors must never be retried
  const permanentErrors = [
    "PROJECTION_ERROR:ITEM_NOT_FOUND:Detail",
    "PROJECTION_RECONCILIATION_FAILED",
    "FINANCE_COMMAND_REJECTED:INVALID_PAYLOAD",
    "FINANCE_COMMAND_REJECTED:ACCOUNT_CLOSED",
    "ACTOR_CONTEXT_INVALID",
    "SCOPE_MISMATCH",
    "SCHEMA_ERROR"
  ];

  for (const err of permanentErrors) {
    assert.equal(
      isSalesFinanceOutboxRetryCandidate(
        record(`perm-${err}`, "ERROR", { lastError: err, retryCount: 0 }),
        scope
      ),
      false,
      `Permanent error "${err}" must never be retried automatically`
    );
  }

  // 5. Indeterminate server responses must fail closed
  const indeterminateErrors = [
    "EXECUTOR_ERROR:HTTP_500",
    "EXECUTOR_ERROR:TIMEOUT",
    "UNKNOWN_EXECUTOR_ERROR"
  ];

  for (const err of indeterminateErrors) {
    assert.equal(
      isSalesFinanceOutboxRetryCandidate(
        record(`indet-${err}`, "ERROR", { lastError: err, retryCount: 0 }),
        scope
      ),
      false,
      `Indeterminate error "${err}" must not be equated to transient network failure`
    );
  }

  // 6. Verified transient errors within retry quota (retryCount < 3) must be retryable
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("transient-offline", "ERROR", { lastError: "NETWORK_OFFLINE", retryCount: 0 }),
      scope
    ),
    true,
    "Transient NETWORK_OFFLINE with retryCount 0 must be retryable"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("transient-client-off", "ERROR", { lastError: "CLIENT_OFFLINE", retryCount: 2 }),
      scope
    ),
    true,
    "Transient CLIENT_OFFLINE with retryCount 2 must be retryable"
  );

  // 7. Transient errors with exhausted retry quota (retryCount >= 3) must NOT be retried
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("transient-exhausted", "ERROR", { lastError: "NETWORK_OFFLINE", retryCount: 3 }),
      scope
    ),
    false,
    "Transient error with retryCount >= 3 must be blocked"
  );

  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record("transient-exhausted-5", "ERROR", { lastError: "NETWORK_OFFLINE", retryCount: 5 }),
      scope
    ),
    false,
    "Transient error with retryCount 5 must be blocked"
  );

  // 8. Scope boundaries must be strictly enforced
  assert.equal(
    isSalesFinanceOutboxRetryCandidate(
      record(
        "wrong-tenant",
        "PENDING",
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
        "PENDING",
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
        "PENDING",
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
        "PENDING",
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