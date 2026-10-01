import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { localCustomerDb } from "../src/lib/localCustomerDb";
import {
  localMeasurementDb,
  resolveMeasurementOwnerScope,
  saveLocalMeasurement,
} from "../src/lib/localMeasurementDb";
import {
  localDraftDb,
  type InboundMeasurement,
} from "../src/lib/localDraftDb";
import { processAsMerge } from "../src/lib/inboundProcessor";
import {
  persistMeasurementAuthorityCommand,
  type MeasurementAuthorityChange,
} from "../src/lib/serverMeasurementAuthority";
import type { ErpScope } from "../src/lib/erpScope";
import type { MeasurementRecord } from "../src/store/measurementStore";
import { useMeasurementStore } from "../src/store/measurementStore";
import type { Customer } from "../src/store/useStore";
import { useStore } from "../src/store/useStore";

const SCOPE: ErpScope = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  branchId: "00000000-0000-4000-8000-000000000003",
  accountingPeriodId: "00000000-0000-4000-8000-000000000004",
};

function createCustomer(): Customer {
  return {
    ...SCOPE,
    id: "customer-1",
    name: "TEST CARI",
    phone: "",
    address: "",
    mapLocation: "",
    notes: "",
    rooms: [
      {
        id: "room-1",
        name: "Salon",
        photos: [],
        videos: [],
        windows: [],
      },
    ],
    addressPhotos: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  } as Customer;
}

function createRoomOnlyMeasurement(
  id = "measurement-room-only-1",
): MeasurementRecord {
  return {
    id,
    customerId: "customer-1",
    roomId: "room-1",
    templateType: "SIMPLE_WIDTH_HEIGHT",
    rawValues: { width: 120, height: 220 },
    status: "ACTIVE",
    measuredBy: "TEST",
    measuredDate: "2026-10-01T00:00:00.000Z",
    notes: "",
    notesHistory: [],
    photos: [],
    videos: [],
  };
}

async function resetLocalState(): Promise<void> {
  await localDraftDb.inboundMeasurements.clear();
  await localCustomerDb.customers.clear();
  await localMeasurementDb.measurements.clear();
  useStore.setState({ customers: [] });
  useMeasurementStore.setState({ measurements: [] });
}

async function localRoomOnlyContract(): Promise<void> {
  await resetLocalState();

  const customer = createCustomer();
  await localCustomerDb.customers.put(customer);

  const measurement = createRoomOnlyMeasurement();
  const resolvedScope = await resolveMeasurementOwnerScope(measurement);
  assert.deepEqual(resolvedScope, SCOPE);

  await saveLocalMeasurement(measurement);
  const persisted = await localMeasurementDb.measurements.get(measurement.id);

  assert.ok(persisted);
  assert.equal(persisted.customerId, "customer-1");
  assert.equal(persisted.roomId, "room-1");
  assert.equal(persisted.openingId, undefined);
  assert.equal(persisted.windowId, undefined);

  console.log("[PASS] localRoomOnlyMeasurementAccepted");
}

async function inboundRoomOnlyRoundTrip(): Promise<void> {
  await resetLocalState();

  const customer = createCustomer();
  await localCustomerDb.customers.put(customer);
  useStore.setState({ customers: [customer] });

  const inbound: InboundMeasurement = {
    ...SCOPE,
    changeId: "change-room-only-1",
    revision: 1,
    entityType: "MEASUREMENT_GROUP",
    entityId: "source-customer-1",
    operation: "UPDATE",
    sourceTable: "measurement_changes",
    customerName: "TEST CARI",
    customerPhone: "",
    patch: {
      customerId: "source-customer-1",
      temporaryCustomerId: "source-customer-1",
      measurements: [
        {
          ...createRoomOnlyMeasurement("measurement-inbound-room-only"),
          customerId: "source-customer-1",
        },
      ],
    },
    senderId: "field-user-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    status: "NEW",
    suggestedCustomerIds: [],
  };

  await localDraftDb.inboundMeasurements.put(inbound);
  const updatedCustomer = await processAsMerge(inbound, customer.id);

  const persisted = await localMeasurementDb.measurements.get(
    "measurement-inbound-room-only",
  );

  assert.ok(persisted);
  assert.equal(persisted.customerId, customer.id);
  assert.equal(persisted.roomId, "room-1");
  assert.equal(persisted.openingId, undefined);
  assert.equal(persisted.windowId, undefined);

  const salon = updatedCustomer.rooms.find((room) => room.id === "room-1");
  assert.ok(salon);
  assert.equal(salon.windows.length, 0);

  console.log("[PASS] inboundRoomOnlyMeasurementPreserved");
}

async function serverRoomOnlyPackageContract(): Promise<void> {
  const calls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];

  const fakeSupabase = {
    rpc: async (
      name: string,
      args: Record<string, unknown>,
    ) => {
      calls.push({ name, args });
      return {
        data: {
          changeId: "change-room-only-1",
          entityId: "measurement-room-only-1",
          entityVersion: 1,
          outcome: "CREATED",
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const change: MeasurementAuthorityChange = {
    change_id: "change-room-only-1",
    entity_id: "measurement-room-only-1",
    operation: "INSERT",
    expected_version: 0,
    device_id: "device-1",
    patch: {
      data: {
        id: "measurement-room-only-1",
        customerId: "customer-1",
        roomId: "room-1",
        templateType: "SIMPLE_WIDTH_HEIGHT",
        rawValues: { width: 120, height: 220 },
      },
      parentPackage: {
        room: {
          id: "room-1",
          name: "Salon",
          customerAddressId: null,
          createdAt: null,
          updatedAt: null,
        },
      },
    },
  };

  const result = await persistMeasurementAuthorityCommand({
    supabase: fakeSupabase,
    actorUserId: "user-1",
    scope: SCOPE,
    change,
  });

  assert.equal(result.outcome, "CREATED");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.name,
    "persist_measurement_package_authority_v1",
  );

  const parentPackage = calls[0]?.args.p_parent_package as
    | { room?: { id?: string }; opening?: unknown }
    | undefined;
  assert.equal(parentPackage?.room?.id, "room-1");
  assert.equal(parentPackage?.opening, undefined);

  const command = calls[0]?.args.p_command as
    | { payload?: Record<string, unknown> }
    | undefined;
  assert.equal(command?.payload?.roomName, "Salon");
  assert.equal(command?.payload?.roomLabel, "Salon");
  assert.equal(command?.payload?.openingId, undefined);
  assert.equal(command?.payload?.windowId, undefined);
  assert.equal(command?.payload?.openingName, undefined);
  assert.equal(command?.payload?.openingLabel, undefined);
  assert.equal(command?.payload?.windowName, undefined);

  console.log("[PASS] serverRoomOnlyParentPackageAccepted");
}

function migrationContract(): void {
  const migration = fs.readFileSync(
    "docs/sql/20261001_measurement_opening_optional_v1.sql",
    "utf8",
  );

  assert.match(
    migration,
    /alter table public\.measurements[\s\S]*alter column "openingId" drop not null/i,
  );
  assert.match(
    migration,
    /if v_customer_id = '' or v_room_id = '' then[\s\S]*MEASUREMENT_PARENT_ID_MISSING/,
  );
  assert.match(migration, /if v_opening_id <> '' then/);
  assert.match(migration, /"openingId" = nullif\(v_opening_id,''\)/);
  assert.match(
    migration,
    /m\."openingId" is not distinct from nullif\(v_opening_id,''\)/,
  );
  assert.match(migration, /'roomName', v_room_name_snapshot/);
  assert.match(migration, /'roomLabel', v_room_name_snapshot/);
  assert.match(migration, /'openingName', v_opening_name_snapshot/);
  assert.match(migration, /MEASUREMENT_OPENING_NAME_MISSING/);

  console.log("[PASS] openingOptionalMigrationContract");
}

async function main(): Promise<void> {
  migrationContract();
  await localRoomOnlyContract();
  await serverRoomOnlyPackageContract();
  await inboundRoomOnlyRoundTrip();
  console.log("PAK_MEASUREMENT_OPENING_OPTIONAL_CONTRACT");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
