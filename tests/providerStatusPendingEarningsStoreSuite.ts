import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const storeSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/store/useOperationsStore.ts"
    ),
    "utf8"
  );

const commandSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/lib/providerOperationStatusCommandService.ts"
    ),
    "utf8"
  );

const componentSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/operations/ProviderOperationActions.tsx"
    ),
    "utf8"
  );

assert.match(
  commandSource,
  /earningsCurrency\?:/
);

assert.match(
  commandSource,
  /ProviderEarningsCurrency/
);

assert.match(
  storeSource,
  /createProviderEarningsPendingDraft/
);

assert.match(
  storeSource,
  /providerEarningsPendingDrafts/
);

assert.match(
  storeSource,
  /EARNINGS_CURRENCY_REQUIRED/
);

assert.match(
  storeSource,
  /request\.action ===\s*"REPORT_COMPLETED"/
);

assert.match(
  storeSource,
  /provider-earning-draft/
);

assert.match(
  storeSource,
  /set\(state => \(\{/
);

assert.match(
  storeSource,
  /providerStatusAudits/
);

assert.match(
  storeSource,
  /providerEarningsPendingDrafts:\s*nextPendingDrafts/
);

assert.match(
  componentSource,
  /earningsCurrency:\s*"TRY"/
);

assert.match(
  componentSource,
  /Hakediş tutarı yönetici tarafından/
);

assert.doesNotMatch(
  storeSource,
  /estimatedAmount:\s*0/
);

assert.doesNotMatch(
  storeSource,
  /financeTransaction|cashBalanceMutation|paymentCommand/
);

console.log(
  "PROVIDER_STATUS_PENDING_EARNINGS_STORE_TEST: PAK"
);