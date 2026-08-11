import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";
import {
  calculateCounterpartyPayableBalance,
  createCounterpartyPayableMovement,
  registerCounterpartyPayment,
  reverseCounterpartyPayableMovement
} from "../src/lib/counterpartyPayableService";
import {
  calculateTailorCompletionEarnings
} from "../src/lib/tailorCompletionEarningsCoordinator";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId:
    "period-1"
};

test(
  "provider accrual + payment + reversal derives balance without direct balance mutation",
  () => {
    const accrual =
      createCounterpartyPayableMovement(
        {
          movements: []
        },
        {
          ...scope,
          id: "m1",
          idempotencyKey:
            "provider:m1",
          counterpartyCustomerId:
            "provider-1",
          counterpartyType:
            "INSTALLER",
          kind:
            "ACCRUAL",
          amount: 1000,
          currency: "TRY",
          occurredAt:
            "2026-08-05T10:00:00.000Z",
          recordedAt:
            "2026-08-05T10:00:00.000Z",
          operationId:
            "install-1",
          providerEarningsEntryId:
            "earning-1"
        }
      );

    assert.equal(
      accrual.outcome,
      "CREATED"
    );

    if (
      accrual.outcome !==
      "CREATED"
    ) {
      return;
    }

    const payment =
      registerCounterpartyPayment(
        accrual.state,
        {
          ...scope,
          id: "p1",
          idempotencyKey:
            "payment:p1",
          counterpartyCustomerId:
            "provider-1",
          counterpartyType:
            "INSTALLER",
          amount: 400,
          currency: "TRY",
          occurredAt:
            "2026-08-06T10:00:00.000Z",
          recordedAt:
            "2026-08-06T10:00:00.000Z",
          sourcePaymentId:
            "pay-1"
        }
      );

    assert.equal(
      payment.outcome,
      "CREATED"
    );

    if (
      payment.outcome !==
      "CREATED"
    ) {
      return;
    }

    assert.equal(
      calculateCounterpartyPayableBalance(
        payment.state.movements,
        scope,
        "provider-1"
      ),
      600
    );

    const reversal =
      reverseCounterpartyPayableMovement(
        payment.state,
        {
          scope,
          sourceMovementId:
            "p1",
          reversalMovementId:
            "r1",
          idempotencyKey:
            "reverse:p1",
          occurredAt:
            "2026-08-07T10:00:00.000Z",
          recordedAt:
            "2026-08-07T10:00:00.000Z"
        }
      );

    assert.equal(
      reversal.outcome,
      "CREATED"
    );

    if (
      reversal.outcome !==
      "CREATED"
    ) {
      return;
    }

    assert.equal(
      calculateCounterpartyPayableBalance(
        reversal.state.movements,
        scope,
        "provider-1"
      ),
      1000
    );
  }
);

test(
  "same idempotency replays and conflict rejects",
  () => {
    const request = {
      ...scope,
      id: "m1",
      idempotencyKey:
        "same",
      counterpartyCustomerId:
        "provider-1",
      counterpartyType:
        "TAILOR" as const,
      kind:
        "ACCRUAL" as const,
      amount: 500,
      currency:
        "TRY" as const,
      occurredAt:
        "2026-08-05T10:00:00.000Z",
      recordedAt:
        "2026-08-05T10:00:00.000Z"
    };

    const first =
      createCounterpartyPayableMovement(
        {
          movements: []
        },
        request
      );

    assert.equal(
      first.outcome,
      "CREATED"
    );

    if (
      first.outcome !==
      "CREATED"
    ) {
      return;
    }

    const replay =
      createCounterpartyPayableMovement(
        first.state,
        request
      );

    assert.equal(
      replay.outcome,
      "REPLAY"
    );

    const conflict =
      createCounterpartyPayableMovement(
        first.state,
        {
          ...request,
          amount: 600
        }
      );

    assert.equal(
      conflict.outcome,
      "REJECTED"
    );
  }
);

test(
  "tailor completedAt selects effective sewing rate and production breakdown",
  () => {
    const result =
      calculateTailorCompletionEarnings({
        operation: {
          ...scope,
          id: "tailor-op",
          idempotencyKey:
            "tailor-op",
          kind:
            "TAILOR",
          sourceId:
            "sale-1",
          saleId:
            "sale-1",
          customerId:
            "customer-1",
          customerName:
            "Musteri",
          title:
            "Terzi",
          details: [],
          party: {
            id:
              "tailor-cari-1",
            userId:
              "tailor-user-1",
            name:
              "Terzi",
            assignmentType:
              "EXTERNAL",
            providerCustomerId:
              "tailor-cari-1"
          },
          scheduledAt:
            "2026-08-05T08:00:00.000Z",
          dueAt:
            "2026-08-05T12:00:00.000Z",
          status:
            "COMPLETED",
          createdByUserId:
            "admin",
          createdAt:
            "2026-08-04T08:00:00.000Z",
          updatedAt:
            "2026-08-05T10:00:00.000Z",
          completedAt:
            "2026-08-05T10:00:00.000Z"
        },
        sale: {
          ...scope,
          id: "sale-1",
          saleNo: "S-1",
          customerId:
            "customer-1",
          status:
            "ONAYLANDI",
          items: [
            {
              id: "grouped",
              roomName:
                "Salon",
              windowName:
                "Toplam",
              productType:
                "Tül",
              productGroup:
                "Perde",
              stockItemId:
                "tul-1",
              width: 0,
              height: 0,
              calcWidth: 0,
              calcHeight: 0,
              quantity: 1,
              metricSize: 10,
              metricUnit:
                "mt",
              productionBreakdown: [
                {
                  id: "detail-1",
                  roomName:
                    "Salon",
                  windowName:
                    "Cam",
                  productType:
                    "Tül",
                  productGroup:
                    "Perde",
                  stockItemId:
                    "tul-1",
                  width: 200,
                  height: 260,
                  calcWidth: 200,
                  calcHeight: 260,
                  quantity: 1,
                  metricSize: 6,
                  metricUnit:
                    "mt",
                  fabricMeters: 6,
                  unitPrice: 0,
                  discount: 0,
                  rowTotal: 0
                }
              ],
              unitPrice: 0,
              discount: 0,
              rowTotal: 0
            }
          ],
          priceSource:
            "STOCK",
          totalAmount: 0,
          cashPrice: 0,
          installmentPrice: 0,
          discount: 0,
          downPayment: 0,
          remainingBalance: 0,
          createdAt:
            "2026-08-04T08:00:00.000Z",
          updatedAt:
            "2026-08-04T08:00:00.000Z"
        },
        products: [
          {
            id: "tul-1",
            stockCode:
              "TUL-1",
            name: "Tül",
            category:
              "Tül",
            unit: "Metre",
            cashPrice: 0,
            installmentPrice: 0,
            dealerPrice: 0,
            productKind:
              "PHYSICAL",
            requiresSewing:
              true,
            sewingServiceStockItemId:
              "tul-dikim"
          }
        ],
        rates: [
          {
            ...scope,
            id: "old-rate",
            providerCustomerId:
              "tailor-cari-1",
            providerType:
              "TAILOR",
            serviceStockItemId:
              "tul-dikim",
            unit:
              "METER",
            unitPrice: 50,
            currency:
              "TRY",
            validFrom:
              "2026-01-01T00:00:00.000Z",
            validTo:
              "2026-08-01T00:00:00.000Z",
            active: true,
            createdAt:
              "2026-01-01T00:00:00.000Z"
          },
          {
            ...scope,
            id: "current-rate",
            providerCustomerId:
              "tailor-cari-1",
            providerType:
              "TAILOR",
            serviceStockItemId:
              "tul-dikim",
            unit:
              "METER",
            unitPrice: 70,
            currency:
              "TRY",
            validFrom:
              "2026-08-01T00:00:00.000Z",
            active: true,
            createdAt:
              "2026-08-01T00:00:00.000Z"
          }
        ]
      });

    assert.deepEqual(
      result,
      {
        ok: true,
        amount: 420
      }
    );
  }
);

test(
  "package A1 wiring contracts are present",
  async () => {
    const [
      operations,
      actions,
      customer
    ] =
      await Promise.all([
        readFile(
          "src/store/useOperationsStore.ts",
          "utf8"
        ),
        readFile(
          "src/components/operations/ProviderOperationActions.tsx",
          "utf8"
        ),
        readFile(
          "src/app/cariler/[id]/page.tsx",
          "utf8"
        )
      ]);

    assert.match(
      operations,
      /COUNTERPARTY_PAYABLE/
    );

    assert.match(
      operations,
      /COUNTERPARTY_PAYMENT/
    );

    assert.match(
      actions,
      /calculateTailorCompletionEarnings/
    );

    assert.match(
      actions,
      /calculateInstallationEarningsAmount/
    );

    assert.match(
      actions,
      /automaticEarningsAmount/
    );

    assert.match(
      customer,
      /CounterpartyPayablePanel/
    );
  }
);