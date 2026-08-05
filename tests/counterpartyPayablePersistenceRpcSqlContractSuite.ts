import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty payable rpc is atomic security definer and replay aware",
  async () => {
    const sql =
      (
        await readFile(
          "docs/sql/20260805_counterparty_payable_persistence_rpc_v1.sql",
          "utf8"
        )
      ).toLowerCase();

    assert.match(
      sql,
      /create or replace function public\.persist_counterparty_payable_movement_v1/
    );

    assert.match(
      sql,
      /security definer/
    );

    assert.match(
      sql,
      /counterparty_payable_scope_required/
    );

    assert.match(
      sql,
      /idempotency_payload_conflict/
    );

    assert.match(
      sql,
      /insert into public\.counterparty_payable_movements/
    );

    assert.match(
      sql,
      /insert into public\.counterparty_payable_audits/
    );

    assert.match(
      sql,
      /revoke all/
    );

    assert.match(
      sql,
      /grant execute/
    );
  }
);