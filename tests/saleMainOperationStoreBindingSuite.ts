import assert from "node:assert/strict";
import {
  syncMainOperationFromSale
} from "../src/lib/saleMainOperationService";
import type { Sale } from "../src/store/salesStore";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const customer = {
  id: "customer-1",
  name: "Test Cari",
  phone: "05000000000",
  address: "Test Adres"
};

const sale: Sale = {
  ...scope,
  id: "sale-store-1",
  saleNo: "SAT-STORE-1",
  customerId: customer.id,
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

assert.equal(
  replay.state.operations.length,
  1
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
    "2026-07-28T20:15:00.000Z"
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
  updated.state.agendaEvents.length,
  1
);

assert.equal(
  updated.operation.details.length,
  2
);

console.log(
  "SALE_MAIN_OPERATION_STORE_BINDING_TEST: PAK"
);
