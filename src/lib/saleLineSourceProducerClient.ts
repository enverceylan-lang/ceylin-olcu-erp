import type {
  Sale
} from "@/store/salesStore";

import type {
  ErpScope
} from "@/lib/erpScope";

import {
  getSaleNetTotal
} from "@/lib/salesFinance";

import {
  projectCanonicalSaleLineSourceV1,
  type PersistSaleLineSourceRequestV1
} from "@/lib/saleLineSourceContracts";

import {
  enqueueSaleLineSourceSnapshotV1
} from "@/lib/saleLineSourceOutboxDb";

import {
  executeSaleLineSourceOutboxRecordV1,
  retryPendingSaleLineSourceOutboxV1
} from "@/lib/saleLineSourceOutboxExecutor";

export const
  SALE_LINE_SOURCE_RUNTIME_ENABLED_V1 = true;

export type SaleLineSourceProducerResultV1 =
  | {
      outcome:
        "QUEUED";
      outboxId:
        string;
    }
  | {
      outcome:
        "SYNCED";
      outboxId:
        string;
    }
  | {
      outcome:
        "REMOTE_ERROR";
      outboxId:
        string;
      error:
        string;
    }
  | {
      outcome:
        "OUTBOX_ERROR";
      error:
        string;
    };

export function buildApprovedSaleLineSourcePayloadV1(
  input: {
    sale: Sale;
    scope: ErpScope;
    currency: string;
  }
): PersistSaleLineSourceRequestV1 {
  if (
    input.sale.status !==
      "ONAYLANDI"
  ) {
    throw new Error(
      "SALE_LINE_SOURCE_APPROVED_SALE_REQUIRED"
    );
  }

  return {
    ...input.scope,

    saleId:
      input.sale.id,

    customerId:
      input.sale.customerId,

    currency:
      input.currency,

    saleTotal:
      getSaleNetTotal(
        input.sale
      ),

    lines:
      input.sale.items.map(
        projectCanonicalSaleLineSourceV1
      )
  };
}

const errorMessage =
  (error: unknown): string =>
    error instanceof Error
      ? error.message
      : String(error);

export async function persistApprovedSaleLineSourceClientV1(
  input: {
    sale: Sale;
    scope: ErpScope;
    currency: string;
  }
): Promise<
  SaleLineSourceProducerResultV1
> {
  let payload:
    PersistSaleLineSourceRequestV1;

  try {
    payload =
      buildApprovedSaleLineSourcePayloadV1(
        input
      );
  }
  catch (error) {
    return {
      outcome:
        "OUTBOX_ERROR",
      error:
        errorMessage(error)
    };
  }

  let record;

  try {
    record =
      await enqueueSaleLineSourceSnapshotV1(
        payload,
        input.scope
      );
  }
  catch (error) {
    return {
      outcome:
        "OUTBOX_ERROR",
      error:
        errorMessage(error)
    };
  }

  if (
    !SALE_LINE_SOURCE_RUNTIME_ENABLED_V1
  ) {
    return {
      outcome:
        "QUEUED",
      outboxId:
        record.id
    };
  }

  const execution =
    await executeSaleLineSourceOutboxRecordV1(
      record.id
    );

  if (
    execution.outcome ===
      "SYNCED"
  ) {
    void retryPendingSaleLineSourceOutboxV1(
      input.scope
    ).catch(
      () => undefined
    );

    return {
      outcome:
        "SYNCED",
      outboxId:
        record.id
    };
  }

  return {
    outcome:
      "REMOTE_ERROR",
    outboxId:
      record.id,
    error:
      execution.error
  };
}
