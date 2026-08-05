import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty payable foundation enforces scope idempotency rls and no delete",
  async () => {
    const sql =
      (
        await readFile(
          "docs/sql/20260805_counterparty_payable_persistence_foundation_v1.sql",
          "utf8"
        )
      ).toLowerCase();

    assert.match(
      sql,
      /create table if not exists public\.counterparty_payable_movements/
    );

    assert.match(
      sql,
      /unique\s*\(\s*tenant_id,\s*company_id,\s*branch_id,\s*accounting_period_id,\s*idempotency_key\s*\)/
    );

    assert.match(
      sql,
      /enable row level security/
    );

    assert.match(
      sql,
      /revoke insert, update, delete/
    );

    assert.match(
      sql,
      /revoke delete/
    );

    assert.match(
      sql,
      /movement_kind in \('accrual','payment','reversal'\)/
    );

    assert.match(
      sql,
      /amount > 0/
    );

    assert.match(
      sql,
      /currency = 'try'/
    );
  }
);