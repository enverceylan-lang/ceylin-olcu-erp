import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

const sourcePath =
  "src/components/operations/MaterialCutDecisionPanel.tsx";

test(
  "supplier receipt UI imports both receipt coordinators",
  async () => {
    const source =
      await readFile(
        sourcePath,
        "utf8"
      );

    assert.match(
      source,
      /executeSupplierReceiptToProduction/
    );

    assert.match(
      source,
      /executeMechanicalSupplierReceiptToInstallation/
    );
  }
);

test(
  "mechanical receipt requires explicit mechanical purpose and no fallback",
  async () => {
    const source =
      await readFile(
        sourcePath,
        "utf8"
      );

    assert.match(
      source,
      /order\.purpose ===\s*"MECHANICAL_PRODUCT"/
    );

    assert.doesNotMatch(
      source,
      /order\.purpose \?\?\s*"TAILOR_MATERIAL"/
    );
  }
);

test(
  "receipt handler routes by supplier order purpose",
  async () => {
    const source =
      await readFile(
        sourcePath,
        "utf8"
      );

    assert.match(
      source,
      /const isMechanical/
    );

    assert.match(
      source,
      /purpose !== "TAILOR_MATERIAL"[\s\S]*purpose !== "MECHANICAL_PRODUCT"[\s\S]*return;/
    );

    assert.match(
      source,
      /if \(isMechanical\)/
    );

    assert.match(
      source,
      /executeMechanicalSupplierReceiptToInstallation/
    );

    assert.match(
      source,
      /executeSupplierReceiptToProduction/
    );
  }
);

test(
  "supplier receipt UI preserves m m2 and adet units",
  async () => {
    const source =
      await readFile(
        sourcePath,
        "utf8"
      );

    assert.match(
      source,
      /orderedUnit === "m2"/
    );

    assert.match(
      source,
      /"m²"/
    );

    assert.match(
      source,
      /"adet"/
    );
  }
);

test(
  "mechanical receipt result exposes installation waiting and routed messages",
  async () => {
    const source =
      await readFile(
        sourcePath,
        "utf8"
      );

    assert.match(
      source,
      /WAITING_ASSIGNMENT/
    );

    assert.match(
      source,
      /READY_NOT_ROUTED/
    );

    assert.match(
      source,
      /montaj iş emri oluşturuldu/
    );
  }
);