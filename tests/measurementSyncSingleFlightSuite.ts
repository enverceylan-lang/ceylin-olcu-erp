import assert from "node:assert/strict";
import fs from "node:fs";

const delta = fs.readFileSync(
  "src/lib/deltaSyncClient.ts",
  "utf8",
);

assert.match(
  delta,
  /async function pushDeltaSyncEventsUnlocked\(/,
  "real push implementation must be private behind the single-flight wrapper",
);

assert.match(
  delta,
  /let deltaPushInFlight:[\s\S]*?ReturnType<typeof pushDeltaSyncEventsUnlocked>/,
  "same-tab single-flight promise must exist",
);

assert.match(
  delta,
  /if \(deltaPushInFlight\)[\s\S]*?return deltaPushInFlight/,
  "concurrent same-tab push must join the active run",
);

assert.match(
  delta,
  /navigator\.locks\.request\([\s\S]*?'enverp-delta-sync-push'/,
  "supported browsers must serialize the push drain across tabs",
);

assert.match(
  delta,
  /const DELTA_SYNC_CROSS_TAB_LOCK_UNAVAILABLE =[\s\S]*?'DELTA_SYNC_CROSS_TAB_LOCK_UNAVAILABLE'/,
  "no-Web-Locks browser fallback must expose a deterministic fail-closed code",
);

assert.match(
  delta,
  /if \(typeof navigator === 'undefined'\)[\s\S]{0,120}return pushDeltaSyncEventsUnlocked\(\)/,
  "non-browser execution may use the unlocked implementation because there is no browser cross-tab authority",
);

assert.match(
  delta,
  /if \(!\('locks' in navigator\)\)[\s\S]{0,160}throw new Error\(DELTA_SYNC_CROSS_TAB_LOCK_UNAVAILABLE\)/,
  "browser execution without Web Locks must fail closed instead of creating a second authority",
);

assert.doesNotMatch(
  delta,
  /typeof navigator === 'undefined'\s*\|\|\s*!\('locks' in navigator\)[\s\S]{0,180}pushDeltaSyncEventsUnlocked/,
  "browser no-Web-Locks fallback must never share the direct unlocked path",
);

assert.match(
  delta,
  /finally[\s\S]*?deltaPushInFlight = null/,
  "single-flight state must be released after completion",
);

console.log(
  "PAK_MEASUREMENT_SYNC_SINGLE_FLIGHT_CONTRACT",
);