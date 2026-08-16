import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projection = readFileSync(
  resolve("src/lib/finance/saleFinanceProjection.ts"),
  "utf8"
);
const sql = readFileSync(
  resolve("docs/sql/20260815_finance_operations_v1_server_persistence.sql"),
  "utf8"
);

assert.match(projection, /payment\.id/);
assert.match(
  projection,
  /finance:sale:\$\{sourceKey\(input\.sale\.id\)\}:payment:\$\{sourceKey\(payment\.id\)\}/
);
assert.match(sql, /source_document_id/);
assert.match(sql, /coalesce\(operation_leg,'SINGLE'\)/);

console.log("[PASS] Finance Operations source-document event cardinality");