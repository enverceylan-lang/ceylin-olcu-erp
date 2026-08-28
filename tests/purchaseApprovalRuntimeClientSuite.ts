import assert from "node:assert/strict";

import {
  approvePurchaseDocumentServer,
  persistPurchaseDraftServer,
} from "../src/lib/purchaseApprovalRuntimeClient";

async function main(): Promise<void> {
  const originalFetch =
    globalThis.fetch;

  try {
    const calls: string[] = [];

    globalThis.fetch =
      (async (
        input:
          string | URL | Request,
      ) => {
        calls.push(
          String(input),
        );

        if (
          String(input) ===
          "/api/purchases/draft"
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              result: {
                outcome: "CREATED",
                purchaseDocumentId:
                  "purchase-1",
                payloadHash:
                  "a".repeat(64),
                updatedAt:
                  "2026-08-27T12:00:00.000Z",
              },
            }),
            {
              status: 201,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            result: {
              outcome: "CREATED",
              purchaseDocumentId:
                "purchase-1",
              payableMovementId:
                "purchase-payable:purchase-1",
              price1Updates: [
                {
                  stockItemId:
                    "stock-1",
                  purchasePrice1: 105,
                  purchaseDocumentLineId:
                    "line-1",
                },
              ],
              approvedAt:
                "2026-08-27T12:01:00.000Z",
            },
          }),
          {
            status: 201,
            headers: {
              "Content-Type":
                "application/json",
            },
          },
        );
      }) as typeof fetch;

    const draftResult =
      await persistPurchaseDraftServer({
        tenantId: "tenant-1",
        companyId: "company-1",
        branchId: "branch-1",
        accountingPeriodId:
          "period-1",
        purchaseDocumentId:
          "purchase-1",
        documentNo: "FAT-1",
        supplierId: "supplier-1",
        documentDate:
          "2026-08-27T12:00:00.000Z",
        currency: "TRY",
        status: "DRAFT",
        lines: [
          {
            id: "line-1",
            kind: "GOODS",
            stockItemId:
              "stock-1",
            description: "Tül",
            quantity: 1,
            unit: "mt",
            unitPrice: 105,
            taxRate: 10,
            taxIncluded: false,
          },
        ],
      });

    const approvalResult =
      await approvePurchaseDocumentServer({
        tenantId: "tenant-1",
        companyId: "company-1",
        branchId: "branch-1",
        accountingPeriodId:
          "period-1",
        purchaseDocumentId:
          "purchase-1",
        approvalIdempotencyKey:
          "approve-1",
        expectedDraftPayloadHash:
          draftResult.payloadHash,
      });

    assert.deepEqual(
      calls,
      [
        "/api/purchases/draft",
        "/api/purchases/approve",
      ],
    );
    assert.equal(
      approvalResult
        .price1Updates[0]
        .purchasePrice1,
      105,
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }

  console.log(
    "purchaseApprovalRuntimeClientSuite: PASS",
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
