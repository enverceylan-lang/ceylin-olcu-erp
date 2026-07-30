import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

function readSource(
  path: string
): string {
  return readFileSync(
    resolve(process.cwd(), path),
    "utf8"
  ).replace(/\r\n/g, "\n");
}

const dbSource =
  readSource(
    "src/lib/localSaleReturnsDb.ts"
  );

assert.match(
  dbSource,
  /class LocalSaleReturnsDatabase[\s\S]*extends Dexie/
);

assert.match(
  dbSource,
  /super\(\s*"CeylinLocalSaleReturnsDb"\s*\)/
);

assert.match(
  dbSource,
  /this\.version\(1\)\.stores/
);

assert.match(
  dbSource,
  /saleReturns!:\s*Table</
);

assert.match(
  dbSource,
  /statusAudits!:\s*Table</
);

assert.match(
  dbSource,
  /&\[tenantId\+companyId\+branchId\+accountingPeriodId\+idempotencyKey\]/
);

assert.match(
  dbSource,
  /\[tenantId\+companyId\+branchId\+accountingPeriodId\+saleId\]/
);

assert.match(
  dbSource,
  /\[tenantId\+companyId\+branchId\+accountingPeriodId\+saleReturnId\]/
);

assert.match(
  dbSource,
  /saveLocalSaleReturn\([\s\S]*localSaleReturnsDb\.transaction/
);

assert.match(
  dbSource,
  /IDEMPOTENCY_PAYLOAD_CONFLICT/
);

assert.match(
  dbSource,
  /applyLocalSaleReturnStatus\([\s\S]*localSaleReturnsDb\.saleReturns,[\s\S]*localSaleReturnsDb\.statusAudits/
);

assert.match(
  dbSource,
  /SALE_RETURN_SCOPE_MISMATCH/
);

assert.match(
  dbSource,
  /SALE_RETURN_STATUS_CONFLICT/
);

assert.match(
  dbSource,
  /SALE_RETURN_AUDIT_REPLAY_STATE_MISMATCH/
);

assert.match(
  dbSource,
  /saleReturns[\s\S]*\.put\(updatedReturn\)[\s\S]*statusAudits[\s\S]*\.add\(auditRecord\)/
);

assert.doesNotMatch(
  dbSource,
  /deleteLocalSaleReturn/
);

assert.doesNotMatch(
  dbSource,
  /\.saleReturns\.delete\(/
);

console.log(
  "saleReturnPersistenceContractSuite: PASS"
);