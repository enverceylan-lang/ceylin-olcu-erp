import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(
  "src/lib/salesAuthorityRuntimeClient.ts",
  "utf8",
);
const detail = fs.readFileSync(
  "src/app/satis/[id]/page.tsx",
  "utf8",
);
const list = fs.readFileSync(
  "src/app/satis/page.tsx",
  "utf8",
);
const panel = fs.readFileSync(
  "src/components/sales/SaleReturnPanel.tsx",
  "utf8",
);
const persistRoute = fs.readFileSync(
  "src/app/api/sales/authority/persist/route.ts",
  "utf8",
);
const returnRoute = fs.readFileSync(
  "src/app/api/sales/returns/authority/route.ts",
  "utf8",
);

assert.match(client, /useAuthStore\.getState\(\)\.sessionToken/);
assert.match(client, /\/api\/sales\/authority\/persist/);
assert.match(client, /\/api\/sales\/authority\/approve/);
assert.match(client, /\/api\/sales\/returns\/authority/);

assert.match(detail, /persistDraftSaleServerAuthority/);
assert.match(detail, /approveSaleServerAuthority/);

assert.match(list, /SERVER_AUTHORITY_RUNTIME_V1/);
assert.match(
  list,
  /approveSaleServerAuthority\([\s\S]*requestSaleStatusTransition/,
);

for (const marker of [
  "SERVER_RETURN_START_RUNTIME_V1",
  "SERVER_RETURN_APPROVE_RUNTIME_V1",
  "SERVER_RETURN_REJECT_RUNTIME_V1",
  "SERVER_RETURN_COMPLETE_RUNTIME_V1",
]) {
  assert.match(panel, new RegExp(marker));
}

assert.match(persistRoute, /stableFinanceOperationHash\(serverSale\)/);
assert.match(returnRoute, /stableFinanceOperationHash\(serverCommand\)/);
assert.doesNotMatch(persistRoute, /payloadHash:\s*body\.payloadHash/);
assert.doesNotMatch(returnRoute, /payloadHash:\s*body\.payloadHash/);

console.log("PAK: sales runtime authority wiring");