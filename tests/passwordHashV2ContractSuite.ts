import assert from "node:assert/strict";

import {
  hashPassword,
  hashPasswordV2,
  verifyPassword,
} from "../src/lib/authHelper";

const originalHashSalt =
  process.env.HASH_SALT;

const originalSessionSecret =
  process.env.SESSION_SECRET;

try {
  process.env.HASH_SALT =
    "legacy-contract-a";

  process.env.SESSION_SECRET =
    "session-contract-a";

  const v2a =
    hashPasswordV2(
      "Sifre-12345",
    );

  const v2b =
    hashPasswordV2(
      "Sifre-12345",
    );

  assert.notEqual(
    v2a,
    v2b,
    "V2 hashes must use random per-password salts",
  );

  assert.equal(
    verifyPassword(
      v2a,
      "Sifre-12345",
    ).valid,
    true,
  );

  assert.equal(
    verifyPassword(
      v2a,
      "Yanlis-12345",
    ).valid,
    false,
  );

  process.env.HASH_SALT =
    "legacy-contract-b";

  process.env.SESSION_SECRET =
    "session-contract-b";

  assert.equal(
    verifyPassword(
      v2a,
      "Sifre-12345",
    ).valid,
    true,
    "V2 verification must not depend on deployment HASH_SALT/SESSION_SECRET",
  );

  process.env.HASH_SALT =
    "legacy-contract-a";

  process.env.SESSION_SECRET =
    "session-contract-a";

  const legacy =
    hashPassword(
      "Legacy-12345",
    );

  const legacyMatch =
    verifyPassword(
      legacy,
      "Legacy-12345",
    );

  assert.equal(
    legacyMatch.valid,
    true,
  );

  assert.equal(
    legacyMatch.needsRehash,
    true,
  );

  process.env.HASH_SALT =
    "legacy-contract-b";

  const legacyMismatch =
    verifyPassword(
      legacy,
      "Legacy-12345",
    );

  assert.equal(
    legacyMismatch.valid,
    false,
    "Legacy hash demonstrates the old environment-coupling problem",
  );

  console.log(
    "PASSWORD_HASH_V2_CONTRACT_SUITE: PAK",
  );
}
finally {
  if (
    originalHashSalt === undefined
  ) {
    delete process.env.HASH_SALT;
  }
  else {
    process.env.HASH_SALT =
      originalHashSalt;
  }

  if (
    originalSessionSecret ===
      undefined
  ) {
    delete process.env.SESSION_SECRET;
  }
  else {
    process.env.SESSION_SECRET =
      originalSessionSecret;
  }
}