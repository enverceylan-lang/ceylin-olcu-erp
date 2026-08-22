import assert from "node:assert/strict";
import fs from "node:fs";

const access = fs.readFileSync("src/lib/saleApprovalAccess.ts","utf8");
const sidebar = fs.readFileSync("src/components/Sidebar.tsx","utf8");
const saleReturn = fs.readFileSync("src/app/satis-iade/page.tsx","utf8");
const list = fs.readFileSync("src/app/satis/page.tsx","utf8");
const detail = fs.readFileSync("src/app/satis/[id]/page.tsx","utf8");

assert.match(list, /Satışı Onayla/);
assert.match(detail, /Satışı Onayla/);
assert.match(detail, /const persistSale = async/);
assert.match(detail, /await persistSale\(\{/);

assert.match(
  access,
  /canApproveSpecificSale[\s\S]*normalizeRole\(user\.role\)\s*===\s*"ADMIN"[\s\S]*return true/
);
assert.doesNotMatch(access, /isPilotFieldV1RuntimeEnabled/);
assert.match(access, /SALE_APPROVE_PERMISSION/);

assert.match(sidebar, /\{\s*name:\s*"Faturalar",\s*href:\s*"\/satis"/);
assert.match(sidebar, /"Satış İade",\s*href:\s*"\/satis-iade",\s*enabled:\s*true/);
assert.match(sidebar, /"Alış",\s*href:\s*"\/alis",\s*enabled:\s*false/);
assert.match(sidebar, /"Alış İade",\s*href:\s*"\/alis-iade",\s*enabled:\s*false/);
assert.doesNotMatch(sidebar, /\{\s*name:\s*"Raporlar",\s*href:\s*"\/raporlar",\s*icon:\s*FileText/);
assert.match(sidebar, /appPathname === "\/satis-iade"/);
assert.match(sidebar, /appPathname === "\/raporlar"/);

assert.match(saleReturn, /getVisibleSales/);
assert.match(saleReturn, /useAuthStore/);
assert.match(saleReturn, /visibleSaleIds/);
assert.match(saleReturn, /visibleSaleIds\.has\(saleReturn\.saleId\)/);

console.log("PAK: sales/faturalar final semantic closure");
