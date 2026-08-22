import assert from "node:assert/strict";
import {
  assertSaleAuthorityScope,
  assertSaleDraftAuthorityInput,
  assertSaleReturnAuthorityInput,
  canServerApproveSale,
} from "../src/lib/salesServerAuthorityContracts";

const scope = {
  tenantId: "t1",
  companyId: "c1",
  branchId: "b1",
  accountingPeriodId: "p1",
};

assert.doesNotThrow(() =>
  assertSaleAuthorityScope(scope, scope),
);

assert.throws(() =>
  assertSaleAuthorityScope(
    { ...scope, companyId: "other" },
    scope,
  ),
);

assert.equal(
  canServerApproveSale({
    role: "ADMIN",
    isActive: true,
    permissions: [],
  }),
  true,
);

assert.equal(
  canServerApproveSale({
    role: "OFFICE",
    isActive: true,
    permissions: ["SALE_APPROVE"],
  }),
  true,
);

assert.equal(
  canServerApproveSale({
    role: "OFFICE",
    isActive: true,
    permissions: [],
  }),
  false,
);

assert.doesNotThrow(() =>
  assertSaleDraftAuthorityInput({
    ...scope,
    saleId: "sale-1",
    customerId: "cust-1",
    status: "TASLAK",
    totalAmount: 0,
    currency: "TRY",
    payloadHash: "hash",
  }),
);

assert.doesNotThrow(() =>
  assertSaleReturnAuthorityInput({
    ...scope,
    action: "START",
    saleReturnId: "return-1",
    saleId: "sale-1",
    customerId: "cust-1",
    idempotencyKey: "idem-1",
    payloadHash: "hash",
    amount: 10,
    currency: "TRY",
    occurredAt: new Date().toISOString(),
  }),
);

console.log("PAK: sales server authority contracts");