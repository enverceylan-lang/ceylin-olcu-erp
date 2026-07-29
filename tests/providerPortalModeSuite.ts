import assert from "node:assert/strict";
import {
  resolveProviderPortalMode,
  resolveProviderPortalType
} from "../src/lib/providerPortalMode";

assert.equal(
  resolveProviderPortalType(
    "TAILOR"
  ),
  "TAILOR"
);

assert.equal(
  resolveProviderPortalType(
    "PRODUCTION"
  ),
  "TAILOR"
);

assert.equal(
  resolveProviderPortalType(
    "INSTALLER"
  ),
  "INSTALLER"
);

assert.equal(
  resolveProviderPortalType(
    "INSTALLATION"
  ),
  "INSTALLER"
);

assert.equal(
  resolveProviderPortalType(
    "ADMIN"
  ),
  null
);

const management =
  resolveProviderPortalMode({
    id: "admin-1",
    role: "ADMIN"
  });

assert.equal(
  management.mode,
  "MANAGEMENT"
);

assert.equal(
  management.title,
  "Operasyonlar"
);

const missingLink =
  resolveProviderPortalMode({
    id: "tailor-1",
    role: "TAILOR",
    providerType: "TAILOR"
  });

assert.equal(
  missingLink.mode,
  "PROVIDER_BLOCKED"
);

if (
  missingLink.mode ===
  "PROVIDER_BLOCKED"
) {
  assert.equal(
    missingLink.reason,
    "PROVIDER_CUSTOMER_LINK_MISSING"
  );
}

const missingType =
  resolveProviderPortalMode({
    id: "tailor-1",
    role: "TAILOR",
    providerCustomerId:
      "cari-tailor-1"
  });

assert.equal(
  missingType.mode,
  "PROVIDER_BLOCKED"
);

if (
  missingType.mode ===
  "PROVIDER_BLOCKED"
) {
  assert.equal(
    missingType.reason,
    "PROVIDER_TYPE_MISSING"
  );
}

const mismatch =
  resolveProviderPortalMode({
    id: "tailor-1",
    role: "TAILOR",
    providerCustomerId:
      "cari-tailor-1",
    providerType:
      "INSTALLER"
  });

assert.equal(
  mismatch.mode,
  "PROVIDER_BLOCKED"
);

if (
  mismatch.mode ===
  "PROVIDER_BLOCKED"
) {
  assert.equal(
    mismatch.reason,
    "PROVIDER_TYPE_MISMATCH"
  );
}

const tailorReady =
  resolveProviderPortalMode({
    id: "tailor-1",
    role: "TAILOR",
    providerCustomerId:
      "cari-tailor-1",
    providerType:
      "TAILOR"
  });

assert.equal(
  tailorReady.mode,
  "PROVIDER_READY"
);

if (
  tailorReady.mode ===
  "PROVIDER_READY"
) {
  assert.equal(
    tailorReady.title,
    "Benim Dikim İşlerim"
  );

  assert.equal(
    tailorReady.emptyMessage,
    "Size atanmış aktif dikim işi bulunmuyor."
  );
}

const installerReady =
  resolveProviderPortalMode({
    id: "installer-1",
    role: "INSTALLER",
    providerCustomerId:
      "cari-installer-1",
    providerType:
      "INSTALLER"
  });

assert.equal(
  installerReady.mode,
  "PROVIDER_READY"
);

if (
  installerReady.mode ===
  "PROVIDER_READY"
) {
  assert.equal(
    installerReady.title,
    "Benim Montaj İşlerim"
  );

  assert.equal(
    installerReady.emptyMessage,
    "Size atanmış aktif montaj işi bulunmuyor."
  );
}

console.log(
  "PROVIDER_PORTAL_MODE_TEST: PAK"
);