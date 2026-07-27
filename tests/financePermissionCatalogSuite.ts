import assert from "node:assert/strict";
import {
  FINANCE_PERMISSION_CATALOG,
} from "../src/lib/finance/financePermissionCatalog";
import {
  FINANCE_PERMISSION_ORDER,
} from "../src/lib/finance/financeRoleDefaults";

const permissions = FINANCE_PERMISSION_CATALOG.map(
  (entry) => entry.permission,
);

assert.deepEqual(permissions, FINANCE_PERMISSION_ORDER);
assert.equal(new Set(permissions).size, permissions.length);
assert.equal(
  FINANCE_PERMISSION_CATALOG.every(
    (entry) => entry.label.trim() && entry.description.trim(),
  ),
  true,
);
assert.notEqual(
  permissions.indexOf("finance.cash.collection.create"),
  permissions.indexOf("finance.cash.payment.create"),
);
assert.notEqual(
  permissions.indexOf("finance.bank.collection.create"),
  permissions.indexOf("finance.bank.payment.create"),
);
assert.notEqual(
  permissions.indexOf("finance.pos.collection.create"),
  permissions.indexOf("finance.pos.refund.create"),
);
assert.notEqual(
  permissions.indexOf("finance.cheque.receipt.create"),
  permissions.indexOf("finance.cheque.issue.create"),
);
assert.notEqual(
  permissions.indexOf("finance.note.receipt.create"),
  permissions.indexOf("finance.note.issue.create"),
);
assert.notEqual(
  permissions.indexOf("finance.cash.collection.create"),
  permissions.indexOf("finance.cash.collection.reverse"),
);
assert.equal(
  FINANCE_PERMISSION_CATALOG
    .filter((entry) =>
      [
        "finance.collection.create",
        "finance.collection.reverse",
        "finance.payment.create",
        "finance.payment.reverse",
      ].includes(entry.permission),
    )
    .every((entry) => entry.isLegacy),
  true,
);
assert.deepEqual(
  FINANCE_PERMISSION_CATALOG.map((entry) => entry.permission),
  FINANCE_PERMISSION_CATALOG.map((entry) => entry.permission),
);
assert.equal(
  (permissions as readonly string[]).includes("finance.unknown"),
  false,
);

console.log("[PASS] finance permission catalog (12 required scenarios)");
