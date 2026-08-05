import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";

import {
  persistCounterpartyPayableMovementViaApi
} from "@/lib/finance/counterpartyPayablePersistenceClient";

export type CounterpartyPayableOutboxStatus =
  | "PENDING"
  | "DONE"
  | "FAILED"
  | "CONFLICT";

export interface CounterpartyPayableOutboxRecord {
  id:
    string;
  movement:
    CounterpartyPayableMovement;
  status:
    CounterpartyPayableOutboxStatus;
  retryCount:
    number;
  lastErrorCode?:
    string;
  createdAt:
    string;
  updatedAt:
    string;
}

const STORAGE_KEY =
  "enverp-counterparty-payable-outbox-v1";

const memoryStore:
  CounterpartyPayableOutboxRecord[] =
    [];

function canUseStorage(): boolean {
  return (
    typeof window !==
      "undefined" &&
    typeof window.localStorage !==
      "undefined"
  );
}

function readRecords():
  CounterpartyPayableOutboxRecord[] {
  if (!canUseStorage()) {
    return [
      ...memoryStore
    ];
  }

  const raw =
    window.localStorage.getItem(
      STORAGE_KEY
    );

  if (!raw) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  }
  catch {
    return [];
  }
}

function writeRecords(
  records:
    CounterpartyPayableOutboxRecord[]
): void {
  if (!canUseStorage()) {
    memoryStore.splice(
      0,
      memoryStore.length,
      ...records
    );

    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records)
  );
}

export function buildCounterpartyPayableOutboxId(
  movement:
    CounterpartyPayableMovement
): string {
  return [
    "counterparty-payable-outbox",
    movement.tenantId,
    movement.companyId,
    movement.branchId,
    movement.accountingPeriodId,
    movement.idempotencyKey
  ]
    .map(
      part =>
        encodeURIComponent(part)
    )
    .join(":");
}

export function enqueueCounterpartyPayablePersistence(
  movement:
    CounterpartyPayableMovement
): CounterpartyPayableOutboxRecord {
  const records =
    readRecords();

  const id =
    buildCounterpartyPayableOutboxId(
      movement
    );

  const existing =
    records.find(
      item =>
        item.id ===
        id
    );

  if (existing) {
    return existing;
  }

  const now =
    new Date().toISOString();

  const record:
    CounterpartyPayableOutboxRecord = {
    id,
    movement,
    status:
      "PENDING",
    retryCount:
      0,
    createdAt:
      now,
    updatedAt:
      now
  };

  writeRecords([
    ...records,
    record
  ]);

  return record;
}

export function listCounterpartyPayableOutbox():
  CounterpartyPayableOutboxRecord[] {
  return readRecords();
}

export async function executeCounterpartyPayableOutboxRecord(
  record:
    CounterpartyPayableOutboxRecord
): Promise<
  CounterpartyPayableOutboxRecord
> {
  if (
    record.status ===
      "DONE"
  ) {
    return record;
  }

  const now =
    new Date().toISOString();

  try {
    const result =
      await persistCounterpartyPayableMovementViaApi(
        record.movement
      );

    const next:
      CounterpartyPayableOutboxRecord =
      result.outcome ===
        "CONFLICT"
        ? {
            ...record,
            status:
              "CONFLICT",
            retryCount:
              record.retryCount + 1,
            lastErrorCode:
              result.reason,
            updatedAt:
              now
          }
        : {
            ...record,
            status:
              "DONE",
            lastErrorCode:
              undefined,
            updatedAt:
              now
          };

    const records =
      readRecords();

    writeRecords(
      records.map(
        item =>
          item.id ===
            record.id
            ? next
            : item
      )
    );

    return next;
  }
  catch (error) {
    const next:
      CounterpartyPayableOutboxRecord = {
      ...record,
      status:
        "FAILED",
      retryCount:
        record.retryCount + 1,
      lastErrorCode:
        error instanceof Error
          ? error.message
          : "COUNTERPARTY_PAYABLE_PERSISTENCE_FAILED",
      updatedAt:
        now
    };

    const records =
      readRecords();

    writeRecords(
      records.map(
        item =>
          item.id ===
            record.id
            ? next
            : item
      )
    );

    return next;
  }
}

export async function flushCounterpartyPayableOutbox():
  Promise<
    CounterpartyPayableOutboxRecord[]
  > {
  const pending =
    readRecords().filter(
      record =>
        record.status ===
          "PENDING" ||
        record.status ===
          "FAILED"
    );

  const results:
    CounterpartyPayableOutboxRecord[] =
    [];

  for (const record of pending) {
    results.push(
      await executeCounterpartyPayableOutboxRecord(
        record
      )
    );
  }

  return results;
}

export function enqueueAndAttemptCounterpartyPayablePersistence(
  movement:
    CounterpartyPayableMovement
): void {
  const record =
    enqueueCounterpartyPayablePersistence(
      movement
    );

  if (
    typeof window ===
      "undefined"
  ) {
    return;
  }

  void executeCounterpartyPayableOutboxRecord(
    record
  );
}