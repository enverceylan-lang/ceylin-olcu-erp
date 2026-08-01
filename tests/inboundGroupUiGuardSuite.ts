import fs from "node:fs";
import path from "node:path";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const root = process.cwd();

const page = fs.readFileSync(
  path.join(
    root,
    "src",
    "app",
    "olculer",
    "page.tsx",
  ),
  "utf8",
);

assert(
  page.includes(
    "d.entityType !== 'MEASUREMENT_GROUP'",
  ),
  "MEASUREMENT_GROUP UI guard missing",
);

assert(
  page.includes(
    "d.status === 'NEW' || d.status === 'MATCH_PENDING'",
  ),
  "Open inbound status filter changed unexpectedly",
);

assert(
  page.includes(
    "await updateInboundStatus(inbound.changeId, 'SKIPPED')",
  ),
  "Normal customer Atla behavior unexpectedly removed",
);

console.log(
  "[PASS] inboundGroupUiGuardSuite completed",
);