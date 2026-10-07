import "fake-indexeddb/auto";

import assert from "node:assert/strict";

import {
  advanceLocalMeasurementCanonicalVersion,
  localMeasurementDb,
} from "../src/lib/localMeasurementDb";
import {
  useMeasurementStore,
  type MeasurementRecord,
} from "../src/store/measurementStore";

const measurement: MeasurementRecord = {
  id: "measurement-ack-race",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  notes: "",
  status: "MEASURED",
  measuredBy: "ACK_RACE_TEST",
  measuredDate: "2026-10-06T00:00:00.000Z",
  notesHistory: [],
  photos: [],
  videos: [],
  customerId: "customer-ack-race",
  roomId: "room-ack-race",
  openingId: "opening-ack-race",
  windowId: "opening-ack-race",
  roomName: "NEW_LOCAL_ROOM_NAME",
  version: 1,
  selectedProducts: [],
  rawValues: {
    width: 123,
  },
};

async function main(): Promise<void> {
  await localMeasurementDb.measurements.clear();

  await localMeasurementDb.measurements.put(
    measurement,
  );

  useMeasurementStore.setState({
    measurements: [measurement],
  });

  const direct =
    await advanceLocalMeasurementCanonicalVersion(
      measurement.id,
      2,
    );

  assert.equal(direct?.version, 2);
  assert.equal(
    direct?.roomName,
    "NEW_LOCAL_ROOM_NAME",
    "version ACK must not replace local payload fields",
  );

  const advanced =
    await useMeasurementStore
      .getState()
      .advanceMeasurementCanonicalVersion(
        measurement.id,
        3,
      );

  assert.equal(advanced, true);

  const stateAfterAck =
    useMeasurementStore
      .getState()
      .measurements
      .find(
        (item) =>
          item.id === measurement.id,
      );

  assert.equal(stateAfterAck?.version, 3);
  assert.equal(
    stateAfterAck?.roomName,
    "NEW_LOCAL_ROOM_NAME",
  );

  const dbAfterAck =
    await localMeasurementDb.measurements.get(
      measurement.id,
    );

  assert.equal(dbAfterAck?.version, 3);
  assert.equal(
    dbAfterAck?.roomName,
    "NEW_LOCAL_ROOM_NAME",
  );

  const staleAck =
    await useMeasurementStore
      .getState()
      .advanceMeasurementCanonicalVersion(
        measurement.id,
        2,
      );

  assert.equal(staleAck, true);

  const afterStaleAck =
    await localMeasurementDb.measurements.get(
      measurement.id,
    );

  assert.equal(
    afterStaleAck?.version,
    3,
    "older ACK must never regress the canonical local version",
  );

  await localMeasurementDb.measurements.clear();
  useMeasurementStore.setState({
    measurements: [],
  });

  console.log(
    "PAK_MEASUREMENT_ACK_VERSION_ONLY_RACE",
  );
}

main().catch(async (error) => {
  try {
    await localMeasurementDb.measurements.clear();
  } catch {}

  useMeasurementStore.setState({
    measurements: [],
  });

  console.error(error);
  process.exitCode = 1;
});
