import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

function source(path: string): string {
  return readFileSync(
    resolve(process.cwd(), path),
    "utf8"
  ).replace(/\r\n/g, "\n");
}

const localDb = source(
  "src/lib/localSalesDb.ts"
);

const store = source(
  "src/store/salesStore.ts"
);

const page = source(
  "src/app/satis/[id]/page.tsx"
);

assert.match(
  localDb,
  /this\.version\(3\)\.stores/
);

assert.match(
  localDb,
  /saleStatusAudits!:\s*Table</
);

assert.match(
  localDb,
  /localSalesDb\.transaction\([\s\S]*localSalesDb\.sales,[\s\S]*localSalesDb\.financeOutbox,[\s\S]*localSalesDb\.saleStatusAudits,/
);

assert.match(
  localDb,
  /saleStatusAudits[\s\S]*\.put\(statusAuditRecord\)/
);

assert.match(
  localDb,
  /\[tenantId\+companyId\+branchId\+accountingPeriodId\+saleId\]/
);

assert.match(
  store,
  /statusAudit\?:[\s\S]*SaleStatusTransitionAudit/
);

assert.match(
  store,
  /saveLocalSaleWithFinanceOutbox\(\{[\s\S]*statusAudit[\s\S]*\}\)/
);

assert.match(
  page,
  /statusTransitionAuditForSave\s*=[\s\S]*transitionResult\.audit/
);

assert.match(
  page,
  /updateSaleWithFinanceOutbox\([\s\S]*statusTransitionAuditForSave[\s\S]*\)/
);

console.log(
  "saleStatusAuditPersistenceContractSuite: PASS"
);