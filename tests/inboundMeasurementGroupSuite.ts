import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  localDraftDb,
  saveInboundMeasurement,
  type InboundMeasurement,
} from "../src/lib/localDraftDb";

let failed = false;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

async function runTest(
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await localDraftDb.inboundMeasurements.clear();
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed = true;
    console.error(
      `[FAIL] ${name} -> ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function createInbound(
  overrides: Partial<InboundMeasurement> = {},
): InboundMeasurement {
  return {
    changeId: "measurement-group-change-1",
    revision: 1,
    entityType: "MEASUREMENT_GROUP",
    entityId: "source-customer-1",
    operation: "UPDATE",
    sourceTable: "measurement_changes",
    customerName: "TEST CARISI 01",
    customerPhone: "5551112233",
    customerAddress: "Test adresi",
    patch: {
      customerId: "source-customer-1",
      temporaryCustomerId: "source-customer-1",
      sourceMeasurementChangeId: "measurement-change-1",
      measurements: [],
    },
    senderId: "field-user-1",
    createdAt: "2026-07-31T10:00:00.000Z",
    status: "NEW",
    suggestedCustomerIds: [],
    ...overrides,
  };
}

async function main(): Promise<void> {
  await runTest(
    "separatePullRoundsMergeMeasurementsById",
    async () => {
      const first = createInbound({
        patch: {
          customerId: "source-customer-1",
          temporaryCustomerId: "source-customer-1",
          sourceMeasurementChangeId: "measurement-change-1",
          measurements: [
            {
              id: "measurement-1",
              customerId: "source-customer-1",
              roomId: "room-1",
              openingId: "opening-1",
              width: 100,
            },
            {
              customerId: "source-customer-1",
              roomId: "room-idless",
              openingId: "opening-idless",
              width: 90,
            },
          ],
        },
      });

      const second = createInbound({
        changeId: "measurement-group-change-2",
        revision: 2,
        patch: {
          customerId: "source-customer-1",
          temporaryCustomerId: "source-customer-1",
          sourceMeasurementChangeId: "measurement-change-2",
          measurements: [
            {
              id: "measurement-1",
              customerId: "source-customer-1",
              roomId: "room-1",
              openingId: "opening-1",
              width: 125,
            },
            {
              id: "measurement-2",
              customerId: "source-customer-1",
              roomId: "room-2",
              openingId: "opening-2",
              width: 200,
            },
          ],
        },
      });

      const firstOutcome = await saveInboundMeasurement(first);
      const secondOutcome = await saveInboundMeasurement(second);

      assert(
        firstOutcome === "INSERTED",
        `First outcome was ${firstOutcome}`,
      );
      assert(
        secondOutcome === "UPDATED_OPEN_ITEM",
        `Second outcome was ${secondOutcome}`,
      );

      const rows = await localDraftDb.inboundMeasurements.toArray();
      assert(rows.length === 1, "Open group was duplicated");

      const measurements = (
        rows[0]?.patch as {
          measurements?: Array<{
            id?: string;
            width?: number;
            roomId?: string;
          }>;
        }
      )?.measurements;

      assert(
        Array.isArray(measurements),
        "Merged measurements were not persisted",
      );
      assert(
        measurements.length === 3,
        `Expected 3 measurements, received ${measurements.length}`,
      );

      const measurement1 = measurements.find(
        (measurement) => measurement.id === "measurement-1",
      );
      const measurement2 = measurements.find(
        (measurement) => measurement.id === "measurement-2",
      );
      const idless = measurements.find(
        (measurement) => measurement.roomId === "room-idless",
      );

      assert(
        measurement1?.width === 125,
        "Latest payload did not win for the same measurement id",
      );
      assert(
        measurement2?.width === 200,
        "New measurement was not added",
      );
      assert(
        idless?.width === 90,
        "Id-less measurement was not preserved",
      );
    },
  );

  await runTest(
    "deltaSyncClientRejectsEmptyMeasurementGroups",
    async () => {
      const source = await readFile(
        path.join(
          process.cwd(),
          "src",
          "lib",
          "deltaSyncClient.ts",
        ),
        "utf8",
      );

      assert(
        source.includes(
          "if (!Array.isArray(group.measurements) || group.measurements.length === 0)",
        ),
        "Empty measurement-group guard is missing",
      );
      assert(
        source.includes(
          "Empty measurement group was not added to inbound pool",
        ),
        "Empty measurement-group diagnostic is missing",
      );
      assert(
        source.includes("alreadyRecorded += 1;"),
        "Empty measurement-group outcome counter is missing",
      );
      assert(
        source.includes("continue;"),
        "Empty measurement-group guard does not stop pool insertion",
      );
    },
  );

  await runTest(
    "inboundProcessorContainsBothApprovalPaths",
    async () => {
      const source = await readFile(
        path.join(
          process.cwd(),
          "src",
          "lib",
          "inboundProcessor.ts",
        ),
        "utf8",
      );

      const relatedLoadCount = (
        source.match(
          /await loadRelatedMeasurementGroups\(sourceCustomerIds\);/g,
        ) || []
      ).length;

      assert(
        source.includes(
          "measurements?: MeasurementPayload[];",
        ),
        "InboundPatch measurements contract is missing",
      );
      assert(
        source.includes(
          "async function loadRelatedMeasurementGroups(",
        ),
        "Related measurement-group loader is missing",
      );
      assert(
        source.includes(
          "async function completeRelatedMeasurementGroups(",
        ),
        "Related measurement-group completion helper is missing",
      );
      assert(
        relatedLoadCount === 2,
        `Expected loader in 2 approval paths, received ${relatedLoadCount}`,
      );
      assert(
        source.includes(
          '    "CREATED_CUSTOMER",',
        ),
        "New-customer completion path is missing",
      );
      assert(
        source.includes(
          '    "LINKED_TO_CUSTOMER",',
        ),
        "Merge completion path is missing",
      );
    },
  );

  await localDraftDb.inboundMeasurements.clear();

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log(
    "[PASS] inboundMeasurementGroupSuite completed",
  );
}

void main();
