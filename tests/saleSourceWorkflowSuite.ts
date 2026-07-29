import assert from "node:assert/strict";
import {
  getRiskTone,
  getSemanticStatusAppearance,
  normalizeRiskScore
} from "../src/lib/semanticStatusPalette";
import {
  buildSaleMeasurementBinding,
  canCreateAutomaticMainOperation,
  getSaleSourceLabel,
  saleSourceRequiresMeasurement,
  validateSaleSource
} from "../src/lib/saleSourceWorkflow";

const measurementSource = {
  sourceType: "MEASUREMENT" as const,
  customerId: "customer-1",
  measurementId: "measurement-1",
  createdByUserId: "admin-1",
  createdAt:
    "2026-07-28T22:30:00.000Z"
};

assert.deepEqual(
  validateSaleSource({
    documentType: "SALE",
    source: measurementSource
  }),
  {
    valid: true
  }
);

assert.deepEqual(
  validateSaleSource({
    documentType: "SALE",
    source: {
      ...measurementSource,
      measurementId: undefined
    }
  }),
  {
    valid: false,
    reason: "MEASUREMENT_REQUIRED"
  }
);

assert.deepEqual(
  validateSaleSource({
    documentType: "SERVICE_ORDER",
    source: {
      sourceType: "SERVICE",
      customerId: "customer-1",
      serviceRequestId: "service-1",
      createdByUserId: "admin-1",
      createdAt:
        "2026-07-28T22:30:00.000Z"
    }
  }),
  {
    valid: true
  }
);

assert.equal(
  saleSourceRequiresMeasurement(
    "MEASUREMENT"
  ),
  true
);

assert.equal(
  saleSourceRequiresMeasurement(
    "SALES_PREPARATION"
  ),
  true
);

assert.equal(
  saleSourceRequiresMeasurement(
    "MANUAL"
  ),
  false
);

assert.equal(
  getSaleSourceLabel(
    "SALES_PREPARATION"
  ),
  "Satışa Hazırlıktan Aktarıldı"
);

assert.equal(
  canCreateAutomaticMainOperation(
    measurementSource
  ),
  true
);

const binding =
  buildSaleMeasurementBinding({
    saleId: "sale-1",
    customerId: "customer-1",
    measurementId: "measurement-1",
    boundByUserId: "admin-1",
    boundAt:
      "2026-07-28T22:35:00.000Z",
    bindingSource:
      "MEASUREMENT_SELECTION"
  });

assert.equal(
  binding.measurementId,
  "measurement-1"
);

assert.equal(
  getRiskTone(0),
  "POSITIVE"
);

assert.equal(
  getRiskTone(35),
  "ATTENTION"
);

assert.equal(
  getRiskTone(55),
  "WARNING"
);

assert.equal(
  getRiskTone(90),
  "CRITICAL"
);

assert.equal(
  normalizeRiskScore(-20),
  0
);

assert.equal(
  normalizeRiskScore(140),
  100
);

assert.equal(
  getSemanticStatusAppearance(
    "CLOSED"
  ).label,
  "Tamamlandı / Teslim Edildi / Kapandı"
);

console.log(
  "SALE_SOURCE_WORKFLOW_TEST: PAK"
);