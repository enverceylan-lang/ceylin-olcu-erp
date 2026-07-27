import assert from "node:assert/strict";
import {
  FINANCE_PERMISSION_ORDER,
  getFinanceRoleDefaults,
} from "../src/lib/finance/financeRoleDefaults";

assert.deepEqual(getFinanceRoleDefaults("ADMIN"), FINANCE_PERMISSION_ORDER);
assert.equal(
  getFinanceRoleDefaults("ACCOUNTING").includes("finance.account.manage"),
  false,
);
assert.equal(
  getFinanceRoleDefaults("OFFICE").includes("finance.payment.create"),
  false,
);
assert.equal(
  getFinanceRoleDefaults("OFFICE").includes("finance.collection.reverse"),
  false,
);
assert.equal(
  getFinanceRoleDefaults("OFFICE").includes("finance.transfer.create"),
  false,
);
assert.deepEqual(getFinanceRoleDefaults("SALES"), ["customerFinance.view"]);
assert.deepEqual(getFinanceRoleDefaults("MODERATOR"), []);
assert.deepEqual(getFinanceRoleDefaults("FIELD"), []);
assert.deepEqual(getFinanceRoleDefaults("TAILOR"), []);
assert.deepEqual(getFinanceRoleDefaults("INSTALLER"), []);
assert.deepEqual(getFinanceRoleDefaults("PLATFORM_SUPER_ADMIN"), []);
assert.deepEqual(getFinanceRoleDefaults("UNKNOWN"), []);
const office = getFinanceRoleDefaults("OFFICE");
assert.equal(office.includes("finance.cash.collection.create"), true);
assert.equal(office.includes("finance.cash.payment.create"), false);
assert.equal(office.includes("finance.bank.collection.create"), true);
assert.equal(office.includes("finance.bank.payment.create"), false);
assert.equal(office.includes("finance.pos.collection.create"), true);
assert.equal(office.includes("finance.pos.refund.create"), false);
assert.equal(
  getFinanceRoleDefaults("SALES").some((permission) =>
    permission.includes(".collection."),
  ),
  false,
);
const accounting = getFinanceRoleDefaults("ACCOUNTING");
assert.equal(accounting.includes("finance.cash.collection.create"), true);
assert.equal(accounting.includes("finance.bank.payment.create"), true);

console.log("[PASS] finance role defaults (Aşama 5 + 10 channel scenarios)");
