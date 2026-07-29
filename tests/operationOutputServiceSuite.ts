import assert from "node:assert/strict";
import {
  buildOperationPrintHtml,
  buildOperationWhatsAppUrl,
  getOperationKindLabel,
  getOperationStatusLabel
} from "../src/lib/operationOutputService";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";

const operation: OperationRecord = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",

  id: "operation-1",
  idempotencyKey:
    "TAILOR:sale-1:tailor-1",

  kind: "TAILOR",
  sourceId: "sale-1",
  saleId: "sale-1",

  customerId: "customer-1",
  customerName: "Ali & Ayşe <Test>",
  address: "Örnek Adres",

  title: "Salon Tül Dikimi",
  details: [
    "Salon — Tül — 300 × 260 cm"
  ],

  party: {
    id: "tailor-1",
    name: "Hasan Terzi",
    phone: "+90 (555) 111 22 33"
  },

  scheduledAt:
    "2026-07-28T09:00:00.000Z",
  dueAt:
    "2026-07-30T15:00:00.000Z",

  status: "ASSIGNED",

  createdByUserId: "admin-1",
  createdAt:
    "2026-07-28T08:00:00.000Z",
  updatedAt:
    "2026-07-28T08:00:00.000Z"
};

assert.equal(
  getOperationKindLabel(operation),
  "TERZİ İŞ EMRİ"
);

assert.equal(
  getOperationStatusLabel("IN_PROGRESS"),
  "İşleme Alındı"
);

const html =
  buildOperationPrintHtml(operation);

assert.match(
  html,
  /TERZİ İŞ EMRİ/
);

assert.match(
  html,
  /Ali &amp; Ayşe &lt;Test&gt;/
);

assert.doesNotMatch(
  html,
  /undefined/
);

const whatsappUrl =
  buildOperationWhatsAppUrl(operation);

assert.match(
  whatsappUrl,
  /^https:\/\/wa\.me\/905551112233\?text=/
);

assert.match(
  decodeURIComponent(whatsappUrl),
  /Örnek Müşteri|Ali & Ayşe/
);

console.log(
  "OPERATION_OUTPUT_SERVICE_TEST: PAK"
);