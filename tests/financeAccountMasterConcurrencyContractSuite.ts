import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve("docs/sql/20260814_finance_account_master_foundation_v1.sql"),
  "utf8"
);

const archiveStart = sql.indexOf("elsif v_kind = 'BANK' then");
assert.ok(archiveStart >= 0);

const archiveTail = sql.slice(archiveStart);
const bankLock = archiveTail.indexOf("from public.bank_accounts as ba");
const forUpdate = archiveTail.indexOf("for update", bankLock);
const posCheck = archiveTail.indexOf("from public.pos_accounts as pa");
const activePosReject = archiveTail.indexOf("FINANCE_BANK_HAS_ACTIVE_POS");

assert.ok(bankLock >= 0);
assert.ok(forUpdate > bankLock);
assert.ok(posCheck > forUpdate, "active POS check must run after bank row lock");
assert.ok(activePosReject > posCheck);

const posCreateMarker = sql.indexOf("FINANCE_POS_BANK_ACCOUNT_NOT_FOUND");
assert.ok(posCreateMarker >= 0);

const posCreateWindow = sql.slice(
  Math.max(0, posCreateMarker - 1600),
  posCreateMarker + 500
);

assert.match(
  posCreateWindow,
  /from public\.bank_accounts as ba[\s\S]*for update/,
  "POS create must lock same bank dependency row"
);

console.log("[PASS] Finance Account Master bank archive / POS create lock symmetry");