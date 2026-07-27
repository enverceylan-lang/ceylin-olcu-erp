import assert from "node:assert/strict";
import {
  resolveFinanceChannelPermission,
} from "../src/lib/finance/financeChannelPermissions";

function permission(
  channel: string,
  operation: string,
  direction: string = "CREATE",
): string | null {
  return resolveFinanceChannelPermission({
    channel,
    operation,
    direction,
  })?.permission || null;
}

assert.equal(
  permission("CASH", "COLLECTION"),
  "finance.cash.collection.create",
);
assert.equal(
  permission("CASH", "PAYMENT"),
  "finance.cash.payment.create",
);
assert.equal(
  permission("BANK", "COLLECTION"),
  "finance.bank.collection.create",
);
assert.equal(
  permission("BANK", "PAYMENT"),
  "finance.bank.payment.create",
);
assert.equal(
  permission("POS", "COLLECTION"),
  "finance.pos.collection.create",
);
assert.equal(
  permission("POS", "REFUND"),
  "finance.pos.refund.create",
);
assert.notEqual(
  permission("CHEQUE", "RECEIPT"),
  permission("CHEQUE", "ISSUE"),
);
assert.notEqual(
  permission("NOTE", "RECEIPT"),
  permission("NOTE", "ISSUE"),
);
assert.equal(
  permission("TRANSFER", "TRANSFER"),
  "finance.transfer.create",
);
assert.equal(permission("UNKNOWN", "COLLECTION"), null);
assert.equal(permission("CASH", "REFUND"), null);
assert.deepEqual(
  resolveFinanceChannelPermission({
    channel: "BANK",
    operation: "PAYMENT",
    direction: "REVERSE",
  }),
  resolveFinanceChannelPermission({
    channel: "BANK",
    operation: "PAYMENT",
    direction: "REVERSE",
  }),
);

console.log("[PASS] finance channel permissions (12 required scenarios)");
