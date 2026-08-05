import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty source truth foundation is scoped, immutable and historical",
  async () => {
    const sql =
      await readFile(
        "docs/sql/20260805_counterparty_source_truth_foundation_v1.sql",
        "utf8"
      );

    assert.match(
      sql,
      /counterparty_supplier_receipt_sources/
    );

    assert.match(
      sql,
      /counterparty_provider_earning_sources/
    );

    for (
      const column of [
        "tenant_id",
        "company_id",
        "branch_id",
        "accounting_period_id"
      ]
    ) {
      assert.match(
        sql,
        new RegExp(
          `${column} text not null`
        )
      );
    }

    assert.match(
      sql,
      /received_quantity numeric/
    );

    assert.match(
      sql,
      /actual_purchase_unit_price numeric/
    );
assert.match(
      sql,
      /received_quantity \*\s*actual_purchase_unit_price/
    );

    assert.match(
      sql,
      /provider_type in \('TAILOR','INSTALLER'\)/
    );

    assert.match(
      sql,
      /status in \('FINALIZED','PARTIALLY_PAID','PAID'\)/
    );

    assert.match(
      sql,
      /finalized_amount > 0/
    );

    assert.match(
      sql,
      /enable row level security/
    );

    assert.match(
      sql,
      /revoke insert, update, delete[\s\S]*from anon, authenticated/
    );

    assert.match(
      sql,
      /revoke delete[\s\S]*from public/
    );

    assert.doesNotMatch(
      sql,
      /current.*price|stock.*price.*fallback/i
    );

    assert.match(
      sql,
      /INTERNAL providers have no row/
    );
  }
);