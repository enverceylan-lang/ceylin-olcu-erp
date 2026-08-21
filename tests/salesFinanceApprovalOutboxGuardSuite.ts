import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const page =
  fs.readFileSync(
    path.join(
      process.cwd(),
      "src/app/satis/[id]/page.tsx"
    ),
    "utf8"
  );

assert.match(
  page,
  /const\s+financeOutboxRecord\s*=\s*updatedSale\.status\s*===\s*["']ONAYLANDI["']\s*&&\s*persistedSaleForSave\.status\s*!==\s*["']ONAYLANDI["'][\s\S]{0,500}updateSaleWithFinanceOutbox\s*\(/,
  "finance outbox must be created only on transition into ONAYLANDI"
);

console.log(
  "salesFinanceApprovalOutboxGuardSuite: PASS"
);