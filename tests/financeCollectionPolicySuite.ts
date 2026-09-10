import assert from "node:assert/strict";
import {
  defaultCollectionDescription,
  validateCreateCollectionCommand,
  validateReverseCollectionCommand,
  validateTransitionReceivableInstrumentCommand
} from "../src/lib/finance/collectionPolicy";
import type { CreateCollectionCommand } from "../src/lib/finance/collectionContracts";

const base: CreateCollectionCommand = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  operationId: "11111111-1111-4111-8111-111111111111",
  idempotencyKey: "22222222-2222-4222-8222-222222222222",
  channel: "CASH",
  customerId: "customer-1",
  amount: 100,
  currency: "TRY",
  cashAccountId: "33333333-3333-4333-8333-333333333333"
};

assert.deepEqual(validateCreateCollectionCommand(base), { ok: true, reason: null });
assert.equal(validateCreateCollectionCommand({ ...base, amount: 0 }).reason, "FINANCE_COLLECTION_AMOUNT_INVALID");
assert.equal(validateCreateCollectionCommand({ ...base, cashAccountId: "x" }).reason, "FINANCE_COLLECTION_CASH_ACCOUNT_UUID_REQUIRED");

const cheque: CreateCollectionCommand = {
  ...base,
  channel: "CHEQUE",
  cashAccountId: null,
  instrument: {
    instrumentNumber: "CHK-1",
    dueDate: "2026-09-15",
    drawerName: "ABC Tekstil",
    bankName: "Garanti BBVA"
  }
};
assert.deepEqual(validateCreateCollectionCommand(cheque), { ok: true, reason: null });
assert.equal(
  validateCreateCollectionCommand({ ...cheque, instrument: { ...cheque.instrument!, bankName: "" } }).reason,
  "FINANCE_COLLECTION_CHEQUE_BANK_REQUIRED"
);

assert.equal(defaultCollectionDescription("CASH", "Merkez Kasa"), "Nakit tahsilat – Merkez Kasa");
assert.equal(defaultCollectionDescription("BANK", "Garanti BBVA"), "Garanti BBVA – EFT/Havale tahsilatı");
assert.equal(defaultCollectionDescription("POS", "Garanti POS"), "Kredi kartı ile tahsilat – Garanti POS");

assert.deepEqual(validateReverseCollectionCommand({
  tenantId: "tenant-1", companyId: "company-1", branchId: "branch-1", accountingPeriodId: "period-1",
  operationId: "44444444-4444-4444-8444-444444444444",
  idempotencyKey: "55555555-5555-4555-8555-555555555555",
  reversalOfOperationId: "66666666-6666-4666-8666-666666666666",
  channel: "CASH", reason: "Hatalı tahsilat"
}), { ok: true, reason: null });

assert.deepEqual(validateTransitionReceivableInstrumentCommand({
  tenantId: "tenant-1", companyId: "company-1", branchId: "branch-1", accountingPeriodId: "period-1",
  operationId: "77777777-7777-4777-8777-777777777777",
  idempotencyKey: "88888888-8888-4888-8888-888888888888",
  instrumentId: "99999999-9999-4999-8999-999999999999",
  instrumentType: "CHEQUE", fromState: "DEPOSITED", toState: "COLLECTED",
  bankAccountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
}), { ok: true, reason: null });

console.log("[PASS] finance collection policy");
