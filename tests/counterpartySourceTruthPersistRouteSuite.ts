import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty source truth persist route derives auth actor and exact server scope",
  async () => {
    const source =
      await readFile(
        "src/app/api/finance/counterparty/source-truth/persist/route.ts",
        "utf8"
      );

    assert.match(
      source,
      /await verifyAuth\(\s*request\s*\)/
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
      /erpScopeMatches\(\s*requestedSourceScope,\s*context\.scope\s*\)/
    );

    assert.match(
      source,
      /userId:\s*String\(user\.id\)/
    );

    assert.match(
      source,
      /persistSupplierReceiptSource/
    );

    assert.match(
      source,
      /persistProviderEarningSource/
    );

    assert.doesNotMatch(
      source,
      /body\.actor/
    );

    assert.doesNotMatch(
      source,
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/
    );
  }
);