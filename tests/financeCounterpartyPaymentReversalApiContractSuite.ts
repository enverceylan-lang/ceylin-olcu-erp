import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "src/app/api/finance/operations/route.ts",
  "utf8",
);

assert.match(
  route,
  /persistFinanceCounterpartyPaymentReversalV1/,
);
assert.match(
  route,
  /FinanceCounterpartyPaymentReversalRpcClient/,
);
assert.match(
  route,
  /serverOperation\.kind === "PAYMENT"[\s\S]*serverOperation\.channel === "CASH"[\s\S]*serverOperation\.channel === "BANK"[\s\S]*serverOperation\.action === "REVERSE"/,
);
assert.match(
  route,
  /persistFinanceCounterpartyPaymentReversalV1\([\s\S]*stableFinanceOperationHash\(serverOperation\)/,
);
assert.match(
  route,
  /FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_CONFLICT/,
);
assert.match(
  route,
  /FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_REJECTED/,
);
assert.match(
  route,
  /FINANCE_COUNTERPARTY_PAYMENT_ATOMIC_AUTHORITY_REQUIRED/,
);

const reversePos = route.indexOf("const atomicCounterpartyPaymentReverse");
const createPos = route.indexOf("const atomicCounterpartyPayment =");
assert.ok(reversePos >= 0 && createPos >= 0 && reversePos < createPos);

console.log("FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_API_CONTRACT: PAK");