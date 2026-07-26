import type {
  SalesSyncQueueEvent
} from "@/lib/localSalesSyncQueueDb";

export interface SalesSyncQueueSummary {
  total: number;
  pending: number;
  error: number;
  synced: number;
  totalRetryCount: number;
}

export function summarizeSalesSyncQueue(
  events: SalesSyncQueueEvent[]
): SalesSyncQueueSummary {
  return events.reduce<SalesSyncQueueSummary>(
    (summary, event) => {
      summary.total += 1;
      summary.totalRetryCount += Math.max(
        0,
        Number(event.retryCount || 0)
      );

      if (event.status === "PENDING") {
        summary.pending += 1;
      } else if (event.status === "ERROR") {
        summary.error += 1;
      } else if (event.status === "SYNCED") {
        summary.synced += 1;
      }

      return summary;
    },
    {
      total: 0,
      pending: 0,
      error: 0,
      synced: 0,
      totalRetryCount: 0
    }
  );
}
