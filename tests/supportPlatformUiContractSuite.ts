import assert from "node:assert/strict";
import fs from "node:fs";

const page =
  fs.readFileSync(
    "src/app/super-admin/page.tsx",
    "utf8",
  );

const panel =
  fs.readFileSync(
    "src/components/platform/PlatformSupportPanel.tsx",
    "utf8",
  );

assert.match(
  page,
  /PlatformSupportPanel/,
);

assert.match(
  page,
  /activeSection === "support"[\s\S]*<PlatformSupportPanel \/>/,
);

assert.match(
  panel,
  /\/api\/platform\/support\/tickets/,
);

assert.match(
  panel,
  /\/messages/,
);

assert.match(
  panel,
  /\/status/,
);

assert.match(
  panel,
  /Authorization:[\s\S]*Bearer/,
);

assert.match(
  panel,
  /Ticket API bağlı/,
);

assert.match(
  panel,
  /Durum Geçmişi \/ Audit/,
);

assert.doesNotMatch(
  page,
  /Ticket API henüz bağlı değil/,
);

assert.doesNotMatch(
  page,
  /Henüz canlı destek kaydı bağlı değil/,
);

console.log(
  "SUPPORT_PLATFORM_UI_CONTRACT_SUITE: PAK",
);