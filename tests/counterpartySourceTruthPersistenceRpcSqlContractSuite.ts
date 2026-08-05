import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty source truth persistence RPCs are server-only and idempotent",
  async () => {
    const sql =
      await readFile(
        "docs/sql/20260805_counterparty_source_truth_persistence_rpc_v1.sql",
        "utf8"
      );

    assert.match(
      sql,
      /persist_counterparty_supplier_receipt_source_v1/
    );

    assert.match(
      sql,
      /persist_counterparty_provider_earning_source_v1/
    );

    assert.match(
      sql,
      /security definer/
    );

    assert.match(
      sql,
      /set search_path = public/
    );

    assert.match(
      sql,
      /'status', 'CREATED'/
    );

    assert.match(
      sql,
      /'status', 'REPLAY'/
    );

    assert.match(
      sql,
      /'status', 'CONFLICT'/
    );

    assert.match(
      sql,
      /SOURCE_ID_CONFLICT/
    );

    assert.match(
      sql,
      /RECEIPT_ID_CONFLICT/
    );

    assert.match(
      sql,
      /purchaseVatRate/
    );

    assert.match(
      sql,
      /netAmount/
    );

    assert.match(
      sql,
      /payableAmount/
    );

    assert.match(
      sql,
      /EARNINGS_ENTRY_CONFLICT/
    );

    assert.match(
      sql,
      /INTERNAL_PROVIDER_NO_PAYABLE_SOURCE/
    );

    assert.match(
      sql,
      /revoke all[\s\S]*from public, anon, authenticated/
    );

    assert.match(
      sql,
      /grant execute[\s\S]*to service_role/
    );

    assert.doesNotMatch(
      sql,
      /grant execute[\s\S]*to authenticated/
    );

    assert.doesNotMatch(
      sql,
      /\bdelete from\b/i
    );
  }
);