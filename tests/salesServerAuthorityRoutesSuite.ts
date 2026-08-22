import assert from "node:assert/strict";
import fs from "node:fs";

const persist = fs.readFileSync(
  "src/app/api/sales/authority/persist/route.ts",
  "utf8",
);
const approve = fs.readFileSync(
  "src/app/api/sales/authority/approve/route.ts",
  "utf8",
);
const returns = fs.readFileSync(
  "src/app/api/sales/returns/authority/route.ts",
  "utf8",
);

for (const route of [persist, approve, returns]) {
  assert.match(route, /verifyAuth/);
  assert.match(route, /loadSalesAuthorityContext/);
  assert.match(route, /assertSaleAuthorityScope/);
}

assert.match(persist, /actorUserId:\s*user\.id/);
assert.doesNotMatch(persist, /createdByUserId:\s*body/);

assert.match(approve, /canServerApproveSale/);
assert.match(approve, /allowSelfApproval:\s*isAdmin/);
assert.match(approve, /actorUserId:\s*user\.id/);

assert.match(returns, /body\.action !== "START"/);
assert.match(returns, /canServerApproveSale/);
assert.match(returns, /actorUserId:\s*user\.id/);

console.log("PAK: sales server authority routes");