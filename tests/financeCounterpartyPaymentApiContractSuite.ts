import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/finance/operations/route.ts"),
  "utf8",
);

assert.match(route, /verifyAuth\(request\)/);
assert.match(route, /readRequestedErpScopeId\(request\)/);
assert.match(route, /loadShadowErpContext\(/);
assert.match(route, /guardServerFinanceChannelAccess\(\{/);
assert.match(route, /decideFinanceServerOperationContract\(body,\s*context\.scope\)/);

assert.match(
  route,
  /persistFinanceCounterpartyPaymentV1\(/,
);
assert.match(
  route,
  /persist_finance_counterparty_payment_v1|FinanceCounterpartyPaymentRpcClient/,
);

assert.match(
  route,
  /serverOperation\.kind === "PAYMENT"[\s\S]*serverOperation\.channel === "CASH" \|\|[\s\S]*serverOperation\.channel === "BANK"[\s\S]*serverOperation\.action === "CREATE"/,
);

assert.match(route, /counterpartyType/);
assert.match(route, /SUPPLIER/);
assert.match(route, /TAILOR/);
assert.match(route, /INSTALLER/);

assert.match(
  route,
  /movementId:\s*`\$\{serverOperation\.operationId\}:PAYABLE`/,
);
assert.match(
  route,
  /idempotencyKey:\s*`\$\{serverOperation\.idempotencyKey\}:PAYABLE`/,
);
assert.match(
  route,
  /sourcePaymentId:\s*serverOperation\.operationId/,
);

assert.match(
  route,
  /recordedAt:\s*serverOperation\.occurredAt/,
);

assert.match(
  route,
  /FINANCE_COUNTERPARTY_PAYMENT_ATOMIC_AUTHORITY_REQUIRED/,
);

assert.match(
  route,
  /stableFinanceOperationHash\(serverOperation\)/,
);

assert.match(
  route,
  /result\.outcome === "CONFLICT"/,
);
assert.match(
  route,
  /result\.outcome === "REJECT"/,
);

console.log("FINANCE_COUNTERPARTY_PAYMENT_API_CONTRACT: PAK");
