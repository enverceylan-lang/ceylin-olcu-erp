import assert from "node:assert/strict";
import { buildMeasurementPilotAccess } from "../src/lib/measurementPilotAccess";

assert.deepEqual(
  buildMeasurementPilotAccess({
    authenticatedRole: "FIELD",
    package: "ECO",
  }),
  {
    configured: true,
    feature: "measurement",
    mode: "shadow",
    decision: {
      allowed: true,
      source: "current",
      reason: "SHADOW_MODE_CURRENT_ACCESS",
    },
  }
);

assert.deepEqual(
  buildMeasurementPilotAccess({
    authenticatedRole: "ACCOUNTING",
    package: "PLUS",
    rawMode: "pilot",
  }),
  {
    configured: true,
    feature: "measurement",
    mode: "pilot",
    decision: {
      allowed: false,
      source: "package-engine",
      reason: "PACKAGE_ENGINE_DECISION",
    },
  }
);

assert.deepEqual(
  buildMeasurementPilotAccess({
    authenticatedRole: "FIELD",
    package: "PLUS",
    featureOverrides: { measurement: false },
    rawMode: "pilot",
  }),
  {
    configured: true,
    feature: "measurement",
    mode: "pilot",
    decision: {
      allowed: false,
      source: "package-engine",
      reason: "PACKAGE_ENGINE_DECISION",
    },
  }
);

assert.deepEqual(
  buildMeasurementPilotAccess({
    authenticatedRole: "UNKNOWN",
    package: "PLUS",
    rawMode: "pilot",
  }),
  {
    configured: false,
    feature: "measurement",
    mode: "pilot",
    reason: "UNSUPPORTED_ROLE",
  }
);

console.log("[PASS] measurement pilot access decision");
