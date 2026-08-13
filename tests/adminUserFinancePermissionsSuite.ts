import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mergeSelectedFinancePermissions,
} from "../src/lib/finance/userFinancePermissions";

const merged = mergeSelectedFinancePermissions({
  existingPermissions: [
    "dashboard",
    "custom.permission",
    "finance.legacy.vendor.key",
    "finance.cash.payment.create",
  ],
  selectedFinancePermissions: [
    "finance.cash.collection.create",
    "finance.cash.collection.create",
  ],
  targetRole: "OFFICE",
});
assert.equal(merged.ok, true);
if (!merged.ok) throw new Error("Expected valid permission update");
assert.equal(merged.permissions.includes("dashboard"), true);
assert.equal(merged.permissions.includes("custom.permission"), true);
assert.equal(
  merged.permissions.includes("finance.legacy.vendor.key"),
  true,
);
assert.equal(
  merged.permissions.includes("finance.cash.collection.create"),
  true,
);
assert.equal(
  merged.permissions.includes("finance.cash.payment.create"),
  false,
);
assert.equal(
  merged.permissions.filter(
    (permission) => permission === "finance.cash.collection.create",
  ).length,
  1,
);

const unknown = mergeSelectedFinancePermissions({
  existingPermissions: ["dashboard"],
  selectedFinancePermissions: ["finance.bank.magic.create"],
  targetRole: "OFFICE",
});
assert.deepEqual(unknown, {
  ok: false,
  code: "UNKNOWN_FINANCE_PERMISSION",
  invalidPermissions: ["finance.bank.magic.create"],
});

const platform = mergeSelectedFinancePermissions({
  existingPermissions: [],
  selectedFinancePermissions: ["finance.view"],
  targetRole: "PLATFORM_SUPER_ADMIN",
});
assert.equal(platform.ok, false);

const direction = mergeSelectedFinancePermissions({
  existingPermissions: [],
  selectedFinancePermissions: ["finance.bank.collection.create"],
  targetRole: "OFFICE",
});
assert.equal(direction.ok, true);
if (!direction.ok) throw new Error("Expected direction update");
assert.equal(
  direction.permissions.includes("finance.bank.payment.create"),
  false,
);

const route = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/api/admin/users/update/route.ts",
  ),
  "utf8",
);
assert.match(
  route,
  /requireCompanySession\([\s\S]*req,[\s\S]*"WEB"/,
);
assert.match(route, /hasFinancePermissionUpdate && !isAdmin/);
assert.match(route, /mergeSelectedFinancePermissions/);
assert.match(route, /updatedAt: now/);
assert.doesNotMatch(
  route.slice(route.indexOf("return NextResponse.json({")),
  /password:\s*userRecord\.password/,
);

console.log("[PASS] admin user finance permissions (11 implemented scenarios; scope model gap reported separately)");
