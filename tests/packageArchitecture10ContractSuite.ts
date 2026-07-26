import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const runner = read("scripts/package-architecture-10-final.ps1");
const preflight = read(
  "docs/sql/20260726_package_architecture_10_live_preflight.sql"
);
const hardening = read(
  "docs/sql/20260726_package_architecture_10_scope_hardening.sql"
);
const runbook = read("docs/package-architecture-10-runbook.md");

const testFiles = runner.match(/"tests\/[^"]+\.ts"/g) || [];
assert.equal(testFiles.length, 44);
assert.match(runner, /npx\.cmd eslint src tests eslint\.config\.mjs/);
assert.match(runner, /npx\.cmd tsc --noEmit --pretty false/);
assert.match(runner, /git diff --check/);
assert.match(runner, /HATALI TEST DOSYALARI/);
assert.match(
  runner,
  /PAKET MIMARISI 10 TAM KAYNAK GUVENLIK VE REGRESYON PAK/
);

assert.equal((preflight.match(/unscoped_rows/g) || []).length >= 1, true);
assert.doesNotMatch(
  preflight.replace(/--.*$/gm, ""),
  /\b(ALTER|UPDATE|INSERT|DELETE|DROP|TRUNCATE)\b/i
);
assert.match(hardening, /BEGIN;/);
assert.match(hardening, /unscoped_count <> 0/);
assert.match(hardening, /SET NOT NULL/);
assert.match(hardening, /COMMIT;/);

assert.match(runbook, /commit, push ve deploy ayrı açık onay/i);
assert.match(runbook, /PDF oluşturma\/paylaşma smoke/);
assert.match(runbook, /compatibility_unlock\.sql/);
assert.match(runbook, /enforcement modu `shadow`/);

console.log("[PASS] package architecture 10 final contract");
