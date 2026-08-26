import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(
  path.join(root, "src/app/api/sync/media/route.ts"),
  "utf8",
);
const client = fs.readFileSync(
  path.join(root, "src/lib/mediaCanonicalClient.ts"),
  "utf8",
);
const panel = fs.readFileSync(
  path.join(root, "src/components/media/CanonicalMediaPanel.tsx"),
  "utf8",
);
const legacy = fs.readFileSync(
  path.join(root, "src/lib/fileStorage.ts"),
  "utf8",
);
const page = fs.readFileSync(
  path.join(root, "src/app/cariler/[id]/page.tsx"),
  "utf8",
);

assert.match(route, /requireCompanySession\(req,\s*"WEB"\)/);
assert.match(route, /loadShadowErpContext/);
assert.match(route, /readRequestedErpScopeId/);
assert.match(route, /MEDIA_READ_ADMIN_ONLY/);
assert.match(route, /targetType\s*===\s*"MEASUREMENT"/);
assert.match(route, /from\("measurements"\)/);
assert.match(route, /select\("id,measuredById"\)/);
assert.match(route, /measuredById/);
assert.doesNotMatch(route, /selectColumns/);
assert.match(route, /createSignedUploadUrl/);
assert.match(route, /createSignedUrl/);
assert.match(route, /\.download\(intent\.storage_key\)/);
assert.match(route, /createHash\("sha256"\)/);
assert.match(route, /parseWebpDimensions/);
assert.match(route, /MAX_PHOTO_BYTES/);

assert.match(client, /createImageBitmap/);
assert.match(client, /canvasToWebp/);
assert.match(client, /uploadToSignedUrl/);
assert.match(client, /image\/webp/);
assert.match(client, /MAX_DIMENSION\s*=\s*2048/);

assert.match(panel, /CanonicalMediaPanel/);
assert.match(panel, /archiveCanonicalMedia/);
assert.match(panel, /targetType === "MEASUREMENT"/);

assert.match(legacy, /Legacy Base64\/DataURL medya yükleme kapalı/);
assert.doesNotMatch(page, /handleFileUpload\('photo'/);

console.log("PASS mediaStage2ApiContractSuite");
