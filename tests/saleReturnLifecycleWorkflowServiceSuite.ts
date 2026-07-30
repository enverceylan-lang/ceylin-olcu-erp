import assert from "node:assert/strict";

import type {
  SaleReturnDocument
} from "../src/lib/saleReturnService";

import type {
  SaleReturnStatusAudit
} from "../src/lib/saleReturnStatusService";

import type {
  ApplySaleReturnStatusOutcome
} from "../src/lib/localSaleReturnsDb";

import {
  completeSaleReturnWorkflow,
  rejectSaleReturnWorkflow,
  type SaleReturnLifecycleDependencies
} from "../src/lib/saleReturnLifecycleWorkflowService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId:
    "period-1"
};

const startedReturn:
  SaleReturnDocument = {
    ...scope,

    id: "return-1",
    saleId: "sale-1",
    customerId:
      "customer-1",

    status: "BAŞLATILDI",
    actorUserId: "user-1",

    amount: 400,
    currency: "TRY",
    reason:
      "Müşteri vazgeçti",

    occurredAt:
      "2026-07-31T02:00:00.000Z",

    idempotencyKey:
      "sale-return:sale-1:001",

    createdAt:
      "2026-07-31T02:00:00.000Z",

    updatedAt:
      "2026-07-31T02:00:00.000Z"
  };

const approvedReturn:
  SaleReturnDocument = {
    ...startedReturn,

    status: "ONAYLANDI",

    updatedAt:
      "2026-07-31T02:05:00.000Z"
  };

function makeAudit(
  fromStatus:
    SaleReturnDocument["status"],
  toStatus:
    SaleReturnDocument["status"]
): SaleReturnStatusAudit {
  return {
    id:
      `audit:${fromStatus}:${toStatus}`,

    saleReturnId:
      "return-1",

    fromStatus,
    toStatus,

    actorUserId:
      "admin-1",

    occurredAt:
      "2026-07-31T02:10:00.000Z",

    reason: null
  };
}

function createDependencies(
  expectedFrom:
    SaleReturnDocument["status"],

  expectedTo:
    SaleReturnDocument["status"],

  persistenceOutcome:
    ApplySaleReturnStatusOutcome["outcome"] =
      "UPDATED"
): {
  value:
    SaleReturnLifecycleDependencies;

  calls: {
    transitionCount: number;
    persistenceCount: number;
  };
} {
  const calls = {
    transitionCount: 0,
    persistenceCount: 0
  };

  const statusAudit =
    makeAudit(
      expectedFrom,
      expectedTo
    );

  return {
    calls,

    value: {
      requestSaleReturnStatusTransition(
        request
      ) {
        calls.transitionCount++;

        assert.equal(
          request.fromStatus,
          expectedFrom
        );

        assert.equal(
          request.toStatus,
          expectedTo
        );

        return {
          outcome: "ACCEPTED",
          audit:
            statusAudit
        };
      },

      async applyLocalSaleReturnStatus(
        input
      ) {
        calls.persistenceCount++;

        assert.deepEqual(
          input.scope,
          scope
        );

        assert.equal(
          input.expectedStatus,
          expectedFrom
        );

        assert.equal(
          input.nextStatus,
          expectedTo
        );

        const sourceReturn =
          expectedFrom ===
            "BAŞLATILDI"
            ? startedReturn
            : approvedReturn;

        const updatedReturn:
          SaleReturnDocument = {
          ...sourceReturn,

          status:
            expectedTo,

          updatedAt:
            statusAudit.occurredAt
        };

        const result:
          ApplySaleReturnStatusOutcome = {
          outcome:
            persistenceOutcome,

          saleReturn:
            updatedReturn,

          audit: {
            ...scope,
            ...statusAudit,

            saleId:
              updatedReturn.saleId,

            customerId:
              updatedReturn.customerId
          }
        };

        return result;
      }
    }
  };
}

async function run():
Promise<void> {
  const rejectDependencies =
    createDependencies(
      "BAŞLATILDI",
      "REDDEDİLDİ"
    );

  const rejected =
    await rejectSaleReturnWorkflow(
      {
        scope,

        saleReturn:
          startedReturn,

        actorUserId:
          "admin-1",

        occurredAt:
          "2026-07-31T02:10:00.000Z",

        reason:
          "İade koşulları oluşmadı"
      },

      rejectDependencies.value
    );

  assert.equal(
    rejected.outcome,
    "UPDATED"
  );

  assert.ok(
    "saleReturn" in rejected
  );

  if (
    "saleReturn" in rejected
  ) {
    assert.equal(
      rejected.saleReturn.status,
      "REDDEDİLDİ"
    );
  }

  assert.equal(
    rejectDependencies
      .calls.transitionCount,
    1
  );

  assert.equal(
    rejectDependencies
      .calls.persistenceCount,
    1
  );

  const completeDependencies =
    createDependencies(
      "ONAYLANDI",
      "TAMAMLANDI"
    );

  const completed =
    await completeSaleReturnWorkflow(
      {
        scope,

        saleReturn:
          approvedReturn,

        actorUserId:
          "admin-1",

        occurredAt:
          "2026-07-31T02:15:00.000Z",

        reason:
          "İade süreci tamamlandı"
      },

      completeDependencies.value
    );

  assert.equal(
    completed.outcome,
    "UPDATED"
  );

  assert.ok(
    "saleReturn" in completed
  );

  if (
    "saleReturn" in completed
  ) {
    assert.equal(
      completed.saleReturn.status,
      "TAMAMLANDI"
    );
  }

  const replayDependencies =
    createDependencies(
      "ONAYLANDI",
      "TAMAMLANDI",
      "REPLAY"
    );

  const replay =
    await completeSaleReturnWorkflow(
      {
        scope,

        saleReturn:
          approvedReturn,

        actorUserId:
          "admin-1",

        occurredAt:
          "2026-07-31T02:15:00.000Z"
      },

      replayDependencies.value
    );

  assert.equal(
    replay.outcome,
    "REPLAY"
  );

  const invalidDependencies =
    createDependencies(
      "TAMAMLANDI",
      "REDDEDİLDİ"
    );

  invalidDependencies
    .value
    .requestSaleReturnStatusTransition =
      () => ({
        outcome: "REJECTED",
        reason:
          "TRANSITION_NOT_ALLOWED"
      });

  const invalid =
    await rejectSaleReturnWorkflow(
      {
        scope,

        saleReturn: {
          ...approvedReturn,
          status: "TAMAMLANDI"
        },

        actorUserId:
          "admin-1",

        occurredAt:
          "2026-07-31T02:20:00.000Z"
      },

      invalidDependencies.value
    );

  assert.deepEqual(
    invalid,
    {
      outcome: "REJECTED",
      reason:
        "TRANSITION_NOT_ALLOWED"
    }
  );

  assert.equal(
    invalidDependencies
      .calls.persistenceCount,
    0
  );

  console.log(
    "saleReturnLifecycleWorkflowServiceSuite: PASS"
  );
}

run().catch(
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);