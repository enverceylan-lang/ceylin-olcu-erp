import "fake-indexeddb/auto";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  localDraftDb,
  listInboundMeasurements,
  saveInboundMeasurement,
  type InboundMeasurement,
} from "../src/lib/localDraftDb";
import { localCustomerDb } from "../src/lib/localCustomerDb";
import { localMeasurementDb } from "../src/lib/localMeasurementDb";
import { processAsMerge } from "../src/lib/inboundProcessor";
import { useMeasurementStore } from "../src/store/measurementStore";
import { type Customer, useStore } from "../src/store/useStore";
import type { ErpScope } from "../src/lib/erpScope";

let failed = false;

const SCOPE_A: ErpScope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "period-a",
};

const SCOPE_B: ErpScope = {
  tenantId: "tenant-b",
  companyId: "company-b",
  branchId: "branch-b",
  accountingPeriodId: "period-b",
};

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expected: RegExp,
  message: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    assert(
      error instanceof Error && expected.test(error.message),
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  throw new Error(`${message}: rejection was expected`);
}

async function runTest(
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await localDraftDb.inboundMeasurements.clear();
    await localCustomerDb.customers.clear();
    await localMeasurementDb.measurements.clear();
    useStore.setState({ customers: [] });
    useMeasurementStore.setState({ measurements: [] });
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
    ...SCOPE_A,
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
    "verifiedReplayRehydratesOnlyExactFullyUnscopedLegacyEvent",
    async () => {
      const legacy = createInbound({
        tenantId: undefined,
        companyId: undefined,
        branchId: undefined,
        accountingPeriodId: undefined,
        changeId: "legacy-replay-change",
        revision: 7,
        entityType: "CUSTOMER",
        entityId: "legacy-source-customer",
        sourceTable: "draft_changes",
        status: "CREATED_CUSTOMER",
        linkedCustomerId: "canonical-customer-a",
        patch: {
          customerId: "legacy-source-customer",
          customerName: "LEGACY PRESERVED",
        },
      });
      await localDraftDb.inboundMeasurements.put(legacy);

      const replay = createInbound({
        changeId: legacy.changeId,
        revision: legacy.revision,
        entityType: legacy.entityType,
        entityId: legacy.entityId,
        sourceTable: legacy.sourceTable,
        status: "NEW",
        patch: {
          customerId: "legacy-source-customer",
          customerName: "REPLAY MUST NOT OVERWRITE",
        },
      });

      assert(
        (await saveInboundMeasurement(replay, {
          verifiedReplayScope: SCOPE_A,
        })) === "ALREADY_RECORDED",
        "Verified replay did not reuse the exact legacy event",
      );

      const persisted = await localDraftDb.inboundMeasurements.get(
        legacy.changeId,
      );
      assert(persisted?.tenantId === SCOPE_A.tenantId, "tenantId was not rehydrated");
      assert(persisted?.companyId === SCOPE_A.companyId, "companyId was not rehydrated");
      assert(persisted?.branchId === SCOPE_A.branchId, "branchId was not rehydrated");
      assert(
        persisted?.accountingPeriodId === SCOPE_A.accountingPeriodId,
        "accountingPeriodId was not rehydrated",
      );
      assert(
        persisted?.status === "CREATED_CUSTOMER",
        "Legacy status was overwritten during scope rehydration",
      );
      assert(
        persisted?.linkedCustomerId === "canonical-customer-a",
        "Legacy linkedCustomerId was overwritten during scope rehydration",
      );
      assert(
        persisted?.patch.customerName === "LEGACY PRESERVED",
        "Legacy patch was overwritten during scope rehydration",
      );
    },
  );

  await runTest(
    "legacyReplayRequiresVerifiedScopeAndRejectsAmbiguousOwnership",
    async () => {
      const baseLegacy = createInbound({
        tenantId: undefined,
        companyId: undefined,
        branchId: undefined,
        accountingPeriodId: undefined,
        changeId: "legacy-guard-change",
        entityType: "CUSTOMER",
        entityId: "legacy-guard-customer",
        sourceTable: "draft_changes",
      });

      await localDraftDb.inboundMeasurements.put(baseLegacy);
      const replay = createInbound({
        changeId: baseLegacy.changeId,
        entityType: baseLegacy.entityType,
        entityId: baseLegacy.entityId,
        sourceTable: baseLegacy.sourceTable,
      });

      await assertRejects(
        () => saveInboundMeasurement(replay),
        /INBOUND_CHANGE_SCOPE_CONFLICT/,
        "Unverified caller claimed a legacy event",
      );

      await localDraftDb.inboundMeasurements.put({
        ...baseLegacy,
        tenantId: SCOPE_A.tenantId,
      });
      await assertRejects(
        () =>
          saveInboundMeasurement(replay, {
            verifiedReplayScope: SCOPE_A,
          }),
        /INBOUND_CHANGE_SCOPE_CONFLICT/,
        "Partially scoped legacy event was rehydrated",
      );

      await localDraftDb.inboundMeasurements.put({
        ...baseLegacy,
        ...SCOPE_B,
      });
      await assertRejects(
        () =>
          saveInboundMeasurement(replay, {
            verifiedReplayScope: SCOPE_A,
          }),
        /INBOUND_CHANGE_SCOPE_CONFLICT/,
        "Foreign scoped event was claimed by Scope A",
      );

      await localDraftDb.inboundMeasurements.put(baseLegacy);
      await assertRejects(
        () =>
          saveInboundMeasurement(
            { ...replay, entityId: "different-customer" },
            { verifiedReplayScope: SCOPE_A },
          ),
        /INBOUND_CHANGE_SCOPE_CONFLICT/,
        "Mismatched immutable identity was rehydrated",
      );
    },
  );

  await runTest(
    "verifiedReplayRehydratesLegacyLatestChangeOwner",
    async () => {
      const legacyOwner = createInbound({
        tenantId: undefined,
        companyId: undefined,
        branchId: undefined,
        accountingPeriodId: undefined,
        changeId: "legacy-owner-change",
        latestChangeId: "legacy-latest-change",
        revision: 9,
        entityType: "MEASUREMENT_GROUP",
        entityId: "legacy-owner-customer",
        status: "SKIPPED",
      });
      await localDraftDb.inboundMeasurements.put(legacyOwner);

      const replay = createInbound({
        changeId: "legacy-latest-change",
        revision: 9,
        entityType: legacyOwner.entityType,
        entityId: legacyOwner.entityId,
        sourceTable: legacyOwner.sourceTable,
      });

      assert(
        (await saveInboundMeasurement(replay, {
          verifiedReplayScope: SCOPE_A,
        })) === "ALREADY_RECORDED",
        "Verified latestChangeId replay was not recognized",
      );

      const persisted = await localDraftDb.inboundMeasurements.get(
        legacyOwner.changeId,
      );
      assert(
        persisted?.companyId === SCOPE_A.companyId,
        "latestChangeId owner scope was not rehydrated",
      );
      assert(
        persisted?.status === "SKIPPED",
        "latestChangeId owner status was overwritten",
      );
    },
  );

  await runTest(
    "deltaSyncClientOptsIntoVerifiedReplayScopeForAllInboundWrites",
    async () => {
      const source = await readFile(
        path.join(process.cwd(), "src", "lib", "deltaSyncClient.ts"),
        "utf8",
      );
      const replayScopeCount = (
        source.match(/verifiedReplayScope: activeScope/g) || []
      ).length;
      assert(
        replayScopeCount === 3,
        `Expected 3 verified inbound replay call sites, received ${replayScopeCount}`,
      );
    },
  );

  await runTest(
    "sameEntityIdentityDoesNotCompactAcrossScopes",
    async () => {
      const scopeAFirst = createInbound({
        changeId: "scope-a-change-1",
        revision: 1,
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "scope-a-measurement",
              customerId: "shared-source-customer",
              roomId: "scope-a-room",
              openingId: "scope-a-opening",
              width: 100,
            },
          ],
        },
      });
      const scopeBFirst = createInbound({
        ...SCOPE_B,
        changeId: "scope-b-change-1",
        revision: 1,
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "scope-b-measurement",
              customerId: "shared-source-customer",
              roomId: "scope-b-room",
              openingId: "scope-b-opening",
              width: 200,
            },
          ],
        },
      });
      const scopeASecond = createInbound({
        changeId: "scope-a-change-2",
        revision: 2,
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "scope-a-measurement",
              customerId: "shared-source-customer",
              roomId: "scope-a-room",
              openingId: "scope-a-opening",
              width: 125,
            },
          ],
        },
      });

      assert(
        (await saveInboundMeasurement(scopeAFirst)) === "INSERTED",
        "Scope A first event was not inserted",
      );
      assert(
        (await saveInboundMeasurement(scopeBFirst)) === "INSERTED",
        "Scope B event was compacted into Scope A",
      );
      assert(
        (await saveInboundMeasurement(scopeASecond)) === "UPDATED_OPEN_ITEM",
        "Scope A newer revision did not compact inside Scope A",
      );

      const scopeARows = await listInboundMeasurements(SCOPE_A);
      const scopeBRows = await listInboundMeasurements(SCOPE_B);
      assert(scopeARows.length === 1, "Scope A row count changed unexpectedly");
      assert(scopeBRows.length === 1, "Scope B row was lost or merged");
      assert(
        scopeARows[0]?.latestChangeId === "scope-a-change-2",
        "Scope A did not retain its own latest revision",
      );
      assert(
        scopeBRows[0]?.changeId === "scope-b-change-1",
        "Scope B identity was rewritten by Scope A",
      );
      const scopeBMeasurements = scopeBRows[0]?.patch.measurements as
        | Array<{ width?: number }>
        | undefined;
      assert(
        scopeBMeasurements?.[0]?.width === 200,
        "Scope B payload was overwritten during Scope A compaction",
      );
    },
  );

  await runTest(
    "approvalDoesNotReparentOrCompleteForeignScopeMeasurements",
    async () => {
      const now = "2026-09-19T10:00:00.000Z";
      const targetCustomer = {
        ...SCOPE_A,
        id: "target-customer-a",
        name: "TARGET A",
        phone: "",
        address: "",
        mapLocation: "",
        notes: "",
        rooms: [],
        createdAt: now,
        updatedAt: now,
        addressPhotos: [],
        isDeleted: false,
      } as Customer;
      const foreignSourceCustomer = {
        ...SCOPE_B,
        id: "shared-source-customer",
        name: "FOREIGN SOURCE B",
        phone: "",
        address: "",
        mapLocation: "",
        notes: "",
        rooms: [],
        createdAt: now,
        updatedAt: now,
        addressPhotos: [],
        isDeleted: false,
      } as Customer;

      await localCustomerDb.customers.bulkPut([
        targetCustomer,
        foreignSourceCustomer,
      ]);
      useStore.setState({ customers: [targetCustomer, foreignSourceCustomer] });

      await localMeasurementDb.measurements.put({
        id: "foreign-local-measurement",
        customerId: "shared-source-customer",
        roomId: "foreign-room",
        openingId: "foreign-opening",
        windowId: "foreign-opening",
        templateType: "STOR_PERDE",
        rawValues: { width: 999, height: 999 },
        notes: "",
        status: "DRAFT",
        measuredBy: "foreign-user",
        measuredDate: now,
        notesHistory: [],
        photos: [],
        videos: [],
        createdAt: now,
        updatedAt: now,
      });

      const approvalInbound = createInbound({
        changeId: "approval-a",
        entityType: "CUSTOMER",
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "approved-a-measurement",
              customerId: "shared-source-customer",
              roomId: "approved-a-room",
              openingId: "approved-a-opening",
              templateType: "STOR_PERDE",
              rawValues: { width: 120, height: 220 },
            },
          ],
        },
      });
      const relatedScopeA = createInbound({
        changeId: "related-a",
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "related-a-measurement",
              customerId: "shared-source-customer",
              roomId: "related-a-room",
              openingId: "related-a-opening",
              templateType: "STOR_PERDE",
              rawValues: { width: 130, height: 230 },
            },
          ],
        },
      });
      const relatedScopeB = createInbound({
        ...SCOPE_B,
        changeId: "related-b",
        entityId: "shared-source-customer",
        patch: {
          customerId: "shared-source-customer",
          measurements: [
            {
              id: "related-b-measurement",
              customerId: "shared-source-customer",
              roomId: "related-b-room",
              openingId: "related-b-opening",
              templateType: "STOR_PERDE",
              rawValues: { width: 777, height: 777 },
            },
          ],
        },
      });

      await saveInboundMeasurement(approvalInbound);
      await saveInboundMeasurement(relatedScopeA);
      await saveInboundMeasurement(relatedScopeB);

      await processAsMerge(approvalInbound, targetCustomer.id);

      const persistedApproval = await localDraftDb.inboundMeasurements.get(
        approvalInbound.changeId,
      );
      const persistedRelatedA = await localDraftDb.inboundMeasurements.get(
        relatedScopeA.changeId,
      );
      const persistedRelatedB = await localDraftDb.inboundMeasurements.get(
        relatedScopeB.changeId,
      );
      assert(
        persistedApproval?.status === "LINKED_TO_CUSTOMER",
        "Approved Scope A record was not completed",
      );
      assert(
        persistedRelatedA?.status === "LINKED_TO_CUSTOMER",
        "Related Scope A group was not completed",
      );
      assert(
        persistedRelatedB?.status === "NEW",
        "Foreign Scope B group was falsely completed",
      );

      const approved = await localMeasurementDb.measurements.get(
        "approved-a-measurement",
      );
      const relatedA = await localMeasurementDb.measurements.get(
        "related-a-measurement",
      );
      const relatedB = await localMeasurementDb.measurements.get(
        "related-b-measurement",
      );
      const foreignLocal = await localMeasurementDb.measurements.get(
        "foreign-local-measurement",
      );
      assert(
        approved?.customerId === targetCustomer.id,
        "Approved Scope A measurement was not re-parented",
      );
      assert(
        relatedA?.customerId === targetCustomer.id,
        "Related Scope A measurement was not re-parented",
      );
      assert(
        relatedB === undefined,
        "Foreign Scope B group measurement was persisted",
      );
      assert(
        foreignLocal?.customerId === foreignSourceCustomer.id,
        "Foreign local Measurement was re-parented",
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
          /await loadRelatedMeasurementGroups\(sourceCustomerIds, inboundScope\);/g,
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
        `Expected scoped loader in 2 approval paths, received ${relatedLoadCount}`,
      );
      assert(
        source.includes("const rows = await listInboundMeasurements(inboundScope);"),
        "Related measurement groups are not loaded through the verified scope",
      );
      assert(
        source.includes("verifiedSourceIds.has(measurement.customerId)"),
        "Local Measurement owner-root scope gate is missing",
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
