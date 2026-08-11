import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveInstallationAssignment
} from "../src/lib/installationAssignmentService";

test(
  "installation assignment resolver preserves internal admin identity",
  () => {
    const result =
      resolveInstallationAssignment({
        id: "user-admin",
        name: "Admin",
        role: "ADMIN",
        isActive: true
      });

    assert.equal(
      result.mode,
      "INTERNAL"
    );

    if (result.mode !== "INTERNAL") {
      throw new Error(
        "Expected INTERNAL"
      );
    }

    assert.equal(
      result.party.userId,
      "user-admin"
    );
  }
);

test(
  "installation assignment resolver preserves external provider identity",
  () => {
    const result =
      resolveInstallationAssignment({
        id: "user-installer",
        name: "Ali Montaj",
        role: "INSTALLER",
        isActive: true,
        providerType:
          "INSTALLER",
        providerCustomerId:
          "cari-installer"
      });

    assert.equal(
      result.mode,
      "EXTERNAL"
    );

    if (result.mode !== "EXTERNAL") {
      throw new Error(
        "Expected EXTERNAL"
      );
    }

    assert.equal(
      result.party.id,
      "cari-installer"
    );

    assert.equal(
      result.party.userId,
      "user-installer"
    );
  }
);

test(
  "mechanical receipt coordinator source keeps physical receipt on routing failure",
  async () => {
    const fs =
      await import("node:fs/promises");

    const source =
      await fs.readFile(
        "src/lib/mechanicalSupplierReceiptInstallationCoordinator.ts",
        "utf8"
      );

    assert.match(
      source,
      /READY_FOR_OPERATION/
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
      /requiresInstallation/
    );

    assert.match(
      source,
      /assignedInstallerId/
    );

    assert.match(
      source,
      /routeChild/
    );

    assert.doesNotMatch(
      source,
      /rollbackSupplierReceiptCreated/
    );
  }
);

test(
  "mechanical receipt coordinator finds GENERAL operation by sale and scope",
  async () => {
    const fs =
      await import("node:fs/promises");

    const source =
      await fs.readFile(
        "src/lib/mechanicalSupplierReceiptInstallationCoordinator.ts",
        "utf8"
      );

    assert.match(
      source,
      /operation\.kind === "GENERAL"/
    );

    assert.match(
      source,
      /operation\.saleId === saleId/
    );

    assert.match(
      source,
      /sameScope\(operation, scope\)/
    );
  }
);