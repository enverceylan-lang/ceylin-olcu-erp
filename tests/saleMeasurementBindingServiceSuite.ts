import assert from "node:assert/strict";
import {
  collectActiveSaleMeasurementIds,
  decideMeasurementSaleBinding,
  getUnboundMeasurementsForCustomer,
  validateMeasurementSelection
} from "../src/lib/saleMeasurementBindingService";

const measurements = [
  {
    id: "measurement-1",
    customerId: "customer-1",
    createdAt:
      "2026-07-20T10:00:00.000Z"
  },
  {
    id: "measurement-2",
    customerId: "customer-1",
    createdAt:
      "2026-07-21T10:00:00.000Z"
  },
  {
    id: "measurement-3",
    customerId: "customer-2",
    createdAt:
      "2026-07-22T10:00:00.000Z"
  },
  {
    id: "measurement-4",
    customerId: "customer-1",
    isArchived: true,
    createdAt:
      "2026-07-23T10:00:00.000Z"
  }
];

const sales = [
  {
    id: "sale-1",
    customerId: "customer-1",
    status: "TASLAK",
    items: [
      {
        measurementId:
          "measurement-1"
      }
    ]
  },
  {
    id: "sale-2",
    customerId: "customer-1",
    status: "IPTAL_EDILDI",
    items: [
      {
        measurementId:
          "measurement-2"
      }
    ]
  },
  {
    id: "sale-3",
    customerId: "customer-2",
    status: "ONAYLANDI",
    items: [
      {
        measurementId:
          "measurement-3,measurement-extra"
      }
    ]
  }
];

const linkedIds =
  collectActiveSaleMeasurementIds(
    sales
  );

assert.equal(
  linkedIds.has("measurement-1"),
  true
);

assert.equal(
  linkedIds.has("measurement-2"),
  false
);

assert.equal(
  linkedIds.has("measurement-extra"),
  true
);

const available =
  getUnboundMeasurementsForCustomer(
    "customer-1",
    measurements,
    sales
  );

assert.deepEqual(
  available.map(item => item.id),
  ["measurement-2"]
);

assert.deepEqual(
  decideMeasurementSaleBinding(
    "customer-1",
    "measurement-1",
    measurements,
    sales
  ),
  {
    allowed: false,
    measurementId:
      "measurement-1",
    customerId: "customer-1",
    reason:
      "ALREADY_LINKED_TO_ACTIVE_SALE"
  }
);

assert.deepEqual(
  decideMeasurementSaleBinding(
    "customer-1",
    "measurement-2",
    measurements,
    sales
  ),
  {
    allowed: true,
    measurementId:
      "measurement-2",
    customerId: "customer-1",
    reason: "AVAILABLE"
  }
);

assert.deepEqual(
  decideMeasurementSaleBinding(
    "customer-1",
    "measurement-3",
    measurements,
    sales
  ),
  {
    allowed: false,
    measurementId:
      "measurement-3",
    customerId: "customer-1",
    reason:
      "CUSTOMER_MISMATCH"
  }
);

const selection =
  validateMeasurementSelection(
    "customer-1",
    [
      "measurement-2",
      "measurement-2",
      "measurement-4"
    ],
    measurements,
    sales
  );

assert.equal(
  selection.length,
  2
);

assert.equal(
  selection[0].allowed,
  true
);

assert.equal(
  selection[1].reason,
  "MEASUREMENT_ARCHIVED"
);

console.log(
  "SALE_MEASUREMENT_BINDING_TEST: PAK"
);