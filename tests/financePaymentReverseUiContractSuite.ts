import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  "src/components/finance/PaymentWorkspace.tsx",
  "utf8",
);

assert.match(workspace, /finance\.cash\.payment\.reverse/);
assert.match(workspace, /finance\.bank\.payment\.reverse/);
assert.match(workspace, /\/api\/finance\/payments\/history\?channel=/);
assert.match(workspace, /reversalTargetId/);
assert.match(workspace, /action:\s*"REVERSE"/);
assert.match(workspace, /kind:\s*"PAYMENT"/);
assert.match(workspace, /reversalOfTransactionId:\s*payment\.reversalTargetId/);
assert.match(workspace, /payment\.reversed/);
assert.match(workspace, /Ters kayıt/);
assert.match(workspace, /PAYMENT_REVERSAL:/);
assert.doesNotMatch(workspace, /reversalOfTransactionId:\s*crypto\.randomUUID/);

console.log("FINANCE_PAYMENT_REVERSE_UI_CONTRACT: PAK");
