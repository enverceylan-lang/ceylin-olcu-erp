import assert from "node:assert/strict";
import test from "node:test";
import {
  createCounterpartySourceTruthSupabaseGatewayAdapter
} from "../src/lib/finance/counterpartySourceTruthSupabaseGatewayAdapter";

test(
  "counterparty source truth adapter calls dedicated supplier receipt RPC",
  async () => {
    const calls:
      Array<{
        name: string;
        args: Record<string, unknown>;
      }> = [];

    const adapter =
      createCounterpartySourceTruthSupabaseGatewayAdapter({
        async rpc(
          name,
          args
        ) {
          calls.push({
            name,
            args
          });

          return {
            data: {
              status: "CREATED",
              sourceId:
                "supplier-receipt-source-1"
            },
            error: null
          };
        }
      });

    const result =
      await adapter.persistSupplierReceiptSource(
        {
          sourceId:
            "supplier-receipt-source-1",
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
          netAmount:
            750,
          payableAmount:
            900,
          currency:
            "TRY",
          receivedAt:
            "2026-08-05T08:00:00.000Z",
          recordedAt:
            "2026-08-05T08:01:00.000Z"
        },
        {
          userId:
            "admin-1"
        }
      );

    assert.equal(
      result.status,
      "CREATED"
    );

    assert.equal(
      calls.length,
      1
    );

    assert.equal(
      calls[0]?.name,
      "persist_counterparty_supplier_receipt_source_v1"
    );
  }
);

test(
  "counterparty source truth adapter calls dedicated provider earning RPC",
  async () => {
    const calls: string[] = [];

    const adapter =
      createCounterpartySourceTruthSupabaseGatewayAdapter({
        async rpc(
          name
        ) {
          calls.push(name);

          return {
            data: {
              status: "REPLAY",
              sourceId:
                "provider-earning-source-1"
            },
            error: null
          };
        }
      });

    const result =
      await adapter.persistProviderEarningSource(
        {
          sourceId:
            "provider-earning-source-1",
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
          status:
            "FINALIZED",
          finalizedAmount:
            1200,
          currency:
            "TRY",
          occurredAt:
            "2026-08-05T08:00:00.000Z",
          finalizedAt:
            "2026-08-05T08:05:00.000Z",
          recordedAt:
            "2026-08-05T08:06:00.000Z"
        },
        {
          userId:
            "admin-1"
        }
      );

    assert.equal(
      result.status,
      "REPLAY"
    );

    assert.deepEqual(
      calls,
      [
        "persist_counterparty_provider_earning_source_v1"
      ]
    );
  }
);