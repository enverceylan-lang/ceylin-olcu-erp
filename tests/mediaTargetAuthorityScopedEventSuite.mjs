import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  "src/app/api/sync/media/route.ts",
  "utf8",
);

const sql = fs.readFileSync(
  "docs/sql/20260828_media_lifecycle_authority_v1.sql",
  "utf8",
);

assert.doesNotMatch(
  route,
  /\.from\("measurement_changes"\)/,
);

assert.doesNotMatch(
  route,
  /data\.measuredById/,
);

assert.doesNotMatch(
  sql,
  /measurement_changes/i,
);

assert.match(
  route,
  /canMutateMeasurementMedia/,
);

assert.match(
  route,
  /canEditFinalizedMedia/,
);

assert.match(
  route,
  /const finalized = Boolean\(canonicalMeasurement\)/,
);

assert.match(
  sql,
  /ENVERP_MEDIA_TARGET_SCOPE_MISMATCH/,
);

console.log(
  "PASS mediaTargetAuthorityScopedEventSuite SUPERSEDED_BY_LIFECYCLE_V1",
);