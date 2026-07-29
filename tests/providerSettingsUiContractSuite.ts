import assert from "node:assert/strict";
import {
  readFileSync
} from "node:fs";
import {
  resolve
} from "node:path";

const source = readFileSync(
  resolve(
    process.cwd(),
    "src/app/ayarlar/page.tsx"
  ),
  "utf8"
);

assert.match(
  source,
  /useStore\(state => state\.customers\)/
);

assert.match(
  source,
  /newProviderCustomerId/
);

assert.match(
  source,
  /editProviderCustomerId/
);

assert.match(
  source,
  /customer\.cariType === expectedType/
);

assert.match(
  source,
  /customer\.isDeleted !== true/
);

assert.match(
  source,
  /customer\.isArchived !== true/
);

assert.match(
  source,
  /providerCustomerId: isProviderRole\(newRole\)/
);

assert.match(
  source,
  /providerCustomerId: isProviderRole\(editRole\)/
);

assert.match(
  source,
  /id="new-provider-customer"/
);

assert.match(
  source,
  /id="edit-provider-customer"/
);

assert.match(
  source,
  /hizmet sağlayıcı carisi seçilmelidir/i
);

assert.match(
  source,
  /getProviderCariName\(/
);

console.log(
  "PROVIDER_SETTINGS_UI_CONTRACT_TEST: PAK"
);