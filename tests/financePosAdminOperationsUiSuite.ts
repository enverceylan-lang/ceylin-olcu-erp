import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync("src/components/finance/PosAdminOperationsWorkspace.tsx","utf8");
for(const action of ["SETTLE_TRANSACTION","POST_MONTHLY_FEE","REFUND_TRANSACTION","REVERSE_TRANSACTION"]){
  assert.match(ui,new RegExp(action));
}
assert.doesNotMatch(ui,/POST_COLLECTION/);
assert.doesNotMatch(ui,/JSON\.parse/);
assert.match(ui,/settlementId=crypto\.randomUUID/);
assert.match(ui,/monthlyFeeId=crypto\.randomUUID/);
assert.match(ui,/refundTransactionId=crypto\.randomUUID/);
assert.match(ui,/reversalTransactionId=crypto\.randomUUID/);
assert.match(ui,/posCommand/);
assert.match(ui,/scheduleLineId/);
assert.match(ui,/contractId/);
assert.match(ui,/originalTransactionId/);
assert.match(ui,/reversalReason/);

const panel=readFileSync("src/components/finance/FinanceOperationsPanel.tsx","utf8");
assert.match(panel,/section === "\\u00d6deme"/);
assert.match(panel,/activeItem === "\\u00c7ek ile \\u00d6deme"/);
assert.match(panel,/POS Cihazlar\\u0131 ve S\\u00f6zle\\u015fmeleri/);

console.log("F2B_POS_STRUCTURED_UI_AND_UNICODE_ROUTING: PAK");