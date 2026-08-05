import assert from "node:assert/strict";
import test from "node:test";

import {
  canViewInstallationTask,
  canViewMeasurement,
  canViewProductionTask,
  normalizeUser
} from "../src/store/useAuthStore";

test(
  "normalizeUser rejects nullish input instead of synthesizing ADMIN",
  () => {
    assert.throws(
      () => normalizeUser(undefined),
      /requires an explicit user/
    );

    assert.throws(
      () => normalizeUser(null),
      /requires an explicit user/
    );
  }
);

test(
  "nullable work visibility helpers fail closed before normalization",
  () => {
    assert.equal(
      canViewMeasurement(
        undefined,
        {} as never
      ),
      false
    );

    assert.equal(
      canViewProductionTask(
        undefined,
        {}
      ),
      false
    );

    assert.equal(
      canViewInstallationTask(
        undefined,
        {} as never
      ),
      false
    );

    assert.equal(
      canViewMeasurement(
        null,
        {} as never
      ),
      false
    );

    assert.equal(
      canViewProductionTask(
        null,
        {}
      ),
      false
    );

    assert.equal(
      canViewInstallationTask(
        null,
        {} as never
      ),
      false
    );
  }
);