import Dexie, {
  type Table
} from "dexie";

import type {
  ErpScope
} from "@/lib/erpScope";

import {
  assertPersistSaleLineSourceRequestV1,
  type PersistSaleLineSourceRequestV1
} from "@/lib/saleLineSourceContracts";

export type SaleLineSourceOutboxStatusV1 =
  | "PENDING"
  | "PROCESSING"
  | "SYNCED"
  | "ERROR";

export interface SaleLineSourceOutboxRecordV1
  extends ErpScope {
  id: string;
  saleId: string;
  payloadHash: string;
  payload: PersistSaleLineSourceRequestV1;
  status: SaleLineSourceOutboxStatusV1;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

const clean =
  (value: unknown): string =>
    String(value ?? "").trim();

export function buildSaleLineSourceOutboxIdV1(
  input: ErpScope & {
    saleId: string;
  }
): string {
  return [
    clean(input.tenantId),
    clean(input.companyId),
    clean(input.branchId),
    clean(input.accountingPeriodId),
    clean(input.saleId)
  ].join(":");
}

export function stableSaleLineSourcePayloadV1(
  payload: PersistSaleLineSourceRequestV1
): string {
  return JSON.stringify({
    tenantId: payload.tenantId,
    companyId: payload.companyId,
    branchId: payload.branchId,
    accountingPeriodId:
      payload.accountingPeriodId,
    saleId: payload.saleId,
    customerId: payload.customerId,
    currency: payload.currency,
    saleTotal: payload.saleTotal,
    lines: payload.lines
  });
}

export async function sha256HexV1(
  value: string
): Promise<string> {
  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map(byte =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

class SaleLineSourceOutboxDatabaseV1
  extends Dexie {
  outbox!: Table<
    SaleLineSourceOutboxRecordV1,
    string
  >;

  constructor() {
    super(
      "ENVerpSaleLineSourceOutboxV1"
    );

    this.version(1).stores({
      outbox:
        "id, saleId, status, updatedAt, " +
        "[tenantId+companyId+branchId+accountingPeriodId], " +
        "&[tenantId+companyId+branchId+accountingPeriodId+saleId]"
    });
  }
}

export const saleLineSourceOutboxDbV1 =
  new SaleLineSourceOutboxDatabaseV1();

export async function enqueueSaleLineSourceSnapshotV1(
  payload: PersistSaleLineSourceRequestV1,
  serverScope: ErpScope,
  now: string = new Date().toISOString()
): Promise<SaleLineSourceOutboxRecordV1> {
  assertPersistSaleLineSourceRequestV1(
    payload,
    serverScope
  );

  const id =
    buildSaleLineSourceOutboxIdV1(
      payload
    );

  const payloadHash =
    await sha256HexV1(
      stableSaleLineSourcePayloadV1(
        payload
      )
    );

  const existing =
    await saleLineSourceOutboxDbV1
      .outbox
      .get(id);

  if (existing) {
    if (
      existing.payloadHash !==
        payloadHash
    ) {
      throw new Error(
        "SALE_LINE_SOURCE_OUTBOX_IDEMPOTENCY_CONFLICT"
      );
    }

    return existing;
  }

  const record:
    SaleLineSourceOutboxRecordV1 = {
      id,
      tenantId:
        payload.tenantId,
      companyId:
        payload.companyId,
      branchId:
        payload.branchId,
      accountingPeriodId:
        payload.accountingPeriodId,
      saleId:
        payload.saleId,
      payloadHash,
      payload,
      status:
        "PENDING",
      retryCount:
        0,
      createdAt:
        now,
      updatedAt:
        now
    };

  await saleLineSourceOutboxDbV1
    .outbox
    .add(record);

  return record;
}

export async function markSaleLineSourceProcessingV1(
  id: string,
  now: string = new Date().toISOString()
): Promise<void> {
  const current =
    await saleLineSourceOutboxDbV1
      .outbox
      .get(id);

  if (!current) {
    throw new Error(
      "SALE_LINE_SOURCE_OUTBOX_RECORD_NOT_FOUND"
    );
  }

  if (
    current.status ===
      "SYNCED"
  ) {
    return;
  }

  await saleLineSourceOutboxDbV1
    .outbox
    .update(id, {
      status:
        "PROCESSING",
      retryCount:
        current.retryCount + 1,
      lastError:
        undefined,
      updatedAt:
        now
    });
}

export async function markSaleLineSourceSyncedV1(
  id: string,
  now: string = new Date().toISOString()
): Promise<void> {
  const current =
    await saleLineSourceOutboxDbV1
      .outbox
      .get(id);

  if (!current) {
    throw new Error(
      "SALE_LINE_SOURCE_OUTBOX_RECORD_NOT_FOUND"
    );
  }

  await saleLineSourceOutboxDbV1
    .outbox
    .update(id, {
      status:
        "SYNCED",
      lastError:
        undefined,
      updatedAt:
        now,
      processedAt:
        now
    });
}

export async function markSaleLineSourceErrorV1(
  id: string,
  error: string,
  now: string = new Date().toISOString()
): Promise<void> {
  const current =
    await saleLineSourceOutboxDbV1
      .outbox
      .get(id);

  if (!current) {
    throw new Error(
      "SALE_LINE_SOURCE_OUTBOX_RECORD_NOT_FOUND"
    );
  }

  if (
    current.status ===
      "SYNCED"
  ) {
    return;
  }

  await saleLineSourceOutboxDbV1
    .outbox
    .update(id, {
      status:
        "ERROR",
      lastError:
        clean(error) ||
        "SALE_LINE_SOURCE_OUTBOX_UNKNOWN_ERROR",
      updatedAt:
        now
    });
}

export async function listPendingSaleLineSourceOutboxV1(
  scope: ErpScope
): Promise<SaleLineSourceOutboxRecordV1[]> {
  const records =
    await saleLineSourceOutboxDbV1
      .outbox
      .where(
        "[tenantId+companyId+branchId+accountingPeriodId]"
      )
      .equals([
        scope.tenantId,
        scope.companyId,
        scope.branchId,
        scope.accountingPeriodId
      ])
      .toArray();

  return records.filter(
    record =>
      record.status ===
        "PENDING" ||
      record.status ===
        "ERROR" ||
      record.status ===
        "PROCESSING"
  );
}
