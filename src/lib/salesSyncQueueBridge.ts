import type {
  Sale,
  SalePayment
} from "@/store/salesStore";
import type {
  SalesSyncMutation,
  SalesSyncOperation
} from "@/lib/salesSyncApiContract";
import {
  enqueueSalesSyncMutation,
  localSalesSyncQueueDb
} from "@/lib/localSalesSyncQueueDb";

export interface SalesSyncCaptureResult {
  enabled: boolean;
  queuedCount: number;
  skippedReason?: "OWNER_REQUIRED";
}

export function isSalesSyncQueueCaptureEnabled(
  value =
    process.env.NEXT_PUBLIC_SALES_SYNC_QUEUE_ENABLED
): boolean {
  return value === "true";
}

function buildChangeId(
  saleId: string,
  operation: SalesSyncOperation,
  identity: string
): string {
  return [
    "SALE",
    saleId,
    operation,
    identity
  ].join(":");
}

async function getNextSaleSyncVersion(
  saleId: string
): Promise<number> {
  const events =
    await localSalesSyncQueueDb.events
      .where("saleId")
      .equals(saleId)
      .toArray();

  return (
    events.reduce(
      (maximum, event) => {
        const version =
          event.mutation.envelope?.version ??
          event.mutation.baseVersion + 1;

        return Math.max(maximum, version);
      },
      0
    ) + 1
  );
}

async function enqueueSaleSnapshot(
  sale: Sale,
  operation: Exclude<
    SalesSyncOperation,
    "APPEND_PAYMENT"
  >
): Promise<boolean> {
  const changeId = buildChangeId(
    sale.id,
    operation,
    sale.updatedAt
  );
  const existing =
    await localSalesSyncQueueDb.events.get(changeId);

  if (existing) {
    return false;
  }

  const version =
    await getNextSaleSyncVersion(sale.id);
  const snapshot: Sale = {
    ...sale,
    payments: []
  };
  const mutation: SalesSyncMutation = {
    changeId,
    deviceId: "LOCAL_DEVICE_PENDING",
    saleId: sale.id,
    ownerUserId: sale.createdByUserId || "",
    operation,
    baseVersion: version - 1,
    envelope: {
      sale: snapshot,
      version,
      deviceId: "LOCAL_DEVICE_PENDING"
    }
  };

  const result =
    await enqueueSalesSyncMutation(mutation);

  return result.queued;
}

async function enqueuePayment(
  sale: Sale,
  payment: SalePayment
): Promise<boolean> {
  const changeId = buildChangeId(
    sale.id,
    "APPEND_PAYMENT",
    payment.id
  );
  const existing =
    await localSalesSyncQueueDb.events.get(changeId);

  if (existing) {
    return false;
  }

  const version =
    await getNextSaleSyncVersion(sale.id);
  const mutation: SalesSyncMutation = {
    changeId,
    deviceId: "LOCAL_DEVICE_PENDING",
    saleId: sale.id,
    ownerUserId: sale.createdByUserId || "",
    operation: "APPEND_PAYMENT",
    baseVersion: version - 1,
    payment
  };

  const result =
    await enqueueSalesSyncMutation(mutation);

  return result.queued;
}

export async function captureSaleSaveForSync(
  sale: Sale,
  previousSale?: Sale,
  featureValue?: string
): Promise<SalesSyncCaptureResult> {
  if (!isSalesSyncQueueCaptureEnabled(featureValue)) {
    return {
      enabled: false,
      queuedCount: 0
    };
  }

  if (!sale.createdByUserId?.trim()) {
    return {
      enabled: true,
      queuedCount: 0,
      skippedReason: "OWNER_REQUIRED"
    };
  }

  const operation: Exclude<
    SalesSyncOperation,
    "APPEND_PAYMENT"
  > = sale.isDeleted
    ? "SOFT_DELETE"
    : previousSale?.isDeleted
      ? "RESTORE"
      : "UPSERT";

  let queuedCount = (
    await enqueueSaleSnapshot(sale, operation)
  ) ? 1 : 0;

  const previousPaymentIds = new Set(
    (previousSale?.payments || []).map(
      payment => payment.id
    )
  );

  for (const payment of sale.payments || []) {
    if (previousPaymentIds.has(payment.id)) continue;

    if (await enqueuePayment(sale, payment)) {
      queuedCount += 1;
    }
  }

  return {
    enabled: true,
    queuedCount
  };
}

export async function captureSaleDeleteForSync(
  sale: Sale,
  deletedBy?: string,
  featureValue?: string
): Promise<SalesSyncCaptureResult> {
  const deletedAt = new Date().toISOString();

  return captureSaleSaveForSync(
    {
      ...sale,
      isDeleted: true,
      deletedAt,
      deletedBy,
      updatedAt: deletedAt
    },
    sale,
    featureValue
  );
}
