import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditModule,
  canViewModule,
  normalizeRole
} from "../src/store/useAuthStore";

test(
  "undefined role fails closed for module authorization helpers",
  () => {
    assert.equal(
      canViewModule(undefined, "/"),
      false
    );

    assert.equal(
      canViewModule(undefined, "/ayarlar"),
      false
    );

    assert.equal(
      canViewModule(undefined, "/destek"),
      false
    );

    assert.equal(
      canEditModule(undefined, "/"),
      false
    );

    assert.equal(
      canEditModule(undefined, "/ayarlar"),
      false
    );
  }
);

test(
  "explicit legacy role aliases keep canonical normalization",
  () => {
    assert.equal(
      normalizeRole("COMPANY_ADMIN"),
      "ADMIN"
    );

    assert.equal(
      normalizeRole("SALES"),
      "OFFICE"
    );

    assert.equal(
      normalizeRole("MEASUREMENT"),
      "FIELD"
    );

    assert.equal(
      normalizeRole("PRODUCTION"),
      "TAILOR"
    );

    assert.equal(
      normalizeRole("INSTALLATION"),
      "INSTALLER"
    );
  }
);