import assert from "node:assert/strict";
import { decideCollectionServerContract, decideInstrumentTransitionServerContract } from "../src/lib/finance/collectionServerContract";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};
const base = {
  ...scope,
  operationId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  channel: "CASH",
  customerId: "customer-1",
  amount: 100,
  currency: "TRY",
  cashAccountId: "33333333-3333-4333-8333-333333333333"
} as const;

const cash = decideCollectionServerContract({ collectionCommand: base }, scope);
assert.equal(cash.allowed, true);
if (cash.allowed) {
  assert.equal(cash.operation, "COLLECTION");
  assert.equal(cash.requestedPermission, "finance.cash.collection.create");
}

const cheque = decideCollectionServerContract({
  collectionCommand: {
    ...base,
    channel: "CHEQUE",
    cashAccountId: null,
    instrument: {
      instrumentNumber: "CHK-1",
      drawerName: "ABC",
      bankName: "Garanti BBVA",
      dueDate: "2026-09-01"
    }
  }
}, scope);
assert.equal(cheque.allowed, true);
if (cheque.allowed) {
  assert.equal(cheque.operation, "RECEIPT");
  assert.equal(cheque.requestedPermission, "finance.cheque.receipt.create");
}

assert.equal(decideCollectionServerContract({
  collectionCommand: { ...base, companyId: "company-2" }
}, scope).allowed, false);

const endorse = decideInstrumentTransitionServerContract({ instrumentTransitionCommand: {
  ...scope,
  operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  instrumentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  instrumentType: "CHEQUE",
  fromState: "PORTFOLIO",
  toState: "ENDORSED",
  counterpartyId: "supplier-1",
  counterpartyType: "SUPPLIER"
} }, scope);
assert.equal(endorse.allowed, true);
if (endorse.allowed) {
  assert.equal(endorse.operation, "ISSUE");
  assert.equal(endorse.requestedPermission, "finance.cheque.issue.create");
}

console.log("[PASS] finance collection server contract");
