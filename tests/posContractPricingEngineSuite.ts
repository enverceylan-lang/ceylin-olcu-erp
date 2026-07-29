import assert from "node:assert/strict";

import type {
  PosContractRule
} from "../src/lib/finance/posContracts";
import {
  calculatePosContractPricing
} from "../src/lib/finance/posContractPricingEngine";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

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
    createdAt: "2026-07-27T20:00:00.000Z",
    updatedAt: "2026-07-27T20:00:00.000Z",
    archivedAt: null
  };

  return {
    ...base,
    ...overrides
  } as PosContractRule;
}

function run(): void {
  const nextDay = calculatePosContractPricing({
    grossAmount: 10000,
    installmentCount: 1,
    transactionDate: "2026-07-27",
    rule: rule()
  });

  assert.equal(
    nextDay.commissionAmount,
    300
  );

  assert.equal(
    nextDay.netAmount,
    9700
  );

  assert.equal(
    nextDay.pendingAmount,
    9700
  );

  assert.equal(
    nextDay.expectedFirstSettlementDate,
    "2026-07-28"
  );

  assert.equal(
    nextDay.schedule.length,
    1
  );

  const threeInstallments =
    calculatePosContractPricing({
      grossAmount: 10000,
      installmentCount: 3,
      transactionDate: "2026-07-27",
      rule: rule({
        id: "rule-3-blocked",
        installmentCount: 3,
        workingMode: "MONTHLY_BLOCKED",
        commissionRate: 0,
        firstSettlementDayCount: 30,
        installmentIntervalDayCount: 30
      })
    });

  assert.equal(
    threeInstallments.netAmount,
    10000
  );

  assert.equal(
    threeInstallments.schedule.length,
    3
  );

  assert.equal(
    threeInstallments.schedule[0]
      .expectedSettlementDate,
    "2026-08-26"
  );

  assert.equal(
    threeInstallments.schedule[1]
      .expectedSettlementDate,
    "2026-09-25"
  );

  assert.equal(
    threeInstallments.schedule[2]
      .expectedSettlementDate,
    "2026-10-25"
  );

  assert.equal(
    threeInstallments.schedule.reduce(
      (total, line) =>
        total + line.netAmount,
      0
    ),
    10000
  );

  const fixedDay =
    calculatePosContractPricing({
      grossAmount: 10000,
      installmentCount: 3,
      transactionDate: "2026-07-27",
      rule: rule({
        id: "rule-fixed-day",
        installmentCount: 3,
        workingMode:
          "BLOCKED_FIXED_DAY",
        commissionRate: 6.5,
        firstSettlementDayCount: 45
      })
    });

  assert.equal(
    fixedDay.commissionAmount,
    650
  );

  assert.equal(
    fixedDay.netAmount,
    9350
  );

  assert.equal(
    fixedDay.schedule.length,
    1
  );

  assert.equal(
    fixedDay.expectedFinalSettlementDate,
    "2026-09-10"
  );

  const manual =
    calculatePosContractPricing({
      grossAmount: 5000,
      installmentCount: 1,
      transactionDate: "2026-07-27",
      rule: rule({
        id: "rule-manual",
        workingMode: "MANUAL",
        commissionRate: 0,
        firstSettlementDayCount: 0
      })
    });

  assert.equal(
    manual.automaticSettlement,
    false
  );

  assert.throws(
    () =>
      calculatePosContractPricing({
        grossAmount: 10000,
        installmentCount: 2,
        transactionDate: "2026-07-27",
        rule: rule()
      }),
    /POS_CONTRACT_PRICING_RULE_MISMATCH/
  );

  assert.throws(
    () =>
      calculatePosContractPricing({
        grossAmount: 10000,
        installmentCount: 3,
        transactionDate: "2026-07-27",
        rule: rule({
          installmentCount: 3,
          workingMode: "MONTHLY_BLOCKED",
          firstSettlementDayCount: 30,
          installmentIntervalDayCount: 0
        })
      }),
    /POS_CONTRACT_PRICING_INTERVAL_REQUIRED/
  );

  console.log(
    "[PASS] pos contract pricing engine"
  );
}

run();
