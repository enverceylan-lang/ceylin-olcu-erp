import assert from "node:assert/strict";

import type {
  FinanceTransaction
} from "../src/lib/finance/financeContracts";

import {
  buildFinanceSupabasePersistencePayload
} from "../src/lib/finance/financeSupabasePayload";

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
    "try",

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

const payload =
  buildFinanceSupabasePersistencePayload(
    transaction
  );

assert.deepEqual(
  payload.transaction,
  {
    id:
      "finance-1",
    transaction_id:
      "transaction-1",
    idempotency_key:
      "sale:sale-1:charge",

    tenant_id:
      "tenant-1",
    company_id:
      "company-1",
    branch_id:
      "branch-1",
    accounting_period_id:
      "period-2026",

    transaction_type:
      "SALE_CHARGE",
    direction:
      "DEBIT",
    payment_method:
      null,

    finance_account_id:
      null,
    counter_account_id:
      null,

    customer_id:
      "customer-1",
    sale_id:
      "sale-1",

    source_document_id:
      "sale-1",
    source_document_type:
      "SALE",

    gross_amount:
      1250,
    commission_amount:
      0,
    net_amount:
      1250,

    currency:
      "TRY",

    transaction_date:
      "2026-07-31",
    value_date:
      "2026-07-31",
    due_date:
      "2026-08-31",

    status:
      "POSTED",

    description:
      "Satış borç kaydı",
    external_reference:
      null,
    reversal_of_transaction_id:
      null,

    created_by:
      "user-1",
    created_at:
      "2026-07-31T07:00:00.000Z",
    posted_at:
      "2026-07-31T07:00:00.000Z",
    reversed_at:
      null,
    archived_at:
      null,

    projection_source:
      "SALE_CHARGE"
  }
);

assert.equal(
  payload.audit.id,
  "audit:transaction-1"
);

assert.equal(
  payload.audit.action,
  "POSTED"
);

assert.equal(
  payload.audit.actor_user_id,
  "user-1"
);

assert.match(
  payload.audit.payload_hash,
  /^[0-9a-f]{8}$/
);

const replayPayload =
  buildFinanceSupabasePersistencePayload(
    {
      ...transaction
    }
  );

assert.equal(
  replayPayload.audit.payload_hash,
  payload.audit.payload_hash
);

assert.throws(
  () =>
    buildFinanceSupabasePersistencePayload(
      {
        ...transaction,
        branchId:
          ""
      }
    ),
  /FINANCE_SCOPE_REQUIRED:branchId/
);

assert.throws(
  () =>
    buildFinanceSupabasePersistencePayload(
      {
        ...transaction,
        netAmount:
          0
      }
    ),
  /FINANCE_AMOUNT_INVALID/
);

assert.throws(
  () =>
    buildFinanceSupabasePersistencePayload(
      {
        ...transaction,
        currency:
          "TL"
      }
    ),
  /FINANCE_CURRENCY_INVALID/
);

assert.throws(
  () =>
    buildFinanceSupabasePersistencePayload(
      {
        ...transaction,
        status:
          "PENDING"
      }
    ),
  /FINANCE_STATUS_MUST_BE_POSTED/
);

assert.throws(
  () =>
    buildFinanceSupabasePersistencePayload(
      {
        ...transaction,
        postedAt:
          null
      }
    ),
  /FINANCE_POSTED_AT_REQUIRED/
);

console.log(
  "financeSupabasePayloadSuite: PASS"
);