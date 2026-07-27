import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const editor = fs.readFileSync(
  path.join(root, "src/components/admin/FinancePermissionEditor.tsx"),
  "utf8",
);
const settings = fs.readFileSync(
  path.join(root, "src/app/ayarlar/page.tsx"),
  "utf8",
);

assert.match(editor, /Finans Yetkileri/);
for (const label of [
  "Genel görünüm",
  "Nakit",
  "Banka \/ EFT",
  "POS",
  "Çek",
  "Senet",
  "Transfer",
  "Rapor ve yönetim",
]) {
  assert.match(editor, new RegExp(label));
}
assert.match(editor, /toggle\(entry\.permission\)/);
assert.doesNotMatch(editor, /cash\.collection[\s\S]*cash\.payment/);
assert.doesNotMatch(editor, /bank\.collection[\s\S]*bank\.payment/);
assert.doesNotMatch(editor, /pos\.collection[\s\S]*pos\.refund/);
assert.match(editor, /next\.has\(permission\)/);
assert.match(settings, /financePermissions: editFinancePermissions/);
assert.match(settings, /\.filter\(isFinancePermission\)/);
assert.match(editor, /platformBlocked/);
assert.doesNotMatch(
  editor,
  /role\s*===\s*["']ADMIN["'][\s\S]*return true/,
);
assert.doesNotMatch(editor, /resolveFinancePermissions/);
assert.doesNotMatch(editor, /password|token|hash|salt/i);

console.log("[PASS] finance permission editor contract (12 required scenarios)");
