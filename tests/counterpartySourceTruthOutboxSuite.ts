import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCounterpartySourceTruthOutboxId,
  enqueueCounterpartySourceTruthPersistence,
  listCounterpartySourceTruthOutbox
} from "../src/lib/finance/counterpartySourceTruthOutbox";

const supplierRequest = {
  kind:
    "SUPPLIER_RECEIPT" as const,
  source: {
    sourceId:
      "supplier-receipt-source:receipt-1",

    tenantId:
      "tenant-1",
    companyId:
      "company-1",
    branchId:
      "branch-1",
    accountingPeriodId:
      "period-1",

    supplierCustomerId:
      "supplier-1",
    supplierOrderId:
      "order-1",
    receiptId:
      "receipt-1",
      sourceDocumentId: "purchase-document-1",
    stockItemId:
      "stock-1",

    receivedQuantity:
      10,
    actualPurchaseUnitPrice:
      75,
    purchaseVatRate:
      20 as const,

    netAmount:
      750,
    payableAmount:
      900,

    currency:
      "TRY" as const,

    receivedAt:
      "2026-08-05T08:00:00.000Z",
    recordedAt:
      "2026-08-05T08:01:00.000Z"
  }
};

test(
  "source truth outbox id is deterministic and enqueue is idempotent",
  () => {
    const id1 =
      buildCounterpartySourceTruthOutboxId(
        supplierRequest
      );

    const id2 =
      buildCounterpartySourceTruthOutboxId(
        supplierRequest
      );

    assert.equal(
      id1,
      id2
    );

    const first =
      enqueueCounterpartySourceTruthPersistence(
        supplierRequest
      );

    const second =
      enqueueCounterpartySourceTruthPersistence(
        supplierRequest
      );

    assert.equal(
      first.id,
      second.id
    );

    assert.equal(
      listCounterpartySourceTruthOutbox()
        .filter(
          item =>
            item.id ===
            first.id
        )
        .length,
      1
    );
  }
);