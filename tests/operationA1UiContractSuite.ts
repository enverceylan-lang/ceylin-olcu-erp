import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(
  new URL("../src/app/operasyonlar/page.tsx", import.meta.url),
  "utf8"
);

const provider = readFileSync(
  new URL(
    "../src/components/operations/ProviderOperationActions.tsx",
    import.meta.url
  ),
  "utf8"
);

assert.match(page, /resolveOperationReleaseProjection/);
assert.match(page, /data-operation-release-panel/);
assert.match(page, /data-operation-release-state/);
assert.match(page, /Şimdi ne yapmalıyım\?/);
assert.match(page, /transitionContext=\{releaseProjection\.context\}/);
assert.match(page, /sm:grid-cols-2 xl:grid-cols-4/);
assert.match(page, /dark:bg-cyan-950\/30/);

assert.match(provider, /transitionContext\?: OperationTransitionContext/);
assert.match(provider, /transitionContext/);
assert.match(provider, /updateProviderStatus/);

console.log("OPERATION_A1_UI_CONTRACT_TEST: PAK");