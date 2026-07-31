import assert from "node:assert/strict";

import {
  readFileSync
} from "node:fs";

import {
  resolve
} from "node:path";

const sqlPath =
  resolve(
    process.cwd(),
    "docs/sql/20260731_finance_persistence_foundation_v1.sql"
  );

const sql =
  readFileSync(
    sqlPath,
    "utf8"
  );

assert.match(
  sql,
  /DURUM:\s*TASLAK/i
);

assert.match(
  sql,
  /CANLI SUPABASE['’]?E UYGULANMAYACAKTIR/i
);

for (
  const table of [
    "finance_transactions",
    "finance_transaction_audits"
  ]
) {
  assert.match(
    sql,
    new RegExp(
      `create table if not exists public\\.${table}`,
      "i"
    )
  );

  assert.match(
    sql,
    new RegExp(
      `alter table public\\.${table}\\s+enable row level security`,
      "i"
    )
  );

  assert.match(
    sql,
    new RegExp(
      `alter table public\\.${table}\\s+force row level security`,
      "i"
    )
  );
}

for (
  const scopeColumn of [
    "tenant_id",
    "company_id",
    "branch_id",
    "accounting_period_id"
  ]
) {
  assert.match(
    sql,
    new RegExp(
      `${scopeColumn}\\s+text\\s+not null`,
      "i"
    )
  );
}

for (
  const identityColumn of [
    "transaction_id",
    "idempotency_key",
    "customer_id",
    "sale_id",
    "source_document_id"
  ]
) {
  assert.match(
    sql,
    new RegExp(
      `${identityColumn}\\s+text\\s+not null`,
      "i"
    )
  );
}

assert.match(
  sql,
  /unique\s*\(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*idempotency_key\s*\)/i
);

assert.match(
  sql,
  /foreign key\s*\(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*transaction_id\s*\)/i
);

assert.match(
  sql,
  /gross_amount\s*>\s*0/i
);

assert.match(
  sql,
  /net_amount\s*>\s*0/i
);

assert.match(
  sql,
  /direction in \('DEBIT', 'CREDIT'\)/i
);

assert.match(
  sql,
  /currency ~ '\^\[A-Z\]\{3\}\$'/i
);

assert.match(
  sql,
  /status <> 'POSTED' or\s*posted_at is not null/i
);

assert.match(
  sql,
  /revoke all\s+on table public\.finance_transactions\s+from anon, authenticated/i
);

assert.match(
  sql,
  /revoke delete\s+on table public\.finance_transactions\s+from anon, authenticated, service_role/i
);

assert.match(
  sql,
  /on delete restrict/i
);

assert.doesNotMatch(
  sql,
  /on delete cascade/i
);

assert.doesNotMatch(
  sql,
  /drop table/i
);

assert.doesNotMatch(
  sql,
  /truncate/i
);

console.log(
  "financePersistenceSqlContractSuite: PASS"
);