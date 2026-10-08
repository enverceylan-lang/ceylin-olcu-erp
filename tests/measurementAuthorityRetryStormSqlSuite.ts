import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "docs/sql/20260822_measurement_authority_v1.sql",
  "utf8",
);

assert.match(
  sql,
  /raise sqlstate 'PT409' using message = 'MEASUREMENT_COMMAND_IN_PROGRESS';/,
  "in-progress measurement command must use non-retryable HTTP 409 SQLSTATE",
);

assert.match(
  sql,
  /raise sqlstate 'PT409' using message = 'MEASUREMENT_STALE_VERSION';/,
  "stale measurement version must use non-retryable HTTP 409 SQLSTATE",
);

assert.doesNotMatch(
  sql,
  /errcode\s*=\s*'40001'[\s\S]{0,160}MEASUREMENT_(?:COMMAND_IN_PROGRESS|STALE_VERSION)/,
  "measurement business conflicts must not use serialization_failure SQLSTATE 40001",
);

const retryStormBusinessCodes = [
  "MEASUREMENT_COMMAND_IN_PROGRESS",
  "MEASUREMENT_STALE_VERSION",
];

for (const code of retryStormBusinessCodes) {
  const pt409Matches = sql.match(
    new RegExp(
      `raise sqlstate 'PT409' using message = '${code}';`,
      "g",
    ),
  ) || [];

  assert.equal(
    pt409Matches.length,
    1,
    `${code} must have exactly one PT409 raise`,
  );
}

console.log(
  "PASS measurementAuthorityRetryStormSqlSuite: measurement business conflicts use PT409 instead of 40001",
);
