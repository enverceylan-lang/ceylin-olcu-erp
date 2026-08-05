import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

test(
  "counterparty store keeps local projection and queues server persistence",
  async () => {
    const source =
      await readFile(
        "src/store/useCounterpartyPayableStore.ts",
        "utf8"
      );

    assert.match(
      source,
      /enverp-counterparty-payable-v1/
    );

    assert.match(
      source,
      /enqueueAndAttemptCounterpartyPayablePersistence/
    );

    assert.match(
      source,
      /result\.movement/
    );

    assert.match(
      source,
      /registerAccrual/
    );

    assert.match(
      source,
      /registerPayment/
    );

    assert.match(
      source,
      /reverseMovement/
    );
  }
);