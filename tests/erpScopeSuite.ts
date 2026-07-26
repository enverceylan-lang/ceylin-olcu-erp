import assert from "node:assert/strict";
import {
  erpScopeKey,
  erpScopeMatches,
  validateErpScope,
  type ErpScope,
} from "../src/lib/erpScope";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

assert.deepEqual(validateErpScope(scope), {
  valid: true,
  missingFields: [],
});
assert.deepEqual(validateErpScope({ ...scope, branchId: " " }), {
  valid: false,
  missingFields: ["branchId"],
});
assert.equal(erpScopeMatches(scope, { ...scope }), true);
assert.equal(
  erpScopeMatches(scope, { ...scope, accountingPeriodId: "period-2" }),
  false
);
assert.equal(
  erpScopeKey(scope),
  "tenant-1|company-1|branch-1|period-1"
);
assert.throws(
  () => erpScopeKey({ ...scope, tenantId: "" }),
  /ERP kapsamı eksik/
);

console.log("[PASS] ERP scope");
