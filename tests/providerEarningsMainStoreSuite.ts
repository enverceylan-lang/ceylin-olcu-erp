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

const pageSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/hakedislerim/page.tsx"
    ),
    "utf8"
  );

assert.match(
  storeSource,
  /providerEarningsEntries:\s*ProviderEarningsEntry\[\]/
);

assert.match(
  storeSource,
  /providerPaymentSnapshots:\s*ProviderPaymentSnapshot\[\]/
);

assert.match(
  storeSource,
  /setProviderEarningsDraftAmount\([\s\S]*SetProviderEarningsDraftAmountRequest/
);

assert.match(
  storeSource,
  /convertProviderEarningsDraft\([\s\S]*ConvertProviderEarningsDraftRequest/
);

assert.match(
  storeSource,
  /setProviderEarningsDraftAmount:\s*request\s*=>/
);

assert.match(
  storeSource,
  /convertProviderEarningsDraft:\s*request\s*=>/
);

assert.match(
  storeSource,
  /providerEarningsPendingDrafts:\s*result\.draftState\.drafts/
);

assert.match(
  storeSource,
  /providerEarningsEntries:\s*result\.ledgerState\.entries/
);

assert.match(
  storeSource,
  /providerPaymentSnapshots:\s*result\.ledgerState[\s\S]*paymentSnapshots/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*providerEarningsEntries:\s*state\.providerEarningsEntries/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*providerPaymentSnapshots:\s*state\.providerPaymentSnapshots/
);

assert.match(
  pageSource,
  /useOperationsStore/
);

assert.match(
  pageSource,
  /state\.providerEarningsEntries/
);

assert.doesNotMatch(
  pageSource,
  /useProviderEarningsStore/
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
  "PROVIDER_EARNINGS_MAIN_STORE_TEST: PAK"
);