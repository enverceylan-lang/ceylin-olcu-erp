import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/lib/fieldTaskSyncClient.ts",
  ),
  "utf8",
);

assert.match(
  source,
  /export type FieldTaskLifecycleAction/,
);

assert.match(
  source,
  /\| "CANCEL"/,
);

assert.match(
  source,
  /\| "ARCHIVE"/,
);

assert.match(
  source,
  /\| "RESTORE"/,
);

assert.match(
  source,
  /updateRemoteFieldTaskLifecycle/,
);

assert.match(
  source,
  /deleteRemoteFieldTaskLifecycle/,
);

assert.match(
  source,
  /"\/api\/field-tasks\/lifecycle"/,
);

assert.match(
  source,
  /method: "PATCH"/,
);

assert.match(
  source,
  /method: "DELETE"/,
);

assert.match(
  source,
  /Authorization:/,
);

assert.match(
  source,
  /Bearer \$\{sessionToken\}/,
);

assert.match(
  source,
  /result\.idempotent === true/,
);

assert.match(
  source,
  /deletion\.alreadyDeleted === true/,
);

console.log(
  "[PASS] field task lifecycle client bridge contract",
);
