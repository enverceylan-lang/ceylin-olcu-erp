import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decideOpeningBalanceServerContract } from "../src/lib/finance/openingBalanceContracts";

const allowed = decideOpeningBalanceServerContract({
  openingBalanceCommand: {
    tenantId: "t",
    companyId: "c",
    branchId: "b",
    accountingPeriodId: "p",
    customerId: "customer-1",
    direction: "RECEIVABLE",
    amount: 123.45,
    currency: "TRY",
    openingDate: "2026-01-01",
    dueDate: "2026-02-01",
    sourceDocumentId: "DEVIR-1",
    sourceDocumentType: "OPENING_BALANCE",
    description: null,
  },
});
assert.equal(allowed.allowed, true);
if (allowed.allowed) {
  assert.equal(allowed.command.operationId, "OPENING_BALANCE:DEVIR-1");
  assert.equal(allowed.command.idempotencyKey, "OPENING_BALANCE:DEVIR-1");
}

assert.equal(
  decideOpeningBalanceServerContract({
    openingBalanceCommand: {
      customerId: "c",
      direction: "RECEIVABLE",
      amount: 1.001,
      currency: "TRY",
      openingDate: "2026-01-01",
      sourceDocumentId: "X",
    },
  }).allowed,
  false,
);

assert.equal(
  decideOpeningBalanceServerContract({
    openingBalanceCommand: {
      customerId: "c",
      direction: "PAYABLE",
      amount: 10,
      currency: "EUR",
      openingDate: "2026-01-01",
      sourceDocumentId: "X",
    },
  }).allowed,
  false,
);

const readContract = readFileSync(
  resolve(process.cwd(), "src/lib/finance/customerReceivableReadContracts.ts"),
  "utf8",
);
assert.match(readContract, /saleId:\s*string\s*\|\s*null/);
assert.match(readContract, /sourceType:\s*CustomerReceivableSourceType/);
assert.match(readContract, /sourceDocumentId:\s*string/);
assert.match(readContract, /saleId:\s*nullableText\(/);

const payable = readFileSync(
  resolve(process.cwd(), "src/lib/counterpartyPayableService.ts"),
  "utf8",
);
assert.match(payable, /\|\s*"CUSTOMER"/);

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/finance/operations/route.ts"),
  "utf8",
);
assert.match(route, /type PaymentCounterpartyType[\s\S]*"CUSTOMER"/);
assert.match(route, /value === "CUSTOMER"/);

const paymentUi = readFileSync(
  resolve(process.cwd(), "src/components/finance/PaymentWorkspace.tsx"),
  "utf8",
);
assert.match(paymentUi, /cariType:\s*"CUSTOMER"\s*\|/);
assert.match(paymentUi, /data\.counterparties[\s\S]*data\.customers/);

const panel = readFileSync(
  resolve(process.cwd(), "src/components/finance/FinanceOperationsPanel.tsx"),
  "utf8",
);
assert.match(panel, /OpeningBalanceWorkspace/);
assert.match(panel, /Devir \/ A\\u00e7\\u0131l\\u0131\\u015f/);

console.log("FINANCE_OPENING_BALANCE_CONTRACT: PAK");
