import assert from "node:assert/strict";
import { applyPaymentToSale } from "../src/lib/salesFinance";
import type { Sale, SalePayment } from "../src/store/salesStore";

const payment: SalePayment = {
  id: "payment-1",
  amount: 200,
  paidAt: "2026-07-26",
  method: "NAKIT",
  receivedBy: "office-1",
};

const sale: Sale = {
  id: "sale-1",
  saleNo: "SAT-1",
  customerId: "customer-1",
  status: "ONAYLANDI",
  items: [],
  priceSource: "MANUAL",
  totalAmount: 1000,
  cashPrice: 1000,
  installmentPrice: 1000,
  discount: 0,
  downPayment: 0,
  remainingBalance: 800,
  payments: [payment],
  createdAt: "2026-07-26T09:00:00.000Z",
  updatedAt: "2026-07-26T09:10:00.000Z",
};

const replay = applyPaymentToSale(sale, { ...payment });
assert.equal(replay, sale);
assert.equal(replay.payments?.length, 1);

assert.throws(
  () => applyPaymentToSale(sale, { ...payment, amount: 250 }),
  /aynı tahsilat kimliği farklı içerikle kullanılamaz/i
);

console.log("[PASS] sales payment idempotency");
