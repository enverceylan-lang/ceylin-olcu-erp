import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  persistFinanceTransaction,
  type FinancePersistenceGateway
} from "../src/lib/finance/financePersistenceGateway";

async function main(): Promise<void> {
const transaction:
  FinanceTransaction = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-2026",

  id:
    "finance-1",
  transactionId:
    "transaction-1",
  idempotencyKey:
    "sale:sale-1:charge",

  transactionType:
    "SALE_CHARGE",
  direction:
    "DEBIT",
  paymentMethod:
    null,

  financeAccountId:
    null,
  counterAccountId:
    null,

  customerId:
    "customer-1",
  saleId:
    "sale-1",

  sourceDocumentId:
    "sale-1",
  sourceDocumentType:
    "SALE",

  grossAmount:
    1250,
  commissionAmount:
    0,
  netAmount:
    1250,

  currency:
    "TRY",

  transactionDate:
    "2026-07-31",
  valueDate:
    "2026-07-31",
  dueDate:
    "2026-08-31",

  status:
    "POSTED",

  description:
    "Satış borç kaydı",
  externalReference:
    null,
  reversalOfTransactionId:
    null,

  createdBy:
    "user-1",
  createdAt:
    "2026-07-31T07:00:00.000Z",
  postedAt:
    "2026-07-31T07:00:00.000Z",
  reversedAt:
    null,
  archivedAt:
    null,

  projectionSource:
    "SALE_CHARGE"
};

const capturedPayloads:
  unknown[] = [];

const createdGateway:
  FinancePersistenceGateway = {
  async persist(payload) {
    capturedPayloads.push(
      payload
    );

    return {
      outcome:
        "CREATED",
      transactionId:
        payload.transaction
          .transaction_id
    };
  }
};

const createdResult =
  await persistFinanceTransaction(
    transaction,
    {
      gateway:
        createdGateway
    }
  );

assert.deepEqual(
  createdResult,
  {
    outcome:
      "CREATED",
    transactionId:
      "transaction-1"
  }
);

assert.equal(
  capturedPayloads.length,
  1
);

const replayGateway:
  FinancePersistenceGateway = {
  async persist(payload) {
    return {
      outcome:
        "REPLAY",
      transactionId:
        payload.transaction
          .transaction_id
    };
  }
};

const replayResult =
  await persistFinanceTransaction(
    transaction,
    {
      gateway:
        replayGateway
    }
  );

assert.deepEqual(
  replayResult,
  {
    outcome:
      "REPLAY",
    transactionId:
      "transaction-1"
  }
);

const conflictGateway:
  FinancePersistenceGateway = {
  async persist(payload) {
    return {
      outcome:
        "CONFLICT",
      transactionId:
        payload.transaction
          .transaction_id,
      reason:
        "IDEMPOTENCY_PAYLOAD_CONFLICT"
    };
  }
};

const conflictResult =
  await persistFinanceTransaction(
    transaction,
    {
      gateway:
        conflictGateway
    }
  );

assert.deepEqual(
  conflictResult,
  {
    outcome:
      "CONFLICT",
    transactionId:
      "transaction-1",
    reason:
      "IDEMPOTENCY_PAYLOAD_CONFLICT"
  }
);

const mismatchingGateway:
  FinancePersistenceGateway = {
  async persist() {
    return {
      outcome:
        "CREATED",
      transactionId:
        "wrong-transaction"
    };
  }
};

await assert.rejects(
  () =>
    persistFinanceTransaction(
      transaction,
      {
        gateway:
          mismatchingGateway
      }
    ),
  /FINANCE_PERSISTENCE_TRANSACTION_ID_MISMATCH/
);

const rejectingGateway:
  FinancePersistenceGateway = {
  async persist() {
    throw new Error(
      "REMOTE_WRITE_FAILED"
    );
  }
};

await assert.rejects(
  () =>
    persistFinanceTransaction(
      transaction,
      {
        gateway:
          rejectingGateway
      }
    ),
  /REMOTE_WRITE_FAILED/
);

await assert.rejects(
  () =>
    persistFinanceTransaction(
      {
        ...transaction,
        tenantId:
          ""
      },
      {
        gateway:
          createdGateway
      }
    ),
  /FINANCE_SCOPE_REQUIRED:tenantId/
);

console.log(
  "financePersistenceGatewaySuite: PASS"
);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});