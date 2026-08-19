import type {
  ErpScope
} from "@/lib/erpScope";

import {
  listPendingSaleLineSourceOutboxV1,
  markSaleLineSourceErrorV1,
  markSaleLineSourceProcessingV1,
  markSaleLineSourceSyncedV1,
  saleLineSourceOutboxDbV1
} from "@/lib/saleLineSourceOutboxDb";

export type SaleLineSourceOutboxExecutionResultV1 =
  | {
      outcome:
        "SYNCED";
      id:
        string;
    }
  | {
      outcome:
        "ERROR";
      id:
        string;
      error:
        string;
    };

const errorMessage =
  (error: unknown): string =>
    error instanceof Error
      ? error.message
      : String(error);

export async function executeSaleLineSourceOutboxRecordV1(
  id: string
): Promise<
  SaleLineSourceOutboxExecutionResultV1
> {
  const record =
    await saleLineSourceOutboxDbV1
      .outbox
      .get(id);

  if (!record) {
    return {
      outcome:
        "ERROR",
      id,
      error:
        "SALE_LINE_SOURCE_OUTBOX_RECORD_NOT_FOUND"
    };
  }

  if (
    record.status ===
      "SYNCED"
  ) {
    return {
      outcome:
        "SYNCED",
      id
    };
  }

  try {
    await markSaleLineSourceProcessingV1(
      id
    );

    const response =
      await fetch(
        "/api/sales/source-lines/persist",
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(
              record.payload
            )
        }
      );

    const body =
      await response
        .json()
        .catch(
          () => null
        ) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

    if (
      !response.ok ||
      body?.success !== true
    ) {
      const error =
        body?.error ||
        `SALE_LINE_SOURCE_HTTP_${response.status}`;

      await markSaleLineSourceErrorV1(
        id,
        error
      );

      return {
        outcome:
          "ERROR",
        id,
        error
      };
    }

    await markSaleLineSourceSyncedV1(
      id
    );

    return {
      outcome:
        "SYNCED",
      id
    };
  }
  catch (error) {
    const message =
      errorMessage(error);

    try {
      await markSaleLineSourceErrorV1(
        id,
        message
      );
    }
    catch {
      // Preserve the original execution error.
      // The outbox record is never physically deleted.
    }

    return {
      outcome:
        "ERROR",
      id,
      error:
        message
    };
  }
}

export async function retryPendingSaleLineSourceOutboxV1(
  scope: ErpScope
): Promise<
  SaleLineSourceOutboxExecutionResultV1[]
> {
  const records =
    await listPendingSaleLineSourceOutboxV1(
      scope
    );

  const results:
    SaleLineSourceOutboxExecutionResultV1[] =
      [];

  for (const record of records) {
    results.push(
      await executeSaleLineSourceOutboxRecordV1(
        record.id
      )
    );
  }

  return results;
}
