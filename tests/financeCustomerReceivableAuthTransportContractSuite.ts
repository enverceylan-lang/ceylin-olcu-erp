import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();

const client = fs.readFileSync(
  path.join(
    repo,
    "src/lib/finance/customerReceivableReadClient.ts",
  ),
  "utf8",
);

const route = fs.readFileSync(
  path.join(
    repo,
    "src/app/api/finance/customer-receivable/route.ts",
  ),
  "utf8",
);

assert.match(
  client,
  /import\s+\{\s*useAuthStore\s*\}\s+from\s+["']@\/store\/useAuthStore["']/,
);

assert.match(
  client,
  /useAuthStore\.getState\(\)\.sessionToken\?\.trim\(\)/,
);

assert.match(
  client,
  /if\s*\(\s*!sessionToken\s*\)\s*\{[\s\S]*?throw new Error\(["']UNAUTHORIZED["']\)/,
);

assert.match(
  client,
  /Authorization:\s*`Bearer \$\{sessionToken\}`/,
);

assert.doesNotMatch(
  client,
  /Bearer \$\{[^}]*\|\|\s*["']["']/,
);

assert.match(
  route,
  /verifyAuth\s*\(\s*req\s*\)/,
);

assert.doesNotMatch(
  client,
  /localFinanceDb|listLocalFinanceTransactions/,
);

console.log(
  "[PASS] finance customer receivable auth transport contract",
);