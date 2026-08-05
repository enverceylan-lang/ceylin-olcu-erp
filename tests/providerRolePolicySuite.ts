import assert from "node:assert/strict";
import test from "node:test";

import {
  getProviderHomePath,
  getProviderRole,
  isProviderRole
} from "../src/lib/providerRolePolicy";

test(
  "provider role policy normalizes tailor and installer aliases without privilege fallback",
  () => {
    assert.equal(
      getProviderRole("TAILOR"),
      "TAILOR"
    );
    assert.equal(
      getProviderRole("PRODUCTION"),
      "TAILOR"
    );
    assert.equal(
      getProviderRole("INSTALLER"),
      "INSTALLER"
    );
    assert.equal(
      getProviderRole("INSTALLATION"),
      "INSTALLER"
    );

    assert.equal(
      getProviderHomePath("TAILOR"),
      "/uretim"
    );
    assert.equal(
      getProviderHomePath("INSTALLER"),
      "/montaj"
    );

    assert.equal(
      isProviderRole("TAILOR"),
      true
    );
    assert.equal(
      isProviderRole("INSTALLER"),
      true
    );

    assert.equal(
      getProviderRole("ADMIN"),
      undefined
    );
    assert.equal(
      getProviderRole(undefined),
      undefined
    );
    assert.equal(
      getProviderHomePath(undefined),
      undefined
    );
    assert.equal(
      isProviderRole(undefined),
      false
    );
  }
);