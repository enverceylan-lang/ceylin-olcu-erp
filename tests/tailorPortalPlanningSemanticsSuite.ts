import assert from "node:assert/strict";
import {
  getProviderStatusActionLabel,
  listProviderStatusActions
} from "../src/lib/providerOperationStatusService";

assert.deepEqual(
  listProviderStatusActions(
    "ACCEPTED"
  ),
  ["START"]
);

assert.equal(
  getProviderStatusActionLabel(
    "START",
    "TAILOR"
  ),
  "Planlamaya Başla"
);

assert.equal(
  getProviderStatusActionLabel(
    "START",
    "INSTALLER"
  ),
  "İşe Başla"
);

assert.equal(
  getProviderStatusActionLabel(
    "START"
  ),
  "İşe Başla"
);

assert.equal(
  getProviderStatusActionLabel(
    "ACCEPT",
    "TAILOR"
  ),
  "İşi Kabul Et"
);

console.log(
  "[PASS] tailorStartMeansPlanningWithoutChangingGenericProviderFlow"
);

console.log(
  "[PASS] tailorPortalPlanningSemanticsSuite completed"
);