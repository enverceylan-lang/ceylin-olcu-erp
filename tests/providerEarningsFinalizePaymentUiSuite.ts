import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const source =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/bekleyen-hakedisler/page.tsx"
    ),
    "utf8"
  );

assert.match(
  source,
  /state\.providerEarningsEntries/
);

assert.match(
  source,
  /state\.finalizeProviderEarning/
);

assert.match(
  source,
  /state\.registerProviderPaymentSnapshot/
);

assert.match(
  source,
  /data-provider-earnings-ledger-admin/
);

assert.match(
  source,
  /data-provider-earnings-finalize-form/
);

assert.match(
  source,
  /data-provider-earnings-payment-form/
);

assert.match(
  source,
  /Hakedişi Kesinleştir/
);

assert.match(
  source,
  /Ödeme Bilgisini Kaydet/
);

assert.match(
  source,
  /Benzersiz Ödeme Referansı/
);

assert.match(
  source,
  /sourcePaymentId/
);

assert.match(
  source,
  /PAYMENT_EXCEEDS_FINALIZED_AMOUNT|result\.reason/
);

assert.doesNotMatch(
  source,
  /cashBalance|bankBalance|createFinanceTransaction|createCashMovement/
);

console.log(
  "PROVIDER_EARNINGS_FINALIZE_PAYMENT_UI_TEST: PAK"
);