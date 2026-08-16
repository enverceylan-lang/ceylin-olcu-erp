import assert from "node:assert/strict";
import type {
  FinanceOperationChannel,
  FinanceOperationKind,
  FinanceInstrumentState
} from "../src/lib/finance/financeOperationsContracts";

const kinds: FinanceOperationKind[] = [
  "COLLECTION",
  "PAYMENT",
  "TRANSFER",
  "REVERSAL",
  "REFUND"
];

const channels: FinanceOperationChannel[] = [
  "CASH",
  "BANK",
  "POS",
  "CHEQUE",
  "NOTE",
  "TRANSFER"
];

const states: FinanceInstrumentState[] = [
  "PORTFOLIO",
  "ISSUED",
  "ENDORSED",
  "DEPOSITED",
  "COLLECTED",
  "PAID",
  "RETURNED",
  "CANCELLED"
];

assert.equal(kinds.length, 5);
assert.equal(channels.length, 6);
assert.equal(states.length, 8);

console.log("[PASS] Finance Operations V1 contracts");