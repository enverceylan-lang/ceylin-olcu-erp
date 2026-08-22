import assert from "node:assert/strict";

import {
  canApproveSale,
  canApproveSpecificSale
} from "../src/lib/saleApprovalAccess";
import type {
  MockUser
} from "../src/store/useAuthStore";

function user(
  overrides: Partial<MockUser>
): MockUser {
  return {
    id: "user-1",
    name: "Test User",
    username: "test",
    role: "OFFICE",
    isActive: true,
    permissions: [],
    ...overrides
  };
}

assert.equal(
  canApproveSale(
    user({ role: "ADMIN" })
  ),
  true
);

assert.equal(
  canApproveSale(
    user({ role: "COMPANY_ADMIN" })
  ),
  true
);

assert.equal(
  canApproveSale(
    user({ role: "OFFICE" })
  ),
  false
);

assert.equal(
  canApproveSale(
    user({
      role: "OFFICE",
      permissions: ["SALE_APPROVE"]
    })
  ),
  true
);

assert.equal(
  canApproveSale(
    user({
      role: "OFFICE",
      permissions: ["SALE_APPROVE"],
      isActive: false
    })
  ),
  false
);

const approver = user({
  id: "approver-1",
  role: "ADMIN"
});

assert.equal(
  canApproveSpecificSale(
    approver,
    {
      createdByUserId: "maker-1"
    }
  ),
  true
);

assert.equal(
  canApproveSpecificSale(
    approver,
    {
      createdByUserId: "approver-1"
    }
  ),
  true
);

assert.equal(
  canApproveSpecificSale(
    approver,
    {}
  ),
  true
);

console.log(
  "saleApprovalAccessSuite: PASS"
);