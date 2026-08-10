import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("main tailor producer carries explicit external provider identity", async () => {
  const source = await readFile("src/app/operasyonlar/page.tsx", "utf8");

  assert.match(
    source,
    /kind === "INSTALLATION"[\s\S]*?: selectedParty[\s\S]*?assignmentType:\s*"EXTERNAL"[\s\S]*?providerCustomerId:\s*selectedParty\.providerCustomerId/
  );
});

test("routing modal tailor producer carries explicit external provider identity", async () => {
  const source = await readFile(
    "src/components/operations/OperationRoutingModal.tsx",
    "utf8"
  );

  assert.match(
    source,
    /party:\s*selectedParty[\s\S]*?assignmentType:\s*"EXTERNAL"[\s\S]*?providerCustomerId:\s*selectedParty\.providerCustomerId/
  );
});

test("tailor routing fails closed when explicit external provider cari identity is missing", async () => {
  const source = await readFile(
    "src/lib/operationRoutingService.ts",
    "utf8"
  );

  assert.match(
    source,
    /input\.kind === "TAILOR"[\s\S]*?stableParty\.assignmentType === "EXTERNAL"[\s\S]*?!stableParty\.providerCustomerId\?\.trim\(\)/
  );
});

test("A1 tailor earnings fixture uses explicit provider identity", async () => {
  const source = await readFile(
    "tests/packageA1ProviderCariFinanceSuite.ts",
    "utf8"
  );

  assert.match(
    source,
    /party:\s*\{[\s\S]*?id:\s*"tailor-cari-1"[\s\S]*?userId:\s*"tailor-user-1"[\s\S]*?assignmentType:\s*"EXTERNAL"[\s\S]*?providerCustomerId:\s*"tailor-cari-1"/
  );
});