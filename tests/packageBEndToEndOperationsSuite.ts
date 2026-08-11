import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "sale approval screens use one central operations coordinator",
  async () => {
    const [
      list,
      detail,
      coordinator
    ] =
      await Promise.all([
        readFile(
          "src/app/satis/page.tsx",
          "utf8"
        ),
        readFile(
          "src/app/satis/[id]/page.tsx",
          "utf8"
        ),
        readFile(
          "src/lib/saleApprovalOperationsCoordinator.ts",
          "utf8"
        )
      ]);

    assert.match(
      list,
      /executeSaleApprovalOperations/
    );

    assert.match(
      detail,
      /executeSaleApprovalOperations/
    );

    assert.match(
      coordinator,
      /executeSaleApprovalMaterialFulfillment/
    );

    assert.match(
      coordinator,
      /executeSaleApprovalMechanicalProcurement/
    );

    assert.match(
      coordinator,
      /syncMainOperation/
    );
  }
);

test(
  "tailor completion has installation bridge with assignment wait and replay",
  async () => {
    const [
      actions,
      bridge
    ] =
      await Promise.all([
        readFile(
          "src/components/operations/ProviderOperationActions.tsx",
          "utf8"
        ),
        readFile(
          "src/lib/tailorCompletionInstallationCoordinator.ts",
          "utf8"
        )
      ]);

    assert.match(
      actions,
      /routeInstallationAfterTailorCompletion/
    );

    assert.match(
      bridge,
      /WAITING_ASSIGNMENT/
    );

    assert.match(
      bridge,
      /resolveInstallationAssignment/
    );

    assert.match(
      bridge,
      /routeChild/
    );

    assert.match(
      bridge,
      /REPLAY/
    );

    assert.match(
      bridge,
      /requiresInstallation/
    );
  }
);