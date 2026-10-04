import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(
  "docs/sql/20261004_finance_pos_auto_settlement_executor_v1.sql",
  "utf8"
);

assert.match(
  sql,
  /create or replace function public\.run_finance_pos_auto_settlement_v1/i
);

assert.match(
  sql,
  /auth\.role\(\) is distinct from 'service_role'/i
);

assert.match(
  sql,
  /expected_settlement_date\s*<=\s*p_effective_date/i
);

assert.match(
  sql,
  /status in \('PENDING','PARTIALLY_SETTLED'\)/i
);

assert.match(
  sql,
  /pending_amount\s*>\s*0/i
);

assert.match(
  sql,
  /for update of l skip locked/i
);

assert.match(
  sql,
  /POS:AUTO_SETTLE:/i
);

assert.match(
  sql,
  /persist_finance_pos_authority_v1/i
);

assert.match(
  sql,
  /SETTLE_TRANSACTION/i
);

assert.match(
  sql,
  /SYSTEM:POS_AUTO_SETTLEMENT/i
);

assert.match(
  sql,
  /r\.expected_settlement_date::text/i
);

assert.doesNotMatch(
  sql,
  /update\s+public\.finance_pos_settlement_lines_v1/i
);

assert.doesNotMatch(
  sql,
  /update\s+public\.finance_transactions/i
);

assert.doesNotMatch(
  sql,
  /from\s+public\.finance_pos_contract_rules_v1/i
);

assert.match(
  sql,
  /CALENDAR_DAY/i
);

assert.match(
  sql,
  /grant execute on function public\.run_finance_pos_auto_settlement_v1\(date,integer\)\s*to service_role/i
);

console.log("FINANCE_POS_AUTO_SETTLEMENT_SQL_CONTRACT: PAK");
