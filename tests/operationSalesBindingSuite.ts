import assert from "node:assert/strict";
import {
  buildOperationDetailFromSaleItem,
  buildOperationFromSale
} from "../src/lib/operationSalesBinding";
import type {
  Sale,
  SaleItem
} from "../src/store/salesStore";

const item: SaleItem = {
  id: "item-1",
  roomName: "Salon",
  windowName: "Cephe",
  productType: "Tül",
  productGroup: "PERDE",
  width: 300,
  height: 260,
  calcWidth: 310,
  calcHeight: 258,
  productionWidthCm: 305,
  productionHeightCm: 256,
  quantity: 1,
  metricSize: 9.3,
  metricUnit: "mt",
  unitPrice: 100,
  discount: 0,
  rowTotal: 930,
  note: "Pileli"
};

const sale: Sale = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  id: "sale-1",
  saleNo: "SAT-0001",
  customerId: "customer-1",
  status: "ONAYLANDI",
  items: [item],
  priceSource: "MANUAL",
  totalAmount: 930,
  cashPrice: 930,
  installmentPrice: 930,
  discount: 0,
  downPayment: 0,
  remainingBalance: 930,
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z"
};

const detail =
  buildOperationDetailFromSaleItem(
    item
  );

assert.match(detail, /Salon/);
assert.match(detail, /Cephe/);
assert.match(detail, /305 × 256 cm/);
assert.match(detail, /9,3 mt/);
assert.match(detail, /Pileli/);

const operation =
  buildOperationFromSale({
    scope: {
      tenantId: "tenant-1",
      companyId: "company-1",
      branchId: "branch-1",
      accountingPeriodId: "period-1"
    },
    sale,
    customer: {
      id: "customer-1",
      name: "Örnek Müşteri",
      phone: "05551112233",
      address: "Örnek Adres"
    },
    kind: "TAILOR",
    party: {
      id: "tailor-1",
      name: "Hasan Terzi",
      phone: "05550000000"
    },
    scheduledAt:
      "2026-07-28T09:00",
    dueAt:
      "2026-07-30T17:00",
    notes: "Dikkatli dikim",
    createdByUserId: "admin-1",
    now:
      "2026-07-28T08:30:00.000Z",
    id: "operation-1"
  });

assert.equal(
  operation.kind,
  "TAILOR"
);

assert.equal(
  operation.saleId,
  "sale-1"
);

assert.equal(
  operation.customerName,
  "Örnek Müşteri"
);

assert.equal(
  operation.party?.id,
  "tailor-1"
);

assert.equal(
  operation.details.length,
  1
);

assert.equal(
  operation.status,
  "ASSIGNED"
);

assert.equal(
  operation.idempotencyKey,
  "TAILOR:sale-1:tailor-1"
);

const supplier =
  buildOperationFromSale({
    scope: {
      tenantId: "tenant-1",
      companyId: "company-1",
      branchId: "branch-1",
      accountingPeriodId: "period-1"
    },
    sale,
    customer: {
      id: "customer-1",
      name: "Örnek Müşteri",
      phone: "",
      address: ""
    },
    kind: "SUPPLIER",
    supplierName:
      "Örnek Tedarikçi",
    supplierPhone:
      "05552223344",
    scheduledAt:
      "2026-07-28T09:00",
    dueAt:
      "2026-07-30T17:00",
    createdByUserId: "admin-1",
    now:
      "2026-07-28T08:30:00.000Z",
    id: "operation-2"
  });

assert.equal(
  supplier.party?.name,
  "Örnek Tedarikçi"
);

assert.throws(
  () =>
    buildOperationFromSale({
      scope: {
        tenantId: "tenant-1",
        companyId: "company-1",
        branchId: "branch-1",
        accountingPeriodId: "period-1"
      },
      sale,
      customer: {
        id: "customer-1",
        name: "Örnek Müşteri",
        phone: "",
        address: ""
      },
      kind: "SUPPLIER",
      supplierName: "",
      scheduledAt:
        "2026-07-28T09:00",
      dueAt:
        "2026-07-30T17:00",
      createdByUserId: "admin-1",
      now:
        "2026-07-28T08:30:00.000Z",
      id: "operation-3"
    }),
  /OPERATION_SUPPLIER_REQUIRED/
);

console.log(
  "OPERATION_SALES_BINDING_TEST: PAK"
);
