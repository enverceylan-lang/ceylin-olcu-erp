import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";
import path from "node:path";

const repo =
  process.argv[2];

if (!repo) {
  throw new Error(
    "REPO_PATH_REQUIRED"
  );
}

async function source(
  relativePath: string
) {
  return readFile(
    path.join(
      repo,
      relativePath
    ),
    "utf8"
  );
}

test(
  "tailor provider cari identity never falls back to party.id",
  async () => {
    const text =
      await source(
        "src/lib/tailorCompletionEarningsCoordinator.ts"
      );

    assert.doesNotMatch(
      text,
      /providerCustomerId\s*\|\|\s*operation\.party\?\.id/
    );

    assert.match(
      text,
      /const providerCustomerId\s*=\s*operation\.party\s*\?\.providerCustomerId\s*\?\.trim\(\);/
    );

    assert.match(
      text,
      /if\s*\(!providerCustomerId\)/
    );
  }
);

test(
  "external provider source truth never guesses INTERNAL assignment type",
  async () => {
    const text =
      await source(
        "src/store/useOperationsStore.ts"
      );

    assert.match(
      text,
      /request\.operation\.party\s*\?\.assignmentType\s*!==\s*"EXTERNAL"/
    );

    assert.doesNotMatch(
      text,
      /assignmentType:\s*request\.operation\.party\s*\?\.assignmentType\s*\|\|\s*"INTERNAL"/
    );

    assert.match(
      text,
      /assignmentType:\s*"EXTERNAL"/
    );

    assert.match(
      text,
      /registerAccrual\(\{[\s\S]*?tenantId:[\s\S]*?companyId:[\s\S]*?branchId:[\s\S]*?accountingPeriodId:[\s\S]*?idempotencyKey:[\s\S]*?counterpartyCustomerId:[\s\S]*?sourceDocumentId:[\s\S]*?operationId:[\s\S]*?providerEarningsEntryId:/
    );
  }
);
