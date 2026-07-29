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
  /providerStatusAudits:\s*ProviderOperationStatusAudit\[\]/
);

assert.match(
  storeSource,
  /providerEarningsPendingDrafts:\s*ProviderEarningsPendingDraft\[\]/
);

assert.match(
  storeSource,
  /providerStatusAudits:\s*\[\]/
);

assert.match(
  storeSource,
  /providerEarningsPendingDrafts:\s*\[\]/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*operations:\s*state\.operations/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*agendaEvents:\s*state\.agendaEvents/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*providerStatusAudits:\s*state\.providerStatusAudits/
);

assert.match(
  storeSource,
  /partialize:\s*state\s*=>\s*\(\{[\s\S]*providerEarningsPendingDrafts:\s*state\.providerEarningsPendingDrafts/
);

assert.doesNotMatch(
  storeSource,
  /password:\s*state\.|sessionToken:\s*state\.|financePermissions:\s*state\./
);

console.log(
  "PROVIDER_EARNINGS_PERSISTENCE_TEST: PAK"
);