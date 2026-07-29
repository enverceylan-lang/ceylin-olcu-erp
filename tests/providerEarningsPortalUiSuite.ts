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
      "src/app/hakedislerim/page.tsx"
    ),
    "utf8"
  );

const storeSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/store/useProviderEarningsStore.ts"
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

assert.match(
  pageSource,
  /listProviderEarnings/
);

assert.match(
  pageSource,
  /resolveProviderPortalMode/
);

assert.match(
  pageSource,
  /data-provider-earnings-blocked/
);

assert.match(
  pageSource,
  /data-provider-earnings-page/
);

assert.match(
  pageSource,
  /data-provider-earnings-summary/
);

assert.match(
  pageSource,
  /data-provider-earnings-list/
);

assert.match(
  pageSource,
  /Tahmini/
);

assert.match(
  pageSource,
  /Kesinleşen/
);

assert.match(
  pageSource,
  /Ödenen/
);

assert.match(
  pageSource,
  /Kalan/
);

assert.match(
  pageSource,
  /tr-TR/
);

assert.match(
  pageSource,
  /Provider cari bağlantısı kurulmadan/
);

assert.match(
  pageSource,
  /Bu ekran salt okunurdur/
);

assert.doesNotMatch(
  pageSource,
  /createPayment|updateCash|financeTransaction|paymentCommand/
);

assert.match(
  storeSource,
  /persist/
);

assert.match(
  storeSource,
  /replaceSnapshot/
);

assert.match(
  storeSource,
  /paymentSnapshots/
);

assert.doesNotMatch(
  storeSource,
  /createPayment|financeTransaction|cashBalance/
);

assert.match(
  sidebarSource,
  /href="\/hakedislerim"/
);

assert.match(
  sidebarSource,
  /Benim Hakedişlerim/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "TAILOR"/
);

assert.match(
  sidebarSource,
  /normalizeRole\(currentUser\.role\) === "INSTALLER"/
);

console.log(
  "PROVIDER_EARNINGS_PORTAL_UI_TEST: PAK"
);