import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  resolveMechanicalOrderQuantity
} from "../src/lib/saleApprovalMechanicalProcurement";

const root = process.cwd();

function read(
  relativePath: string
): string {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

test(
  "mechanical quantity uses commercial metricSize x quantity and preserves unit",
  () => {
    assert.deepEqual(
      resolveMechanicalOrderQuantity({
        metricSize: 2.4,
        quantity: 3,
        metricUnit: "m2",
      }),
      {
        quantity: 7.2,
        unit: "m2",
      },
    );

    assert.deepEqual(
      resolveMechanicalOrderQuantity({
        metricSize: 1,
        quantity: 4,
        metricUnit: "adet",
      }),
      {
        quantity: 4,
        unit: "adet",
      },
    );
  },
);

test(
  "invalid mechanical quantity is rejected",
  () => {
    assert.equal(
      resolveMechanicalOrderQuantity({
        metricSize: 0,
        quantity: 1,
        metricUnit: "m2",
      }),
      null,
    );
  },
);

test(
  "supplier order model keeps unit legacy default but requires explicit purpose",
  () => {
    const source = read(
      "src/lib/supplierSupplyFlow.ts",
    );

    assert.match(
      source,
      /orderedUnit\?: SupplierOrderUnit/,
    );

    assert.match(
      source,
      /purpose: SupplierOrderPurpose/,
    );

    assert.doesNotMatch(
      source,
      /purpose\?: SupplierOrderPurpose/,
    );

    assert.match(
      source,
      /request\.orderedUnit \?\? "mt"/,
    );

    assert.doesNotMatch(
      source,
      /request\.purpose \?\? "TAILOR_MATERIAL"/,
    );
  },
);

test(
  "tailor supplier order is explicitly meter material",
  () => {
    const source = read(
      "src/lib/saleSupplyFulfillmentOrchestrator.ts",
    );

    assert.match(
      source,
      /orderedUnit: "mt"/,
    );

    assert.match(
      source,
      /"TAILOR_MATERIAL"/,
    );
  },
);

test(
  "mechanical procurement uses stock default supplier and does not create tailor plan",
  () => {
    const source = read(
      "src/lib/saleApprovalMechanicalProcurement.ts",
    );

    assert.match(
      source,
      /"SUPPLIER_MECHANICAL"/,
    );

    assert.match(
      source,
      /defaultSupplierCustomerId/,
    );

    assert.match(
      source,
      /"MECHANICAL_PRODUCT"/,
    );

    assert.doesNotMatch(
      source,
      /savePlansAtomically/,
    );

    assert.doesNotMatch(
      source,
      /buildProductionSourcePlansFromFulfillment/,
    );
  },
);

test(
  "both approval screens invoke mechanical procurement",
  () => {
    assert.match(
      read("src/app/satis/page.tsx"),
      /executeSaleApprovalOperations/,
    );

    assert.match(
      read("src/app/satis\/[id]\/page.tsx"),
      /executeSaleApprovalOperations/,
    );
  },
);