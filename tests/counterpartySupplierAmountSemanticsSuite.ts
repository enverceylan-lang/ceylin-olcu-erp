import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "supplier receipt source truth preserves historical VAT-inclusive payable semantics",
  async () => {
    const sql =
      await readFile(
        "docs/sql/20260805_counterparty_source_truth_foundation_v1.sql",
        "utf8"
      );

    assert.match(
      sql,
      /actual_purchase_unit_price numeric/
    );

    assert.match(
      sql,
      /purchase_vat_rate numeric/
    );

    assert.match(
      sql,
      /net_amount numeric/
    );

    assert.match(
      sql,
      /payable_amount numeric/
    );

    assert.match(
      sql,
      /received_quantity \*\s*actual_purchase_unit_price/
    );

    assert.match(
      sql,
      /net_amount \*\s*\(\s*1 \+\s*purchase_vat_rate \/ 100/
    );

    assert.match(
      sql,
      /amount = payable_amount/
    );

    assert.doesNotMatch(
      sql,
      /actual_amount numeric/
    );
  }
);