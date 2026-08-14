import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/finans/page.tsx", "utf8");
const component = fs.readFileSync(
  "src/components/finance/FinanceAccountManager.tsx",
  "utf8",
);

assert.match(page, /FinanceAccountManager/);
assert.match(page, /<FinanceAccountManager\s*\/>/);

assert.match(component, /\/api\/finance\/accounts/);
assert.match(component, /HESAP OLUŞTUR/);
assert.match(component, /Kasa/);
assert.match(component, /Banka/);
assert.match(component, /POS/);
assert.match(component, /Bakiye burada elle[\s\S]*değiştirilmez/);
assert.match(component, /crypto\.randomUUID\(\)/);
assert.match(component, /action:\s*"ARCHIVE"/);
assert.doesNotMatch(
  component,
  /localFinanceJournalDb|Dexie|Supabase|setBalance|updateBalance/,
);

console.log("[PASS] Finance V1-A account manager UI contract");