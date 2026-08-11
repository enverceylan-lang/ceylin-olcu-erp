import assert from "node:assert/strict";
import {
  buildMainOperationFromSale,
  syncMainOperationFromSale
} from "../src/lib/saleMainOperationService";
import type { Sale } from "../src/store/salesStore";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const sale: Sale = {
  ...scope,
  id: "sale-1",
  saleNo: "SAT-0001",
  customerId: "customer-1",
  createdByUserId: "admin-1",
  createdByUsername: "admin",
  createdByName: "Admin",
  status: "SİPARİŞ",
  items: [
    {
      id: "item-1",
      measurementId: "measurement-1",
      roomName: "Salon",
      windowName: "Pencere",
      productType: "Tül",
      productGroup: "Perde",
      width: 300,
      height: 250,
      calcWidth: 300,
      calcHeight: 250,
      quantity: 1,
      metricSize: 9,
      metricUnit: "mt",
      unitPrice: 100,
      discount: 0,
      rowTotal: 900
    }
  ],
  priceSource: "MANUAL",
  totalAmount: 900,
  cashPrice: 900,
  installmentPrice: 900,
  discount: 0,
  downPayment: 0,
  remainingBalance: 900,
  createdAt:
    "2026-07-28T20:00:00.000Z",
  updatedAt:
    "2026-07-28T20:05:00.000Z"
};

const customer = {
  id: "customer-1",
  name: "Ahmet Yılmaz",
  phone: "05000000000",
  address: "İstanbul"
};

const operation =
  buildMainOperationFromSale({
    scope,
    sale,
    customer,
    createdByUserId: "admin-1"
  });

assert.equal(
  operation.kind,
  "GENERAL"
);

assert.equal(
  operation.status,
  "DRAFT"
);

assert.equal(
  operation.id,
  "general-operation:sale-1"
);

assert.equal(
  operation.idempotencyKey,
  "GENERAL:sale-1"
);

const created =
  syncMainOperationFromSale(
    {
      operations: [],
      agendaEvents: []
    },
    {
      scope,
      sale,
      customer,
      createdByUserId: "admin-1"
    }
  );

assert.equal(
  created.outcome,
  "CREATED"
);

assert.equal(
  created.state.operations.length,
  1
);

assert.equal(
  created.state.agendaEvents.length,
  1
);

const replay =
  syncMainOperationFromSale(
    created.state,
    {
      scope,
      sale,
      customer,
      createdByUserId: "admin-1"
    }
  );

assert.equal(
  replay.outcome,
  "UNCHANGED"
);

const changedSale: Sale = {
  ...sale,
  items: [
    ...sale.items,
    {
      ...sale.items[0],
      id: "item-2",
      productType: "Fon",
      rowTotal: 500
    }
  ],
  updatedAt:
    "2026-07-28T20:10:00.000Z"
};

const updated =
  syncMainOperationFromSale(
    created.state,
    {
      scope,
      sale: changedSale,
      customer,
      createdByUserId: "admin-1"
    }
  );

assert.equal(
  updated.outcome,
  "UPDATED"
);

assert.equal(
  updated.state.operations.length,
  1
);

assert.equal(
  updated.operation.details.length,
  2
);

assert.equal(
  updated.operation.status,
  "DRAFT"
);

console.log(
  "SALE_MAIN_OPERATION_SERVICE_TEST: PAK"
);
