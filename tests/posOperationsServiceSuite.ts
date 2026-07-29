import assert from "node:assert/strict";

import type {
  PosContract,
  PosContractRule
} from "../src/lib/finance/posContracts";
import type {
  PosOperationContext,
  PosOperationState
} from "../src/lib/finance/posOperationsContracts";
import {
  createPosMonthlyFee,
  createPosTransaction,
  payPosMonthlyFee,
  refundPosTransaction,
  reversePosOperation,
  settlePosTransaction
} from "../src/lib/finance/posOperationsService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function context(
  idempotencyKey: string,
  operationDate =
    "2026-07-27T20:00:00.000Z"
): PosOperationContext {
  return {
    ...scope,
    userId: "admin",
    operationDate,
    idempotencyKey
  };
}

function contract(
  overrides: Partial<PosContract> = {}
): PosContract {
  const base: PosContract = {
    ...scope,

    id: "contract-1",
    contractNumber: "POS-SOZ-0001",
    contractName: "Banka POS Sözleşmesi",

    bankAccountId: "bank-1",
    posAccountId: "pos-1",

    workingMode: "ADVANCE_NET",

    monthlyFixedFeeEnabled: true,
    monthlyFixedFeeAmount: 500,

    currency: "TRY",
    validFrom: "2026-01-01",
    validUntil: null,

    isActive: true,

    createdBy: "admin",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as PosContract;
}

function rule(
  overrides: Partial<PosContractRule> = {}
): PosContractRule {
  const base: PosContractRule = {
    ...scope,

    id: "rule-1",
    posContractId: "contract-1",
    posAccountId: "pos-1",

    installmentCount: 1,
    workingMode: "ADVANCE_NET",

    commissionRate: 3,
    fixedTransactionFee: 0,
    taxRate: 0,
    additionalFeeRate: 0,

    firstSettlementDayCount: 1,
    installmentIntervalDayCount: 0,

    isActive: true,

    createdBy: "admin",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as PosContractRule;
}

function emptyState(): PosOperationState {
  return {
    transactions: [],
    settlementSchedules: [],
    monthlyFees: [],
    audits: []
  };
}

function run(): void {
  let state = emptyState();

  const created = createPosTransaction(
    {
      context: context("create-pos-1"),

      id: "pos-transaction-1",
      posTransactionNumber: "POS-ISL-0001",

      contract: contract(),
      rule: rule(),

      saleId: "sale-1",
      saleNumber: "SAT-0001",
      paymentId: "payment-1",
      customerId: "customer-1",

      grossAmount: 10000,
      installmentCount: 1,
      transactionDate: "2026-07-27",

      currency: "TRY",
      description: "10.000 TL POS tahsilatı"
    },
    state
  );

  assert.equal(
    created.value.transaction.grossAmount,
    10000
  );

  assert.equal(
    created.value.transaction.commissionAmount,
    300
  );

  assert.equal(
    created.value.transaction.netAmount,
    9700
  );

  assert.equal(
    created.value.transaction.settledAmount,
    0
  );

  assert.equal(
    created.value.transaction.pendingAmount,
    9700
  );

  assert.equal(
    created.value.transaction.status,
    "PENDING_SETTLEMENT"
  );

  assert.equal(
    created.value.settlementSchedule.lines.length,
    1
  );

  assert.equal(
    created.value.settlementSchedule.lines[0]
      .expectedSettlementDate,
    "2026-07-28"
  );

  assert.equal(
    created.value.transaction.ruleSnapshot
      .commissionRate,
    3
  );

  state = {
    ...state,
    transactions: [
      created.value.transaction
    ],
    settlementSchedules: [
      created.value.settlementSchedule
    ],
    audits: [
      created.audit
    ]
  };

  assert.throws(
    () =>
      createPosTransaction(
        {
          context: context("create-pos-1"),

          id: "pos-transaction-repeat",
          posTransactionNumber:
            "POS-ISL-REPEAT",

          contract: contract(),
          rule: rule(),

          saleId: "sale-1",
          saleNumber: "SAT-0001",
          paymentId: "payment-repeat",
          customerId: "customer-1",

          grossAmount: 10000,
          installmentCount: 1,
          transactionDate: "2026-07-27",

          currency: "TRY",
          description: null
        },
        state
      ),
    /POS_OPERATION_IDEMPOTENCY_CONFLICT/
  );

  assert.throws(
    () =>
      createPosTransaction(
        {
          context: context(
            "duplicate-payment"
          ),

          id: "pos-transaction-duplicate",
          posTransactionNumber:
            "POS-ISL-0002",

          contract: contract(),
          rule: rule(),

          saleId: "sale-1",
          saleNumber: "SAT-0001",
          paymentId: "payment-1",
          customerId: "customer-1",

          grossAmount: 10000,
          installmentCount: 1,
          transactionDate: "2026-07-27",

          currency: "TRY",
          description: null
        },
        state
      ),
    /POS_OPERATION_PAYMENT_ALREADY_POSTED/
  );

  const scheduleLine =
    created.value.settlementSchedule.lines[0];

  const partialSettlement =
    settlePosTransaction(
      {
        context: context(
          "settlement-partial",
          "2026-07-28T10:00:00.000Z"
        ),

        transaction:
          created.value.transaction,
        schedule:
          created.value.settlementSchedule,

        scheduleLineId: scheduleLine.id,
        settlementId: "settlement-1",
        settlementNumber: "POS-GEC-0001",

        amount: 4000,
        actualSettlementDate: "2026-07-28",
        bankMovementId: "bank-movement-1"
      },
      state
    );

  assert.equal(
    partialSettlement.value
      .transaction.settledAmount,
    4000
  );

  assert.equal(
    partialSettlement.value
      .transaction.pendingAmount,
    5700
  );

  assert.equal(
    partialSettlement.value.transaction.status,
    "PARTIALLY_SETTLED"
  );

  assert.equal(
    partialSettlement.value
      .settlementSchedule.lines[0].status,
    "PARTIALLY_SETTLED"
  );

  state = {
    ...state,
    transactions: [
      partialSettlement.value.transaction
    ],
    settlementSchedules: [
      partialSettlement.value
        .settlementSchedule
    ],
    audits: [
      ...state.audits,
      partialSettlement.audit
    ]
  };

  const finalSettlement =
    settlePosTransaction(
      {
        context: context(
          "settlement-final",
          "2026-07-28T11:00:00.000Z"
        ),

        transaction:
          partialSettlement.value.transaction,
        schedule:
          partialSettlement.value
            .settlementSchedule,

        scheduleLineId: scheduleLine.id,
        settlementId: "settlement-2",
        settlementNumber: "POS-GEC-0002",

        amount: 5700,
        actualSettlementDate: "2026-07-28",
        bankMovementId: "bank-movement-2"
      },
      state
    );

  assert.equal(
    finalSettlement.value
      .transaction.settledAmount,
    9700
  );

  assert.equal(
    finalSettlement.value
      .transaction.pendingAmount,
    0
  );

  assert.equal(
    finalSettlement.value.transaction.status,
    "SETTLED"
  );

  assert.equal(
    finalSettlement.value.transaction
      .actualSettlementDate,
    "2026-07-28"
  );

  assert.equal(
    finalSettlement.value
      .settlementSchedule.pendingAmount,
    0
  );

  state = {
    ...state,
    transactions: [
      finalSettlement.value.transaction
    ],
    settlementSchedules: [
      finalSettlement.value
        .settlementSchedule
    ],
    audits: [
      ...state.audits,
      finalSettlement.audit
    ]
  };

  assert.throws(
    () =>
      settlePosTransaction(
        {
          context: context(
            "settlement-overflow"
          ),

          transaction:
            finalSettlement.value.transaction,
          schedule:
            finalSettlement.value
              .settlementSchedule,

          scheduleLineId: scheduleLine.id,
          settlementId: "settlement-3",
          settlementNumber: "POS-GEC-0003",

          amount: 1,
          actualSettlementDate: "2026-07-28",
          bankMovementId: "bank-movement-3"
        },
        state
      ),
    /POS_OPERATION_SETTLEMENT_EXCEEDS_LINE/
  );

  const monthlyFee = createPosMonthlyFee(
    {
      context: context("monthly-fee-create"),

      id: "monthly-fee-2026-07",
      feeNumber: "POS-GDR-2026-07-0001",

      contract: contract(),

      year: 2026,
      month: 7,

      taxRate: 20,
      dueDate: "2026-07-31",

      existingFees: []
    },
    state
  );

  assert.equal(
    monthlyFee.value.grossAmount,
    500
  );

  assert.equal(
    monthlyFee.value.taxAmount,
    100
  );

  assert.equal(
    monthlyFee.value.netAmount,
    600
  );

  assert.equal(
    monthlyFee.value.status,
    "PLANNED"
  );

  state = {
    ...state,
    monthlyFees: [
      monthlyFee.value
    ],
    audits: [
      ...state.audits,
      monthlyFee.audit
    ]
  };

  assert.throws(
    () =>
      createPosMonthlyFee(
        {
          context: context(
            "monthly-fee-duplicate"
          ),

          id: "monthly-fee-repeat",
          feeNumber:
            "POS-GDR-2026-07-0002",

          contract: contract(),

          year: 2026,
          month: 7,

          taxRate: 20,
          dueDate: "2026-07-31",

          existingFees: []
        },
        state
      ),
    /POS_OPERATION_MONTHLY_FEE_DUPLICATE/
  );

  const paidFee = payPosMonthlyFee(
    {
      context: context(
        "monthly-fee-pay",
        "2026-07-31T10:00:00.000Z"
      ),

      fee: monthlyFee.value,
      paidAt: "2026-07-31T10:00:00.000Z",
      bankMovementId:
        "bank-monthly-fee-1"
    },
    state
  );

  assert.equal(
    paidFee.value.status,
    "PAID"
  );

  assert.equal(
    paidFee.value.bankMovementId,
    "bank-monthly-fee-1"
  );

  assert.throws(
    () =>
      payPosMonthlyFee(
        {
          context: context(
            "monthly-fee-pay-repeat"
          ),

          fee: paidFee.value,
          paidAt:
            "2026-08-01T10:00:00.000Z",
          bankMovementId:
            "bank-monthly-fee-2"
        },
        state
      ),
    /POS_OPERATION_MONTHLY_FEE_ALREADY_PAID/
  );

  const refund = refundPosTransaction(
    {
      context: context(
        "refund-pos-1",
        "2026-07-29T10:00:00.000Z"
      ),

      originalTransaction:
        finalSettlement.value.transaction,

      refundTransactionId:
        "pos-refund-1",
      refundTransactionNumber:
        "POS-IADE-0001",

      refundAmount: 10000,
      refundDate: "2026-07-29",

      bankMovementId:
        "bank-refund-1",
      description:
        "Tam POS iadesi"
    },
    state
  );

  assert.equal(
    refund.value.originalTransaction.status,
    "REFUNDED"
  );

  assert.equal(
    refund.value.refundTransaction
      .grossAmount,
    -10000
  );

  assert.equal(
    refund.value.refundTransaction
      .netAmount,
    -10000
  );

  assert.equal(
    refund.value.refundTransaction
      .reversalOfPosTransactionId,
    "pos-transaction-1"
  );

  state = {
    ...state,
    audits: [
      ...state.audits,
      refund.audit
    ]
  };

  const reversal = reversePosOperation(
    {
      context: context(
        "reverse-refund-1",
        "2026-07-29T11:00:00.000Z"
      ),

      operationType:
        "REFUND_TRANSACTION",
      sourceOperationId:
        "pos-refund-1",
      reversalOperationId:
        "pos-refund-reversal-1",

      reversalReason:
        "Yanlış iade kaydı"
    },
    state
  );

  assert.equal(
    reversal.value.operationStatus,
    "REVERSED"
  );

  assert.equal(
    reversal.value.reversalOfAuditId,
    refund.audit.id
  );

  assert.throws(
    () =>
      createPosTransaction(
        {
          context: {
            ...context("scope-failure"),
            branchId: "branch-2"
          },

          id: "scope-failure-transaction",
          posTransactionNumber:
            "POS-SCOPE-FAIL",

          contract: contract(),
          rule: rule(),

          saleId: "sale-2",
          saleNumber: "SAT-0002",
          paymentId: "payment-2",
          customerId: "customer-2",

          grossAmount: 1000,
          installmentCount: 1,
          transactionDate: "2026-07-27",

          currency: "TRY",
          description: null
        },
        state
      ),
    /POS_OPERATION_SCOPE_MISMATCH/
  );

  console.log(
    "[PASS] pos operations service lifecycle"
  );
}

run();
