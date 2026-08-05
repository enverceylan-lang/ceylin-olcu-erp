import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty store rehydrates server truth without dropping unsynced local movements",
  async () => {
    const source =
      await readFile(
        "src/store/useCounterpartyPayableStore.ts",
        "utf8"
      );

    assert.match(
      source,
      /rehydrateFromServer/
    );

    assert.match(
      source,
      /fetchCounterpartyPayableMovements/
    );

    assert.match(
      source,
      /listCounterpartyPayableOutbox/
    );

    assert.match(
      source,
      /record\.status !==\s*"DONE"/
    );

    assert.match(
      source,
      /pendingLocal/
    );

    assert.match(
      source,
      /remoteIds/
    );

    assert.match(
      source,
      /otherScopes/
    );
  }
);