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
assert.match(route, /supabaseStatus:\s*response\.status/);
assert.match(route, /supabaseCode:\s*safeSupabaseErrorCode\(errorPayload\)/);
assert.match(route, /hasMessage:\s*hasNonEmptyString\(errorPayload\?\.message\)/);
assert.match(route, /hasDetails:\s*hasNonEmptyString\(errorPayload\?\.details\)/);
assert.match(route, /hasHint:\s*hasNonEmptyString\(errorPayload\?\.hint\)/);
assert.match(route, /errorTokenClass:\s*rpcErrorTokenClass\(errorPayload\)/);
assert.match(route, /code:\s*"POS_AUTO_SETTLEMENT_RPC_FAILED"/);
assert.match(route, /\{\s*status:\s*502\s*\}/);
assert.match(route, /POS_AUTO_SETTLEMENT_CRON_UNAUTHORIZED/);
assert.match(route, /POS_AUTO_SETTLEMENT_CRON_SECRET_MISSING/);
assert.match(route, /POS_AUTO_SETTLEMENT_SERVER_CONFIG_MISSING/);
assert.match(route, /SAFE_RPC_ERROR_TOKEN_CLASSES/);
const rpcFailureLogMatch = route.match(
  /console\.error\("\[POS Auto Settlement\] RPC failed",\s*\{([\s\S]*?)\}\s*\);/
);
assert.ok(rpcFailureLogMatch);

const rpcFailureLogBody = rpcFailureLogMatch[1];
assert.doesNotMatch(rpcFailureLogBody, /\bmessage\s*:/);
assert.doesNotMatch(rpcFailureLogBody, /\bdetails\s*:/);
assert.doesNotMatch(rpcFailureLogBody, /\bhint\s*:/);
assert.doesNotMatch(rpcFailureLogBody, /\bpayload\b/);
assert.doesNotMatch(
  rpcFailureLogBody,
  /\b(?:serviceRoleKey|cronSecret|Authorization|apikey)\b/
);
assert.equal(
  (route.match(/run_finance_pos_auto_settlement_v1/g) ?? []).length,
  1
);

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
