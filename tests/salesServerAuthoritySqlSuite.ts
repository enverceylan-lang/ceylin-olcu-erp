import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20260822_sales_and_sale_return_authority_v1.sql",
  "utf8",
);

assert.match(sql, /create table if not exists public\.sale_documents_v1/i);
assert.match(sql, /created_by_user_id text not null/i);
assert.match(sql, /primary key\s*\(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*sale_id/i);
assert.match(sql, /create or replace function public\.approve_sale_document_authority_v1/i);
assert.match(sql, /SALE_APPROVAL_MAKER_CHECKER_REJECTED/i);
assert.match(sql, /p_allow_self_approval boolean/i);
assert.match(sql, /for update/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path = pg_catalog, public/i);
assert.match(sql, /force row level security/i);
assert.match(sql, /revoke delete on table public\.sale_documents_v1/i);

assert.match(sql, /create table if not exists public\.sale_returns_v1/i);
assert.match(sql, /unique\s*\(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*idempotency_key/i);
assert.match(sql, /create table if not exists public\.sale_return_audits_v1/i);
assert.match(sql, /create or replace function public\.persist_sale_return_authority_v1/i);
assert.match(sql, /SALE_RETURN_IDEMPOTENCY_PAYLOAD_CONFLICT/i);
assert.match(sql, /SALE_RETURN_APPROVED_SALE_SOURCE_REQUIRED/i);
assert.doesNotMatch(sql, /\bdelete\s+from\b/i);

console.log("PAK: sales server authority sql");