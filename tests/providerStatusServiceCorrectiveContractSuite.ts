import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const contractPath =
  "docs/contracts/operations-a1-corrective-provider-service-rate-contract-v1.md";

test(
  "provider status API drift is explicitly owned by the corrective contract",
  async () => {
    const contract =
      await readFile(
        contractPath,
        "utf8"
      );

    assert.match(
      contract,
      /src\/lib\/providerOperationStatusService\.ts/
    );
    assert.match(
      contract,
      /tests\/tailorPortalPlanningSemanticsSuite\.ts/
    );
    assert.match(
      contract,
      /tests\/providerStatusServiceCorrectiveContractSuite\.ts/
    );
    assert.match(
      contract,
      /Planlamaya Başla/
    );
    assert.match(
      contract,
      /İşe Başla/
    );
    assert.match(
      contract,
      /Fresh-clone|simulated commit-tree/i
    );
  }
);

test(
  "provider status service and tracked UI share the two-argument label contract",
  async () => {
    const service =
      await readFile(
        "src/lib/providerOperationStatusService.ts",
        "utf8"
      );
    const ui =
      await readFile(
        "src/components/operations/ProviderOperationActions.tsx",
        "utf8"
      );

    assert.match(
      service,
      /getProviderStatusActionLabel\([\s\S]*providerType\?[\s\S]*"TAILOR"\s*\|\s*"INSTALLER"/
    );
    assert.match(
      service,
      /providerType\s*===\s*"TAILOR"[\s\S]*"Planlamaya Başla"[\s\S]*"İşe Başla"/
    );
    assert.match(
      ui,
      /getProviderStatusActionLabel\([\s\S]*action,[\s\S]*link\.providerType[\s\S]*\)/
    );
  }
);

console.log(
  "PROVIDER_STATUS_SERVICE_CORRECTIVE_CONTRACT_TEST: PAK"
);