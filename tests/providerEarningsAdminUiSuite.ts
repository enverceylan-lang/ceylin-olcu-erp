import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const pageSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/bekleyen-hakedisler/page.tsx"
    ),
    "utf8"
  );

const sidebarSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/Sidebar.tsx"
    ),
    "utf8"
  );

const storeSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/store/useOperationsStore.ts"
    ),
    "utf8"
  );

assert.match(
  pageSource,
  /useErpRuntimeContext/
);

assert.match(
  pageSource,
  /useOperationsStore/
);

assert.match(
  pageSource,
  /state\.providerEarningsPendingDrafts/
);

assert.match(
  pageSource,
  /state\.setProviderEarningsDraftAmount/
);

assert.match(
  pageSource,
  /state\.convertProviderEarningsDraft/
);

assert.match(
  pageSource,
  /normalizedRole ===\s*"ADMIN"/
);

assert.match(
  pageSource,
  /normalizedRole ===\s*"ACCOUNTING"/
);

assert.match(
  pageSource,
  /draft\.tenantId ===\s*scope\.tenantId/
);

assert.match(
  pageSource,
  /draft\.companyId ===\s*scope\.companyId/
);

assert.match(
  pageSource,
  /draft\.branchId ===\s*scope\.branchId/
);

assert.match(
  pageSource,
  /draft\.accountingPeriodId ===\s*scope\.accountingPeriodId/
);

assert.match(
  pageSource,
  /PENDING_AMOUNT/
);

assert.match(
  pageSource,
  /READY/
);

assert.match(
  pageSource,
  /Hakedişe Aktar/
);

assert.match(
  pageSource,
  /busyDraftId/
);

assert.match(
  pageSource,
  /provider-earning/
);

assert.match(
  pageSource,
  /data-provider-earnings-admin-page/
);

assert.match(
  pageSource,
  /data-provider-earnings-admin-blocked/
);

assert.doesNotMatch(
  pageSource,
  /financeTransaction|cashBalanceMutation|paymentCommand|createPayment/
);

assert.match(
  sidebarSource,
  /href="\/bekleyen-hakedisler"/
);

assert.match(
  sidebarSource,
  /Bekleyen Hakedişler/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "ADMIN"/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "ACCOUNTING"/
);

assert.match(
  storeSource,
  /setProviderEarningsDraftAmount/
);

assert.match(
  storeSource,
  /convertProviderEarningsDraft/
);

console.log(
  "PROVIDER_EARNINGS_ADMIN_UI_TEST: PAK"
);