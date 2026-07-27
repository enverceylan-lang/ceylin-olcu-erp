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

console.log("[PASS] finance role defaults (10 required scenarios)");
