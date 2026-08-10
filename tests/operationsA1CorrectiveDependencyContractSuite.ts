import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

const contractPath =
  "docs/contracts/operations-a1-corrective-provider-service-rate-contract-v1.md";

const sourceFiles = [
  "src/lib/serviceRateEngine.ts",
  "src/store/useServiceRateStore.ts",
  "src/lib/tailorCompletionEarningsCoordinator.ts",
  "src/lib/installationCompletionEarningsCoordinator.ts",
  "src/lib/tailorCompletionInstallationCoordinator.ts"
] as const;

const behaviorTests = [
  "tests/serviceRateEngine.test.ts",
  "tests/serviceRateStore.test.ts",
  "tests/packageA1ProviderCariFinanceSuite.ts",
  "tests/installationCompletionEarningsCoordinatorSuite.ts",
  "tests/tailorCompletionInstallationCoordinatorSuite.ts"
] as const;

test(
  "corrective contract binds all five fresh-clone dependencies and behavior tests",
  async () => {
    const contract =
      await readFile(
        contractPath,
        "utf8"
      );

    for (const file of sourceFiles) {
      assert.match(
        contract,
        new RegExp(
          file
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        )
      );
    }

    for (const file of behaviorTests) {
      assert.match(
        contract,
        new RegExp(
          file
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        )
      );
    }

    assert.match(
      contract,
      /tenantId \+ companyId \+ branchId \+ accountingPeriodId/
    );
    assert.match(
      contract,
      /No fallback/
    );
    assert.match(
      contract,
      /silent overwrite/
    );
    assert.match(
      contract,
      /direct finance balance mutation/
    );
    assert.match(
      contract,
      /fresh-clone build proof/
    );
  }
);

test(
  "ProviderOperationActions keeps the exact corrective dependency imports",
  async () => {
    const source =
      await readFile(
        "src/components/operations/ProviderOperationActions.tsx",
        "utf8"
      );

    assert.match(
      source,
      /@\/store\/useServiceRateStore/
    );
    assert.match(
      source,
      /@\/lib\/tailorCompletionEarningsCoordinator/
    );
    assert.match(
      source,
      /@\/lib\/installationCompletionEarningsCoordinator/
    );
    assert.match(
      source,
      /@\/lib\/tailorCompletionInstallationCoordinator/
    );
  }
);

console.log(
  "OPERATIONS_A1_CORRECTIVE_DEPENDENCY_CONTRACT_TEST: PAK"
);