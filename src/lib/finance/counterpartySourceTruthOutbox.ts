import type {
  CounterpartySourceTruthClientRequest
} from "./counterpartySourceTruthPersistenceClient";

import {
  persistCounterpartySourceTruthViaApi
} from "./counterpartySourceTruthPersistenceClient";

export type CounterpartySourceTruthOutboxStatus =
  | "PENDING"
  | "DONE"
  | "FAILED"
  | "CONFLICT"
  | "REJECTED";

export interface CounterpartySourceTruthOutboxRecord {
  id:
    string;

  request:
    CounterpartySourceTruthClientRequest;

  status:
    CounterpartySourceTruthOutboxStatus;

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
  "enverp-counterparty-source-truth-outbox-v1";

const memoryStore:
  CounterpartySourceTruthOutboxRecord[] =
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
  CounterpartySourceTruthOutboxRecord[] {
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
    CounterpartySourceTruthOutboxRecord[]
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

export function buildCounterpartySourceTruthOutboxId(
  request:
    CounterpartySourceTruthClientRequest
): string {
  const source =
    request.source;

  return [
    "counterparty-source-truth-outbox",
    request.kind,
    source.tenantId,
    source.companyId,
    source.branchId,
    source.accountingPeriodId,
    source.sourceId
  ]
    .map(
      part =>
        encodeURIComponent(part)
    )
    .join(":");
}

export function enqueueCounterpartySourceTruthPersistence(
  request:
    CounterpartySourceTruthClientRequest
): CounterpartySourceTruthOutboxRecord {
  const records =
    readRecords();

  const id =
    buildCounterpartySourceTruthOutboxId(
      request
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
    CounterpartySourceTruthOutboxRecord = {
    id,
    request,
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

export function listCounterpartySourceTruthOutbox():
  CounterpartySourceTruthOutboxRecord[] {
  return readRecords();
}

function replaceRecord(
  next:
    CounterpartySourceTruthOutboxRecord
): CounterpartySourceTruthOutboxRecord {
  const records =
    readRecords();

  writeRecords(
    records.map(
      item =>
        item.id ===
          next.id
          ? next
          : item
    )
  );

  return next;
}

export async function executeCounterpartySourceTruthOutboxRecord(
  record:
    CounterpartySourceTruthOutboxRecord
): Promise<
  CounterpartySourceTruthOutboxRecord
> {
  if (
    record.status ===
      "DONE" ||
    record.status ===
      "CONFLICT" ||
    record.status ===
      "REJECTED"
  ) {
    return record;
  }

  const now =
    new Date().toISOString();

  try {
    const result =
      await persistCounterpartySourceTruthViaApi(
        record.request
      );

    if (
      result.status ===
        "CONFLICT" ||
      result.status ===
        "REJECTED"
    ) {
      return replaceRecord({
        ...record,
        status:
          result.status,
        retryCount:
          record.retryCount +
          1,
        lastErrorCode:
          result.reason,
        updatedAt:
          now
      });
    }

    return replaceRecord({
      ...record,
      status:
        "DONE",
      retryCount:
        record.retryCount,
      lastErrorCode:
        undefined,
      updatedAt:
        now
    });
  }
  catch (error) {
    const errorCode =
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR";

    return replaceRecord({
      ...record,
      status:
        "FAILED",
      retryCount:
        record.retryCount +
        1,
      lastErrorCode:
        errorCode,
      updatedAt:
        now
    });
  }
}
