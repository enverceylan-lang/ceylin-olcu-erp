import assert from "node:assert/strict";

import {
  buildFinanceSaleReturnWorkflowSourceRow,
  buildFinanceSaleWorkflowSourceRow
} from "../src/lib/finance/financeWorkflowSourcePayload";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

assert.deepEqual(
  buildFinanceSaleWorkflowSourceRow({
    ...scope,
    saleId: "sale-1",
    customerId: "customer-1",
    totalAmount: 100,
    currency: "try",
    approvedByUserId: "user-1",
    approvedAt: "2026-07-31T10:00:00+03:00",
    sourceVersion: 1,
    payloadHash: "hash-sale-1"
  }),
  {
    tenant_id: "tenant-1",
    company_id: "company-1",
    branch_id: "branch-1",
    accounting_period_id: "period-1",
    sale_id: "sale-1",
    customer_id: "customer-1",
    status: "ONAYLANDI",
    total_amount: 100,
    currency: "TRY",
    approved_by_user_id: "user-1",
    approved_at: "2026-07-31T07:00:00.000Z",
    source_version: 1,
    payload_hash: "hash-sale-1"
  }
);

assert.deepEqual(
  buildFinanceSaleReturnWorkflowSourceRow({
    ...scope,
    saleReturnId: "return-1",
    saleId: "sale-1",
    customerId: "customer-1",
    amount: 40,
    currency: "TRY",
    actorUserId: "user-1",
    approvedAt: "2026-07-31T11:00:00.000Z",
    sourceVersion: 1,
    payloadHash: "hash-return-1"
  }),
  {
    tenant_id: "tenant-1",
    company_id: "company-1",
    branch_id: "branch-1",
    accounting_period_id: "period-1",
    sale_return_id: "return-1",
    sale_id: "sale-1",
    customer_id: "customer-1",
    status: "ONAYLANDI",
    amount: 40,
    currency: "TRY",
    actor_user_id: "user-1",
    approved_at: "2026-07-31T11:00:00.000Z",
    source_version: 1,
    payload_hash: "hash-return-1"
  }
);

assert.throws(
  () =>
    buildFinanceSaleWorkflowSourceRow({
      ...scope,
      saleId: "sale-1",
      customerId: "customer-1",
      totalAmount: 0,
      currency: "TRY",
      approvedByUserId: "user-1",
      approvedAt: "2026-07-31T10:00:00.000Z",
      sourceVersion: 1,
      payloadHash: "hash"
    }),
  /TOTAL_AMOUNT_INVALID/
);

assert.throws(
  () =>
    buildFinanceSaleReturnWorkflowSourceRow({
      ...scope,
      saleReturnId: "return-1",
      saleId: "sale-1",
      customerId: "customer-1",
      amount: 40,
      currency: "TL",
      actorUserId: "user-1",
      approvedAt: "2026-07-31T11:00:00.000Z",
      sourceVersion: 1,
      payloadHash: "hash"
    }),
  /CURRENCY_INVALID/
);

console.log(
  "financeWorkflowSourcePayloadSuite: PASS"
);