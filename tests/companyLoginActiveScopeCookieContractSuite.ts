import assert from "node:assert/strict";
import test from "node:test";

import {
  readFile,
} from "node:fs/promises";

test(
  "company login writes verified user scope to active scope cookie",
  async () => {
    const source =
      await readFile(
        "src/app/api/auth/company-login/route.ts",
        "utf8",
      );

    const cookieCall =
      source.match(
        /response\.cookies\.set\(\s*ERP_ACTIVE_SCOPE_COOKIE,\s*scope\.user_scope_id,\s*\{[\s\S]*?\}\s*,?\s*\);/,
      );

    assert.ok(
      cookieCall,
      "Exact active-scope cookie write not found",
    );

    assert.doesNotMatch(
      cookieCall[0],
      /company\.company_id/,
    );

    assert.match(
      source,
      /return response;/,
    );
  },
);
