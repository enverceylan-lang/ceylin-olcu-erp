import Dexie, { type Table } from "dexie";
import {
  sanitizeSalesSyncMutation,
  type SalesSyncMutation
} from "@/lib/salesSyncApiContract";

export type SalesSyncQueueStatus =
  | "PENDING"
  | "SYNCED"
  | "ERROR";

export interface SalesSyncQueueEvent {
  changeId: string;
  saleId: string;
  operation: SalesSyncMutation["operation"];
  mutation: SalesSyncMutation;
  signature: string;
  status: SalesSyncQueueStatus;
  retryCount: number;
  lastErrorCode?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

class LocalSalesSyncQueueDatabase extends Dexie {
  events!: Table<SalesSyncQueueEvent, string>;

  constructor() {
    super("CeylinLocalSalesSyncQueueDb");

    this.version(1).stores({
      events:
        "changeId, saleId, operation, status, updatedAt"
    });
  }
}

export const localSalesSyncQueueDb =
  new LocalSalesSyncQueueDatabase();

function normalizeForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeForSignature(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};

    for (
      const key of
        Object.keys(value as Record<string, unknown>).sort()
    ) {
      normalized[key] = normalizeForSignature(
        (value as Record<string, unknown>)[key]
      );
    }

    return normalized;
  }

  return value;
}

export function getSalesSyncMutationSignature(
  mutation: SalesSyncMutation
): string {
  return JSON.stringify(
    normalizeForSignature(
      sanitizeSalesSyncMutation(mutation)
    )
  );
}

export async function enqueueSalesSyncMutation(
  mutation: SalesSyncMutation
): Promise<{
  queued: boolean;
  event: SalesSyncQueueEvent;
}> {
  const sanitized =
    sanitizeSalesSyncMutation(mutation);
  const signature =
    getSalesSyncMutationSignature(sanitized);
  const existing =
    await localSalesSyncQueueDb.events.get(
      sanitized.changeId
    );

  if (existing) {
    if (existing.signature !== signature) {
      throw new Error(
        "CHANGE_ID_PAYLOAD_COLLISION"
      );
    }

    return {
      queued: false,
      event: existing
    };
  }

  const now = new Date().toISOString();
  const event: SalesSyncQueueEvent = {
    changeId: sanitized.changeId,
    saleId: sanitized.saleId,
    operation: sanitized.operation,
    mutation: sanitized,
    signature,
    status: "PENDING",
    retryCount: 0,
    createdAt: now,
    updatedAt: now
  };

  await localSalesSyncQueueDb.events.add(event);

  return {
    queued: true,
    event
  };
}

export async function listPendingSalesSyncEvents(
  limit = 50
): Promise<SalesSyncQueueEvent[]> {
  const safeLimit = Math.max(
    1,
    Math.min(50, Math.trunc(limit))
  );

  return localSalesSyncQueueDb.events
    .where("status")
    .equals("PENDING")
    .sortBy("createdAt")
    .then(events => events.slice(0, safeLimit));
}

export async function markSalesSyncEventSynced(
  changeId: string
): Promise<void> {
  const now = new Date().toISOString();

  await localSalesSyncQueueDb.events.update(
    changeId,
    {
      status: "SYNCED",
      syncedAt: now,
      updatedAt: now,
      lastErrorCode: undefined
    }
  );
}

export async function markSalesSyncEventError(
  changeId: string,
  errorCode: string
): Promise<void> {
  const event =
    await localSalesSyncQueueDb.events.get(changeId);

  if (!event) return;

  await localSalesSyncQueueDb.events.update(
    changeId,
    {
      status: "ERROR",
      retryCount: event.retryCount + 1,
      lastErrorCode:
        String(errorCode || "UNKNOWN_ERROR")
          .trim()
          .slice(0, 80),
      updatedAt: new Date().toISOString()
    }
  );
}

export async function requeueSalesSyncEvent(
  changeId: string
): Promise<boolean> {
  const event =
    await localSalesSyncQueueDb.events.get(changeId);

  if (!event || event.status !== "ERROR") {
    return false;
  }

  await localSalesSyncQueueDb.events.update(
    changeId,
    {
      status: "PENDING",
      lastErrorCode: undefined,
      updatedAt: new Date().toISOString()
    }
  );

  return true;
}
