import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isStockPermission, mergeSelectedStockPermissions, hasStockPermission } from "../src/lib/stock/stockPermissionCatalog";

assert.equal(isStockPermission("stock.view"), true);
assert.equal(isStockPermission("stock.nope"), false);
const merged = mergeSelectedStockPermissions({
  existingPermissions: ["dashboard", "finance.report.view", "stock.excel_import"],
  selectedStockPermissions: ["stock.view", "stock.view_sale_price"],
  targetRole: "OFFICE",
});
assert.equal(merged.ok, true);
if (merged.ok) assert.deepEqual(merged.permissions, ["dashboard", "finance.report.view", "stock.view", "stock.view_sale_price"]);
assert.equal(mergeSelectedStockPermissions({ existingPermissions: [], selectedStockPermissions: ["stock.nope"], targetRole: "OFFICE" }).ok, false);
assert.equal(mergeSelectedStockPermissions({ existingPermissions: [], selectedStockPermissions: ["stock.view"], targetRole: "PLATFORM_SUPER_ADMIN" }).ok, false);
assert.equal(hasStockPermission({ role: "ADMIN", permissions: [], requested: "stock.excel_import" }), true);
assert.equal(hasStockPermission({ role: "OFFICE", permissions: ["stock.view_sale_price"], requested: "stock.view_purchase_price" }), false);

const root=process.cwd();
const read=(r:string)=>fs.readFileSync(path.join(root,r),"utf8");
assert.match(read("src/app/api/admin/users/update/route.ts"),/STOCK_PERMISSION_UPDATE_FORBIDDEN/);
assert.match(read("src/app/ayarlar/page.tsx"),/StockPermissionEditor/);
assert.match(read("src/store/useAuthStore.ts"),/stockPermissions\?:\s*string\[\]/);
console.log("PAK_STOCK_PERMISSION_CONTRACT");