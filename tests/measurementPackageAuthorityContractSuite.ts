import assert from "node:assert/strict";
import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  persistMeasurementAuthorityCommand,
  type MeasurementAuthorityChange,
} from "../src/lib/serverMeasurementAuthority";

async function main(): Promise<void> {
  const sql = fs.readFileSync(
    "docs/sql/20260915_measurement_package_authority_v1.sql",
    "utf8",
  );

  const snapshotSql = fs.readFileSync(
    "docs/sql/20260928_measurement_change_parent_name_snapshot_v1.sql",
    "utf8",
  );

  assert.match(sql, /persist_measurement_package_authority_v1/);
  assert.match(sql, /persist_measurement_authority_v1/);
  assert.match(sql, /on conflict \(id\) do nothing/gi);
  assert.match(sql, /MEASUREMENT_ROOM_ADDRESS_SCOPE_MISMATCH/);
  assert.match(sql, /a\."isDeleted" = false/);
  assert.match(sql, /if v_operation <> 'INSERT' then/);
  assert.match(
    sql,
    /v_operation <> 'INSERT'[\s\S]*coalesce\(c\."isDeleted", false\) = false/,
  );
  assert.doesNotMatch(sql, /update\s+public\.rooms/i);
  assert.doesNotMatch(sql, /update\s+public\.openings/i);
  assert.doesNotMatch(
    sql,
    /on conflict\s*\([^)]*\)\s*do update/i,
  );

  assert.match(
    snapshotSql,
    /create or replace function public\.persist_measurement_authority_v1\(/i,
  );
  assert.match(snapshotSql, /from public\.rooms r/i);
  assert.match(snapshotSql, /from public\.openings o/i);
  assert.match(snapshotSql, /r\."customerId" = v_customer_id/);
  assert.match(snapshotSql, /o\."roomId" = v_room_id/);
  assert.match(snapshotSql, /r\.tenant_id = v_tenant_id/);
  assert.match(snapshotSql, /r\.company_id = v_company_id/);
  assert.match(snapshotSql, /r\.branch_id = v_branch_id/);
  assert.match(snapshotSql, /r\.accounting_period_id = v_accounting_period_id/);
  assert.match(snapshotSql, /o\.tenant_id = v_tenant_id/);
  assert.match(snapshotSql, /o\.company_id = v_company_id/);
  assert.match(snapshotSql, /o\.branch_id = v_branch_id/);
  assert.match(snapshotSql, /o\.accounting_period_id = v_accounting_period_id/);
  assert.match(snapshotSql, /'roomName', v_room_name_snapshot/);
  assert.match(snapshotSql, /'roomLabel', v_room_name_snapshot/);
  assert.match(snapshotSql, /'openingName', v_opening_name_snapshot/);
  assert.match(snapshotSql, /'openingLabel', v_opening_name_snapshot/);
  assert.match(snapshotSql, /'windowName', v_opening_name_snapshot/);
  assert.match(
    snapshotSql,
    /jsonb_build_object\('data',v_entity_json\)/,
  );
  assert.doesNotMatch(snapshotSql, /v_payload->>'room(Name|Label)'/);
  assert.doesNotMatch(
    snapshotSql,
    /v_payload->>'(openingName|openingLabel|windowName)'/,
  );
  assert.doesNotMatch(
    snapshotSql,
    /\balter\s+table\s+public\.measurements\b/i,
  );
  assert.match(snapshotSql, /MEASUREMENT_ROOM_NAME_MISSING/);
  assert.match(snapshotSql, /MEASUREMENT_OPENING_NAME_MISSING/);
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
          changeId: "change-1",
          entityId: "measurement-1",
          entityVersion: 1,
          outcome: "CREATED",
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;

  const scope = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    companyId: "00000000-0000-4000-8000-000000000002",
    branchId: "00000000-0000-4000-8000-000000000003",
    accountingPeriodId: "00000000-0000-4000-8000-000000000004",
  };

  const packageChange: MeasurementAuthorityChange = {
    change_id: "change-1",
    entity_id: "measurement-1",
    operation: "INSERT",
    expected_version: 0,
    device_id: "device-1",
    patch: {
      data: {
        id: "measurement-1",
        customerId: "customer-1",
        roomId: "room-1",
        openingId: "opening-1",
        windowId: "opening-1",
        templateType: "SIMPLE_WIDTH_HEIGHT",
        rawValues: {},
      },
      parentPackage: {
        room: {
          id: "room-1",
          name: "Salon Test",
          customerAddressId: null,
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
        opening: {
          id: "opening-1",
          name: "Sağ Pencere",
          width: 120,
          height: 220,
          fieldNotes: "",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
      },
    },
  };

  const result = await persistMeasurementAuthorityCommand({
    supabase: fakeSupabase,
    actorUserId: "user-1",
    scope,
    change: packageChange,
  });

  assert.equal(result.outcome, "CREATED");
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.name,
    "persist_measurement_package_authority_v1",
  );
  assert.ok(calls[0]?.args.p_parent_package);

  const packageCommand = calls[0]?.args.p_command as
    | { payload?: Record<string, unknown> }
    | undefined;
  assert.equal(packageCommand?.payload?.roomName, "Salon Test");
  assert.equal(packageCommand?.payload?.roomLabel, "Salon Test");
  assert.equal(packageCommand?.payload?.openingName, "Sağ Pencere");
  assert.equal(packageCommand?.payload?.openingLabel, "Sağ Pencere");
  assert.equal(packageCommand?.payload?.windowName, "Sağ Pencere");
  // MEASUREMENT_NAME_AUTHORITY_REGRESSION
  const packageCommandJson = JSON.stringify(calls[0]?.args.p_command);
  assert.match(packageCommandJson, /"roomName":"Salon Test"/);
  assert.match(packageCommandJson, /"roomLabel":"Salon Test"/);
  assert.match(packageCommandJson, /"openingName":"Sağ Pencere"/);
  assert.match(packageCommandJson, /"openingLabel":"Sağ Pencere"/);
  assert.match(packageCommandJson, /"windowName":"Sağ Pencere"/);

  calls.length = 0;

  const legacyChange: MeasurementAuthorityChange = {
    ...packageChange,
    patch: {
      data: {
        id: "measurement-1",
        customerId: "customer-1",
        roomId: "room-1",
        openingId: "opening-1",
        windowId: "opening-1",
        templateType: "SIMPLE_WIDTH_HEIGHT",
        rawValues: {},
      },
    },
  };

  await persistMeasurementAuthorityCommand({
    supabase: fakeSupabase,
    actorUserId: "user-1",
    scope,
    change: legacyChange,
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.name,
    "persist_measurement_authority_v1",
  );

  const mismatchedChange: MeasurementAuthorityChange = {
    ...packageChange,
    patch: {
      ...(packageChange.patch as Record<string, unknown>),
      parentPackage: {
        room: {
          id: "wrong-room",
          name: "Salon",
        },
        opening: {
          id: "opening-1",
          name: "Pencere 1",
        },
      },
    },
  };

  await assert.rejects(
    () =>
      persistMeasurementAuthorityCommand({
        supabase: fakeSupabase,
        actorUserId: "user-1",
        scope,
        change: mismatchedChange,
      }),
    /MEASUREMENT_PARENT_PACKAGE_ID_MISMATCH/,
  );

  console.log("PAK_MEASUREMENT_PACKAGE_AUTHORITY_CONTRACT");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});