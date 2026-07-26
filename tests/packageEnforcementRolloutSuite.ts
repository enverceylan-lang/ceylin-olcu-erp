import assert from "node:assert/strict";
import {
  decideRolloutAccess,
  resolvePackageEnforcementMode,
} from "../src/lib/packageEnforcementRollout";

assert.equal(resolvePackageEnforcementMode(undefined), "shadow");
assert.equal(resolvePackageEnforcementMode(""), "shadow");
assert.equal(resolvePackageEnforcementMode("invalid"), "shadow");
assert.equal(resolvePackageEnforcementMode(" PILOT "), "pilot");
assert.equal(resolvePackageEnforcementMode("FULL"), "full");

assert.deepEqual(
  decideRolloutAccess({
    mode: "shadow",
    feature: "measurement",
    pilotFeatures: ["measurement"],
    currentAllows: true,
    packageDecision: {
      allowed: false,
      reason: "ROLE_DENIED",
    },
    businessDecisionsResolved: true,
  }),
  {
    allowed: true,
    source: "current",
    reason: "SHADOW_MODE_CURRENT_ACCESS",
  }
);

assert.deepEqual(
  decideRolloutAccess({
    mode: "pilot",
    feature: "sales",
    pilotFeatures: ["measurement"],
    currentAllows: true,
    packageDecision: {
      allowed: false,
      reason: "PACKAGE_LICENSE_DENIED",
    },
    businessDecisionsResolved: true,
  }),
  {
    allowed: true,
    source: "current",
    reason: "NOT_IN_PILOT_CURRENT_ACCESS",
  }
);

assert.deepEqual(
  decideRolloutAccess({
    mode: "pilot",
    feature: "measurement",
    pilotFeatures: ["measurement"],
    currentAllows: true,
    packageDecision: {
      allowed: false,
      reason: "ROLE_DENIED",
    },
    businessDecisionsResolved: false,
  }),
  {
    allowed: true,
    source: "current",
    reason: "PENDING_BUSINESS_DECISIONS_CURRENT_ACCESS",
  }
);

assert.deepEqual(
  decideRolloutAccess({
    mode: "pilot",
    feature: "measurement",
    pilotFeatures: ["measurement"],
    currentAllows: true,
    packageDecision: {
      allowed: false,
      reason: "ROLE_DENIED",
    },
    businessDecisionsResolved: true,
  }),
  {
    allowed: false,
    source: "package-engine",
    reason: "PACKAGE_ENGINE_DECISION",
  }
);

console.log("[PASS] package enforcement rollout gate defaults closed");
