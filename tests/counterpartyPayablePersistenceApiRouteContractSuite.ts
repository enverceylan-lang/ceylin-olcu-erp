import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty persist route derives auth and scope server side",
  async () => {
    const source =
      await readFile(
        "src/app/api/finance/counterparty/persist/route.ts",
        "utf8"
      );

    assert.match(
      source,
      /await verifyAuth\(request\)/
    );

    assert.match(
      source,
      /SUPABASE_SERVICE_ROLE_KEY/
    );

    assert.match(
      source,
      /loadShadowErpContext/
    );

    assert.match(
      source,
      /readRequestedErpScopeId/
    );

    assert.match(
      source,
      /erpScopeMatches/
    );

    assert.match(
      source,
      /CounterpartyPayableSupabaseGatewayAdapter/
    );

    assert.match(
      source,
      /persistCounterpartyPayableMovement/
    );

    assert.doesNotMatch(
      source,
      /\.from\(\s*["']counterparty_payable_movements["']/
    );

    assert.doesNotMatch(
      source,
      /\.delete\(/
    );
  }
);