import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty read route derives active scope server side and filters every scope key",
  async () => {
    const source =
      await readFile(
        "src/app/api/finance/counterparty/movements/route.ts",
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
      /\.from\(\s*"counterparty_payable_movements"\s*\)/
    );

    for (
      const key of [
        "tenant_id",
        "company_id",
        "branch_id",
        "accounting_period_id"
      ]
    ) {
      assert.match(
        source,
        new RegExp(
          `\\.eq\\(\\s*"${key}"`
        )
      );
    }

    assert.match(
      source,
      /Cache-Control/
    );

    assert.doesNotMatch(
      source,
      /\.delete\(/
    );
  }
);