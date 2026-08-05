import assert from "node:assert/strict";
import test from "node:test";

import {
  projectProviderEarningSourceTruth,
  projectSupplierReceiptSourceTruth
} from "../src/lib/finance/counterpartySourceTruthProducerBridge";

test(
  "supplier receipt producer projects historical VAT-inclusive payable source truth",
  () => {
    const result =
      projectSupplierReceiptSourceTruth({
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
        sourceDocumentId:
          "purchase-document-1",
        stockItemId:
          "stock-1",

        receivedQuantity:
          10,
        actualPurchaseUnitPrice:
          75,
        purchaseVatRate:
          20,

        receivedAt:
          "2026-08-05T08:00:00.000Z",
        recordedAt:
          "2026-08-05T08:01:00.000Z"
      });

    assert.equal(
      result.ok,
      true
    );

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.value.sourceId,
      "supplier-receipt-source:receipt-1"
    );

    assert.equal(
      result.value.netAmount,
      750
    );

    assert.equal(
      result.value.payableAmount,
      900
    );

    assert.equal(
      result.value.actualPurchaseUnitPrice,
      75
    );

    assert.equal(
      result.value.purchaseVatRate,
      20
    );
  }
);

test(
  "supplier receipt producer rejects invalid historical amount",
  () => {
    const result =
      projectSupplierReceiptSourceTruth({
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
        sourceDocumentId:
          "purchase-document-1",
        stockItemId:
          "stock-1",

        receivedQuantity:
          10,
        actualPurchaseUnitPrice:
          0,
        purchaseVatRate:
          20,

        receivedAt:
          "2026-08-05T08:00:00.000Z",
        recordedAt:
          "2026-08-05T08:01:00.000Z"
      });

    assert.deepEqual(
      result,
      {
        ok: false,
        reason:
          "INVALID_AMOUNT"
      }
    );
  }
);

test(
  "external finalized provider earning projects immutable source truth",
  () => {
    const result =
      projectProviderEarningSourceTruth({
        tenantId:
          "tenant-1",
        companyId:
          "company-1",
        branchId:
          "branch-1",
        accountingPeriodId:
          "period-1",

        providerCustomerId:
          "provider-1",
        providerType:
          "TAILOR",
        assignmentType:
          "EXTERNAL",

        operationId:
          "operation-1",
        earningsEntryId:
          "earning-1",
        sourceDocumentId:
          "sale-1",

        finalizedAmount:
          1250.456,
        currency:
          "TRY",

        occurredAt:
          "2026-08-05T08:00:00.000Z",
        finalizedAt:
          "2026-08-05T08:05:00.000Z",
        recordedAt:
          "2026-08-05T08:06:00.000Z"
      });

    assert.equal(
      result.ok,
      true
    );

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.value.sourceId,
      "provider-earning-source:earning-1"
    );

    assert.equal(
      result.value.status,
      "FINALIZED"
    );

    assert.equal(
      result.value.finalizedAmount,
      1250.46
    );

    assert.equal(
      result.value.providerCustomerId,
      "provider-1"
    );
  }
);

test(
  "external finalized provider earning permits absent sourceDocumentId with canonical identities",
  () => {
    const result =
      projectProviderEarningSourceTruth({
        tenantId:
          "tenant-1",
        companyId:
          "company-1",
        branchId:
          "branch-1",
        accountingPeriodId:
          "period-1",

        providerCustomerId:
          "provider-1",
        providerType:
          "TAILOR",
        assignmentType:
          "EXTERNAL",

        operationId:
          "operation-1",
        earningsEntryId:
          "earning-1",

        finalizedAmount:
          1250.456,
        currency:
          "TRY",

        occurredAt:
          "2026-08-05T08:00:00.000Z",
        finalizedAt:
          "2026-08-05T08:05:00.000Z",
        recordedAt:
          "2026-08-05T08:06:00.000Z"
      });

    assert.equal(
      result.ok,
      true
    );

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.value.sourceId,
      "provider-earning-source:earning-1"
    );

    assert.equal(
      result.value.status,
      "FINALIZED"
    );

    assert.equal(
      result.value.finalizedAmount,
      1250.46
    );

    assert.equal(
      result.value.providerCustomerId,
      "provider-1"
    );

    assert.equal(
      result.value.operationId,
      "operation-1"
    );

    assert.equal(
      result.value.earningsEntryId,
      "earning-1"
    );

    assert.equal(
      result.value.sourceDocumentId,
      undefined
    );  }
);

test(
  "internal provider never projects payable source truth",
  () => {
    const result =
      projectProviderEarningSourceTruth({
        tenantId:
          "tenant-1",
        companyId:
          "company-1",
        branchId:
          "branch-1",
        accountingPeriodId:
          "period-1",

        providerCustomerId:
          "internal-user:installer-1",
        providerType:
          "INSTALLER",
        assignmentType:
          "INTERNAL",

        operationId:
          "operation-1",
        earningsEntryId:
          "earning-1",

        finalizedAmount:
          500,
        currency:
          "TRY",

        occurredAt:
          "2026-08-05T08:00:00.000Z",
        finalizedAt:
          "2026-08-05T08:05:00.000Z",
        recordedAt:
          "2026-08-05T08:06:00.000Z"
      });

    assert.deepEqual(
      result,
      {
        ok: false,
        reason:
          "INTERNAL_PROVIDER"
      }
    );
  }
);