import assert from "node:assert/strict";

import {
  canonicalFinanceOperationJson,
  stableFinanceOperationHash
} from "../src/lib/finance/stableFinanceOperationHash";

const base = {
  operationId: "op-1",
  idempotencyKey: "idem-1",
  kind: "COLLECTION",
  channel: "CASH",
  amount: 100,
  currency: "TRY",
  source: {
    customerId: "customer-1",
    saleId: "sale-1",
    sourceDocumentId: "payment-1"
  },
  accounts: {
    cashAccountId: "cash-1",
    counterAccountId: "ledger-1"
  }
};

const reordered = {
  currency: "TRY",
  amount: 100,
  channel: "CASH",
  kind: "COLLECTION",
  idempotencyKey: "idem-1",
  operationId: "op-1",
  accounts: {
    counterAccountId: "ledger-1",
    cashAccountId: "cash-1"
  },
  source: {
    sourceDocumentId: "payment-1",
    saleId: "sale-1",
    customerId: "customer-1"
  }
};

assert.equal(
  stableFinanceOperationHash(base),
  stableFinanceOperationHash(reordered),
  "object key order must not change the semantic hash"
);

assert.notEqual(
  stableFinanceOperationHash(base),
  stableFinanceOperationHash({
    ...base,
    source: {
      ...base.source,
      customerId: "customer-2"
    }
  }),
  "nested source changes must change the hash"
);

assert.notEqual(
  stableFinanceOperationHash(base),
  stableFinanceOperationHash({
    ...base,
    accounts: {
      ...base.accounts,
      cashAccountId: "cash-2"
    }
  }),
  "nested account changes must change the hash"
);

assert.notEqual(
  stableFinanceOperationHash(base),
  stableFinanceOperationHash({
    ...base,
    amount: 101
  }),
  "top-level amount changes must change the hash"
);

assert.equal(
  canonicalFinanceOperationJson({
    b: 2,
    nested: { z: 3, a: 1 },
    a: 1,
    optional: undefined
  }),
  '{"a":1,"b":2,"nested":{"a":1,"z":3}}'
);

assert.throws(
  () => stableFinanceOperationHash({ amount: Number.POSITIVE_INFINITY }),
  /FINANCE_HASH_NON_FINITE_NUMBER/
);

assert.throws(
  () => stableFinanceOperationHash(new Date()),
  /FINANCE_HASH_NON_PLAIN_OBJECT/
);

console.log("[PASS] Finance Operations deep stable hash");