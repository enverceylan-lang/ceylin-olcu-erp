import assert from "node:assert/strict";
import type { ErpScope } from "../src/lib/erpScope";
import { decideMeasurementRecordPilotAccess } from "../src/lib/measurementPilotRecordAccess";

const scope: ErpScope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};
const otherScope: ErpScope = {
  ...scope,
  branchId: "branch-2",
};

const pilot = (overrides: Record<string, unknown>) =>
  decideMeasurementRecordPilotAccess({
    authenticatedRole: "FIELD",
    package: "PLUS",
    rawMode: "pilot",
    actorScope: scope,
    recordScope: scope,
    actorUserId: "field-1",
    ...overrides,
  });

const assignedResult = pilot({ assignedUserId: "field-1" });
assert.equal(
  assignedResult.configured && assignedResult.decision.allowed,
  true
);
const ownerResult = pilot({ ownerUserId: "field-1" });
assert.equal(ownerResult.configured && ownerResult.decision.allowed, true);
assert.deepEqual(pilot({ assignedUserId: "field-2" }), {
  configured: true,
  mode: "pilot",
  decision: {
    allowed: false,
    source: "package-engine",
    reason: "PACKAGE_ENGINE_DECISION",
  },
});

assert.deepEqual(
  decideMeasurementRecordPilotAccess({
    authenticatedRole: "FIELD",
    package: "PLUS",
    rawMode: "pilot",
    actorScope: scope,
    recordScope: otherScope,
    actorUserId: "field-1",
    assignedUserId: "field-1",
  }),
  {
    configured: true,
    mode: "pilot",
    decision: {
      allowed: false,
      source: "package-engine",
      reason: "PACKAGE_ENGINE_DECISION",
    },
  }
);

for (const role of ["ACCOUNTING", "TAILOR", "INSTALLER"]) {
  const result = decideMeasurementRecordPilotAccess({
    authenticatedRole: role,
    package: "PLUS",
    rawMode: "pilot",
    actorScope: scope,
    recordScope: scope,
    actorUserId: `${role}-1`,
  });
  assert.equal(result.configured && result.decision.allowed, false);
}

for (const role of ["ADMIN", "MODERATOR", "OFFICE"]) {
  const result = decideMeasurementRecordPilotAccess({
    authenticatedRole: role,
    package: "PLUS",
    rawMode: "pilot",
    actorScope: scope,
    recordScope: scope,
    actorUserId: `${role}-1`,
  });
  assert.equal(result.configured && result.decision.allowed, true);
}

const shadowRollback = decideMeasurementRecordPilotAccess({
  authenticatedRole: "FIELD",
  package: "PLUS",
  rawMode: "shadow",
  actorScope: scope,
  recordScope: otherScope,
  actorUserId: "field-1",
  assignedUserId: "field-2",
});
assert.deepEqual(shadowRollback, {
  configured: true,
  mode: "shadow",
  decision: {
    allowed: true,
    source: "current",
    reason: "SHADOW_MODE_CURRENT_ACCESS",
  },
});

console.log("[PASS] measurement pilot role scope ownership and rollback");
