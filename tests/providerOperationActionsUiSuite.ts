import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const componentSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/components/operations/ProviderOperationActions.tsx"
    ),
    "utf8"
  );

const pageSource =
  readFileSync(
    resolve(
      process.cwd(),
      "src/app/operasyonlar/page.tsx"
    ),
    "utf8"
  );

assert.match(
  componentSource,
  /updateProviderStatus/
);

assert.match(
  componentSource,
  /listProviderStatusActions/
);

assert.match(
  componentSource,
  /İşi Kabul Et| getProviderStatusActionLabel/
);

assert.match(
  componentSource,
  /İşe Başla| getProviderStatusActionLabel/
);

assert.match(
  componentSource,
  /Sorun Bildir/
);

assert.match(
  componentSource,
  /Sorun açıklaması zorunludur/
);

assert.match(
  componentSource,
  /İşe Devam Et| getProviderStatusActionLabel/
);

assert.match(
  componentSource,
  /Tamamlandı Bildir| getProviderStatusActionLabel/
);

assert.match(
  componentSource,
  /Finansal kesinleştirme yönetici onayından sonra/
);

assert.match(
  componentSource,
  /disabled=\{busy\}/
);

assert.match(
  componentSource,
  /if \(busy\)/
);

assert.match(
  componentSource,
  /problemDescription/
);

assert.match(
  componentSource,
  /maxLength=\{1000\}/
);

assert.doesNotMatch(
  componentSource,
  /purchaseDocument|financeTransaction|paymentId|cashAccount/
);

assert.match(
  pageSource,
  /ProviderOperationActions/
);

assert.match(
  pageSource,
  /portalMode\.mode === "MANAGEMENT"\s*&&\s*nextStatus/
);

console.log(
  "PROVIDER_OPERATION_ACTIONS_UI_TEST: PAK"
);