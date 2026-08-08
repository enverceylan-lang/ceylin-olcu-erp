import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveOperationReleaseProjection
} from "../src/lib/operationReleaseContextResolver";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
const operation: OperationRecord = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  id: "op-tailor-1",
  idempotencyKey: "op-tailor-1",
  kind: "TAILOR",
  sourceId: "sale-1",
  saleId: "sale-1",
  customerId: "customer-1",
  customerName: "Müşteri",
  title: "Terzi işi",
  details: [],
  scheduledAt: "2026-08-08T09:00:00.000Z",
  dueAt: "2026-08-09T09:00:00.000Z",
  status: "ACCEPTED",
  createdByUserId: "admin-1",
  createdAt: "2026-08-08T08:00:00.000Z",
  updatedAt: "2026-08-08T08:00:00.000Z"
};

const productionItem = {
  id: "prod-1",
  orderId: "sale-1",
  saleLineId: "line-1"
};

{
  const waiting = resolveOperationReleaseProjection({
    operation,
    productionItems: [productionItem],
    sourcePlans: []
  });

  assert.equal(waiting.label, "BEKLIYOR");
  assert.equal(waiting.decision?.released, false);
  assert.ok(waiting.context?.release);
}

{
  const resolverSource = readFileSync(
    new URL(
      "../src/lib/operationReleaseContextResolver.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    resolverSource,
    /readiness\.status === "READY"/
  );
  assert.match(
    resolverSource,
    /state: "SATISFIED"/
  );
  assert.match(
    resolverSource,
    /label: "SERBEST"/
  );
}

{
  const nonTailor = resolveOperationReleaseProjection({
    operation: {
      ...operation,
      id: "op-install-1",
      kind: "INSTALLATION"
    },
    productionItems: [],
    sourcePlans: []
  });

  assert.equal(nonTailor.label, "SERBEST");
  assert.equal(nonTailor.context, undefined);
}

console.log("OPERATION_RELEASE_CONTEXT_RESOLVER_TEST: PAK");