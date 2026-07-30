import assert from "node:assert/strict";

import type {
  SaleReturnFinanceOutboxExecutionResult
} from "../src/lib/finance/saleReturnFinanceOutboxExecutor";

import type {
  SaleReturnDocument
} from "../src/lib/saleReturnService";

import type {
  SaleReturnStatusAudit
} from "../src/lib/saleReturnStatusService";

import type {
  ApplySaleReturnStatusOutcome,
  SaleReturnFinanceOutboxRecord,
  SaveSaleReturnOutcome
} from "../src/lib/localSaleReturnsDb";

import {
  approveSaleReturnWorkflow,
  startSaleReturnWorkflow,
  type SaleReturnWorkflowDependencies
} from "../src/lib/saleReturnWorkflowService";

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

    status:
      "BAŞLATILDI",

    actorUserId:
      "user-1",

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

const audit:
  SaleReturnStatusAudit = {
    id:
      "sale-return-status:return-1",
    saleReturnId:
      "return-1",
    fromStatus:
      "BAŞLATILDI",
    toStatus:
      "ONAYLANDI",
    actorUserId:
      "admin-1",
    occurredAt:
      "2026-07-31T02:05:00.000Z",
    reason:
      "İade onaylandı"
  };

const outbox:
  SaleReturnFinanceOutboxRecord = {
    ...scope,

    id:
      "sale-return-finance-outbox:return-1",

    saleReturnId:
      "return-1",
    saleId:
      "sale-1",
    customerId:
      "customer-1",

    saleReturnSnapshot:
      approvedReturn,

    status: "PENDING",
    retryCount: 0,

    createdAt:
      audit.occurredAt,

    updatedAt:
      audit.occurredAt
  };

function createDependencies():
SaleReturnWorkflowDependencies {
  return {
    createSaleReturn() {
      return {
        outcome: "ACCEPTED",
        saleReturn:
          startedReturn
      };
    },

    async saveLocalSaleReturn():
    Promise<SaveSaleReturnOutcome> {
      return {
        outcome: "CREATED",
        saleReturn:
          startedReturn
      };
    },

    requestSaleReturnStatusTransition() {
      return {
        outcome: "ACCEPTED",
        audit
      };
    },

    async applyLocalSaleReturnStatus():
    Promise<ApplySaleReturnStatusOutcome> {
      return {
        outcome: "UPDATED",
        saleReturn:
          approvedReturn,
        audit: {
          ...scope,
          ...audit,
          saleId:
            "sale-1",
          customerId:
            "customer-1"
        }
      };
    },

    async loadPendingSaleReturnFinanceOutbox() {
      return [outbox];
    },

    async executeSaleReturnFinanceOutboxRecord():
    Promise<
      SaleReturnFinanceOutboxExecutionResult
    > {
      return {
        outcome: "SYNCED",

        record: {
          ...outbox,
          status: "SYNCED",
          processedAt:
            "2026-07-31T02:06:00.000Z",
          updatedAt:
            "2026-07-31T02:06:00.000Z"
        },

        financeOutcome:
          "CREATED"
      };
    }
  };
}

async function run():
Promise<void> {
  const dependencies =
    createDependencies();

  const startResult =
    await startSaleReturnWorkflow(
      {
        ...scope,

        saleId: "sale-1",
        customerId:
          "customer-1",

        saleStatus:
          "ONAYLANDI",

        actorUserId:
          "user-1",

        amount: 400,
        returnableAmount:
          1000,

        currency: "TRY",

        reason:
          "Müşteri vazgeçti",

        occurredAt:
          "2026-07-31T02:00:00.000Z",

        idempotencyKey:
          "sale-return:sale-1:001"
      },
      dependencies
    );

  assert.equal(
    startResult.outcome,
    "CREATED"
  );

  const approveResult =
    await approveSaleReturnWorkflow(
      {
        scope,
        saleReturn:
          startedReturn,
        actorUserId:
          "admin-1",
        occurredAt:
          "2026-07-31T02:05:00.000Z",
        reason:
          "İade onaylandı"
      },
      dependencies
    );

  assert.equal(
    approveResult.outcome,
    "SYNCED"
  );

  if (
    approveResult.outcome !==
    "SYNCED"
  ) {
    throw new Error(
      "Expected SYNCED workflow."
    );
  }

  assert.equal(
    approveResult.statusOutcome,
    "UPDATED"
  );

  assert.equal(
    approveResult.financeOutcome,
    "CREATED"
  );

  assert.equal(
    approveResult
      .saleReturn.status,
    "ONAYLANDI"
  );

  const replayDependencies =
    createDependencies();

  replayDependencies
    .applyLocalSaleReturnStatus =
      async () => ({
        outcome: "REPLAY",
        saleReturn:
          approvedReturn,
        audit: {
          ...scope,
          ...audit,
          saleId:
            "sale-1",
          customerId:
            "customer-1"
        }
      });

  replayDependencies
    .executeSaleReturnFinanceOutboxRecord =
      async () => ({
        outcome: "SYNCED",

        record: {
          ...outbox,
          status: "SYNCED",
          processedAt:
            "2026-07-31T02:06:00.000Z",
          updatedAt:
            "2026-07-31T02:06:00.000Z"
        },

        financeOutcome:
          "REPLAY"
      });

  const replayResult =
    await approveSaleReturnWorkflow(
      {
        scope,
        saleReturn:
          startedReturn,
        actorUserId:
          "admin-1",
        occurredAt:
          "2026-07-31T02:05:00.000Z"
      },
      replayDependencies
    );

  assert.equal(
    replayResult.outcome,
    "SYNCED"
  );

  if (
    replayResult.outcome !==
    "SYNCED"
  ) {
    throw new Error(
      "Expected replay SYNCED workflow."
    );
  }

  assert.equal(
    replayResult.statusOutcome,
    "REPLAY"
  );

  assert.equal(
    replayResult.financeOutcome,
    "REPLAY"
  );

  const statusRejectDependencies =
    createDependencies();

  statusRejectDependencies
    .requestSaleReturnStatusTransition =
      () => ({
        outcome: "REJECTED",
        reason:
          "TRANSITION_NOT_ALLOWED"
      });

  const statusReject =
    await approveSaleReturnWorkflow(
      {
        scope,
        saleReturn: {
          ...startedReturn,
          status: "REDDEDİLDİ"
        },
        actorUserId:
          "admin-1",
        occurredAt:
          "2026-07-31T02:05:00.000Z"
      },
      statusRejectDependencies
    );

  assert.deepEqual(
    statusReject,
    {
      outcome:
        "STATUS_REJECTED",
      reason:
        "TRANSITION_NOT_ALLOWED"
    }
  );

  const missingOutboxDependencies =
    createDependencies();

  missingOutboxDependencies
    .loadPendingSaleReturnFinanceOutbox =
      async () => [];

  const missingOutbox =
    await approveSaleReturnWorkflow(
      {
        scope,
        saleReturn:
          startedReturn,
        actorUserId:
          "admin-1",
        occurredAt:
          "2026-07-31T02:05:00.000Z"
      },
      missingOutboxDependencies
    );

  assert.equal(
    missingOutbox.outcome,
    "FINANCE_ERROR"
  );

  if (
    missingOutbox.outcome !==
    "FINANCE_ERROR"
  ) {
    throw new Error(
      "Expected missing outbox error."
    );
  }

  assert.equal(
    missingOutbox.reason,
    "SALE_RETURN_FINANCE_OUTBOX_NOT_FOUND"
  );

  const financeErrorDependencies =
    createDependencies();

  financeErrorDependencies
    .executeSaleReturnFinanceOutboxRecord =
      async () => ({
        outcome: "ERROR",
        record: {
          ...outbox,
          status: "ERROR",
          retryCount: 1,
          lastError:
            "FINANCE_COMMAND_REJECTED:OVERPAYMENT"
        },
        reason:
          "FINANCE_COMMAND_REJECTED:OVERPAYMENT"
      });

  const financeError =
    await approveSaleReturnWorkflow(
      {
        scope,
        saleReturn:
          startedReturn,
        actorUserId:
          "admin-1",
        occurredAt:
          "2026-07-31T02:05:00.000Z"
      },
      financeErrorDependencies
    );

  assert.equal(
    financeError.outcome,
    "FINANCE_ERROR"
  );

  if (
    financeError.outcome !==
    "FINANCE_ERROR"
  ) {
    throw new Error(
      "Expected finance error."
    );
  }

  assert.equal(
    financeError.reason,
    "FINANCE_COMMAND_REJECTED:OVERPAYMENT"
  );

  console.log(
    "saleReturnWorkflowServiceSuite: PASS"
  );
}

run().catch(
  error => {
    console.error(error);
    process.exitCode = 1;
  }
);