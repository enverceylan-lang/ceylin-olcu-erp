import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  localDraftDb,
  saveInboundMeasurement,
  type InboundMeasurement,
} from "../src/lib/localDraftDb";

function createInbound(
  changeId: string,
): InboundMeasurement {
  return {
    changeId,
    revision: 1,
    entityType: "DRAFT",
    entityId: "customer-race-1",
    operation: "INSERT",
    sourceTable: "draft_changes",
    createdAt: "2026-08-11T12:00:00.000Z",
    status: "NEW",
    patch: {
      customerName: "Race Test",
    },
  };
}

test(
  "concurrent replay of same inbound event produces one record",
  async () => {
    await localDraftDb.delete();
    await localDraftDb.open();

    const item =
      createInbound("race-change-001");

    const results =
      await Promise.all([
        saveInboundMeasurement(item),
        saveInboundMeasurement(item),
      ]);

    assert.equal(
      results.filter(
        result => result === "INSERTED",
      ).length,
      1,
    );

    assert.equal(
      results.filter(
        result => result === "ALREADY_RECORDED",
      ).length,
      1,
    );

    const rows =
      await localDraftDb
        .inboundMeasurements
        .toArray();

    assert.equal(rows.length, 1);
    assert.equal(
      rows[0]?.changeId,
      "race-change-001",
    );

    await localDraftDb.delete();
  },
);
