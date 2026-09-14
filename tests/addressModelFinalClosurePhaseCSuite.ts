import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) =>
  fs.readFileSync(path.join(root, rel), "utf8");

const contract = read("src/lib/salesServerAuthorityContracts.ts");
const runtime = read("src/lib/salesAuthorityRuntimeClient.ts");
const persistRoute = read("src/app/api/sales/authority/persist/route.ts");
const syncRoute = read("src/app/api/sync/customers/route.ts");
const saleSql = read("docs/sql/20260822_sales_and_sale_return_authority_v1.sql");
const addressSql = read("docs/sql/20260823_customer_address_authority_v1.sql");

assert.match(contract, /customerAddressId\?: string \| null/);
assert.match(contract, /customerAddressSnapshot\?: SaleAuthorityAddressSnapshot \| null/);
assert.match(contract, /SALE_AUTHORITY_ADDRESS_PAIR_REQUIRED/);

assert.match(runtime, /customerAddressId: input\.sale\.customerAddressId \|\| null/);
assert.match(runtime, /customerAddressSnapshot: input\.sale\.customerAddressSnapshot \|\| null/);
assert.match(persistRoute, /customerAddressSnapshot: body\.customerAddressSnapshot \?\? null/);

assert.match(saleSql, /customer_address_id text null/);
assert.match(saleSql, /customer_address_snapshot jsonb null/);
assert.match(saleSql, /SALE_AUTHORITY_CUSTOMER_ADDRESS_PARENT_MISMATCH/);
assert.match(saleSql, /v_existing\.customer_address_id is distinct from v_customer_address_id/);
assert.doesNotMatch(
  saleSql,
  /set[\s\S]{0,250}customer_address_snapshot=v_customer_address_snapshot/,
);

assert.match(syncRoute, /CUSTOMER_ADDRESS_EXPECTED_VERSION_MISSING/);
assert.match(syncRoute, /changeId: addressChangeId/);
assert.match(syncRoute, /expectedVersion: addressExpectedVersion/);
assert.match(syncRoute, /actorUserId: user\.id/);

assert.match(addressSql, /customer_address_command_receipts/);
assert.match(addressSql, /customer_address_audits/);
assert.match(addressSql, /CUSTOMER_ADDRESS_IDEMPOTENCY_CONFLICT/);
assert.match(addressSql, /CUSTOMER_ADDRESS_VERSION_CONFLICT/);
assert.match(addressSql, /CUSTOMER_ADDRESS_IN_USE_BY_ROOM/);
assert.match(addressSql, /CUSTOMER_ADDRESS_IN_USE_BY_MEASUREMENT/);
assert.match(addressSql, /entity_version = entity_version \+ 1/);
assert.match(addressSql, /when p_address \? 'phone'/);
assert.match(addressSql, /outcome = 'COMPLETED'/);
assert.doesNotMatch(addressSql, /delete from public\.customer_addresses/i);

console.log("PAK_ADDRESS_MODEL_FINAL_PHASE_C_SOURCE_SUITE");