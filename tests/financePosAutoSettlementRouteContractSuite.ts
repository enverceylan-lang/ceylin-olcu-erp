import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  "src/app/api/finance/pos-auto-settlement/route.ts",
  "utf8"
);

const vercel = fs.readFileSync("vercel.json", "utf8");

assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(route, /authorization/);
assert.match(route, /Bearer \$\{cronSecret\}/);
assert.match(route, /run_finance_pos_auto_settlement_v1/);
assert.match(route, /Europe\/Istanbul/);
assert.match(route, /CALENDAR_DAY_V1/);
assert.match(route, /cache:\s*"no-store"/);

assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.doesNotMatch(route, /sessionToken/);

const parsed = JSON.parse(vercel) as {
  crons?: Array<{ path?: string; schedule?: string }>;
};

assert.ok(Array.isArray(parsed.crons));
assert.equal(parsed.crons?.length, 1);
assert.equal(
  parsed.crons?.[0]?.path,
  "/api/finance/pos-auto-settlement"
);
assert.equal(parsed.crons?.[0]?.schedule, "5 0 * * *");

console.log("FINANCE_POS_AUTO_SETTLEMENT_ROUTE_CONTRACT: PAK");
