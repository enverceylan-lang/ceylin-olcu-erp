import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/app/satis/[id]/page.tsx",
  "utf8",
);

assert.match(
  source,
  /const handleSave = async \(\) => \{[\s\S]*currentUser\?\.role === "ADMIN"/,
);

assert.match(
  source,
  /shouldAdminApproveDirectly[\s\S]*sale\.status === "TASLAK"[\s\S]*sale\.status === "TEKLİF"/,
);

assert.match(
  source,
  /await persistSale\([\s\S]*status: "ONAYLANDI"[\s\S]*: sale[\s\S]*\);/,
);

assert.match(source, /requestSaleStatusTransition/);
assert.match(source, /updateSaleWithFinanceOutbox/);
assert.match(source, /executeSaleApprovalOperations/);
assert.match(source, /executeSalesFinanceOutboxRecord/);
assert.match(source, /persistApprovedSaleLineSourceClientV1/);

console.log("PAK: admin sale direct approval on save");