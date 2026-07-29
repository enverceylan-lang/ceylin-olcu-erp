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

assert.match(
  storeSource,
  /finalizeProviderEarning/
);

assert.match(
  storeSource,
  /registerProviderPaymentSnapshot/
);

assert.match(
  storeSource,
  /type FinalizeProviderEarningRequest/
);

assert.match(
  storeSource,
  /type RegisterProviderPaymentSnapshotRequest/
);

assert.match(
  storeSource,
  /type ProviderEarningsLedgerResult/
);

assert.match(
  storeSource,
  /finalizeProviderEarning:\s*request\s*=>/
);

assert.match(
  storeSource,
  /registerProviderPaymentSnapshot:\s*request\s*=>/
);

assert.match(
  storeSource,
  /providerEarningsEntries:\s*result\.state\.entries/
);

assert.match(
  storeSource,
  /providerPaymentSnapshots:\s*result\.state/
);

assert.match(
  storeSource,
  /result\.outcome ===\s*"UPDATED"/
);

assert.match(
  storeSource,
  /result\.outcome ===\s*"REPLAY"/
);

assert.doesNotMatch(
  storeSource,
  /cashBalance|bankBalance|financeTransaction|createPaymentCommand/
);

console.log(
  "PROVIDER_EARNINGS_FINALIZE_PAYMENT_STORE_TEST: PAK"
);