import assert from "node:assert/strict";
import { evaluatePackagePilotReadiness } from "../src/lib/packagePilotReadiness";

const preparedWithoutActivation = evaluatePackagePilotReadiness({
  accessPolicyApproved: true,
  allActiveUsersScoped: true,
  packageLicenseReady: true,
  shadowRegressionPassed: true,
  ownershipRegressionPassed: true,
  rollbackVerified: true,
  activationApproved: false,
});

assert.deepEqual(preparedWithoutActivation, {
  readyForActivation: false,
  missing: ["activationApproved"],
});

assert.deepEqual(
  evaluatePackagePilotReadiness({
    accessPolicyApproved: true,
    allActiveUsersScoped: true,
    packageLicenseReady: true,
    shadowRegressionPassed: true,
    ownershipRegressionPassed: true,
    rollbackVerified: true,
    activationApproved: true,
  }),
  {
    readyForActivation: true,
    missing: [],
  }
);

console.log("[PASS] package pilot readiness requires explicit activation");
