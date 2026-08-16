import assert from "node:assert/strict";

import {
  decidePosServerAuthorityContract
} from "../src/lib/finance/posServerAuthorityPolicy";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const ids = {
  operation: "11111111-1111-4111-8111-111111111111",
  contract: "22222222-2222-4222-8222-222222222222",
  rule: "33333333-3333-4333-8333-333333333333",
  pos: "44444444-4444-4444-8444-444444444444",
  customerLedger: "55555555-5555-4555-8555-555555555555",
  commissionLedger: "66666666-6666-4666-8666-666666666666",
  taxLedger: "77777777-7777-4777-8777-777777777777",
  monthlyLedger: "88888888-8888-4888-8888-888888888888",
  transaction: "99999999-9999-4999-8999-999999999999",
  scheduleLine: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  settlement: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  refund: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  reversal: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};

function base(action: string) {
  return {
    ...scope,
    operationId: ids.operation,
    idempotencyKey: `idem-${action}`,
    action,
    occurredAt: "2026-08-16T08:00:00.000Z"
  };
}

const contractDecision = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("UPSERT_CONTRACT"),
      contract: {
        contractId: ids.contract,
        contractNumber: "POS-SOZ-1",
        contractName: "Garanti POS",
        posAccountId: ids.pos,
        workingMode: "ADVANCE_NET",
        monthlyFixedFeeEnabled: true,
        monthlyFixedFeeAmount: 500,
        monthlyFeeTaxRate: 20,
        currency: "TRY",
        validFrom: "2026-08-01",
        validUntil: null,
        accounts: {
          customerReceivableAccountId: ids.customerLedger,
          commissionExpenseAccountId: ids.commissionLedger,
          taxExpenseAccountId: ids.taxLedger,
          monthlyFeeExpenseAccountId: ids.monthlyLedger
        }
      }
    }
  },
  scope
);

assert.equal(contractDecision.allowed, true);
if (contractDecision.allowed) {
  assert.deepEqual(contractDecision.guard, { mode: "ADMIN" });
}

const ruleDecision = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("UPSERT_RULE"),
      rule: {
        ruleId: ids.rule,
        contractId: ids.contract,
        posAccountId: ids.pos,
        installmentCount: 3,
        workingMode: "MONTHLY_BLOCKED",
        commissionRate: 3,
        fixedTransactionFee: 100,
        taxRate: 20,
        additionalFeeRate: 0,
        firstSettlementDayCount: 30,
        installmentIntervalDayCount: 30
      }
    }
  },
  scope
);

assert.equal(ruleDecision.allowed, true);

const badInterval = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("UPSERT_RULE"),
      rule: {
        ruleId: ids.rule,
        contractId: ids.contract,
        posAccountId: ids.pos,
        installmentCount: 3,
        workingMode: "MONTHLY_BLOCKED",
        commissionRate: 3,
        fixedTransactionFee: 100,
        taxRate: 20,
        additionalFeeRate: 0,
        firstSettlementDayCount: 30,
        installmentIntervalDayCount: 0
      }
    }
  },
  scope
);

assert.equal(badInterval.allowed, false);
if (!badInterval.allowed) {
  assert.equal(badInterval.code, "POS_RULE_INTERVAL_REQUIRED");
}

const collectionDecision = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("POST_COLLECTION"),
      collection: {
        transactionId: ids.transaction,
        posTransactionNumber: "POS-2026-1",
        contractId: ids.contract,
        ruleId: ids.rule,
        posAccountId: ids.pos,
        saleId: "sale-1",
        saleNumber: "SAT-1",
        paymentId: "payment-1",
        customerId: "customer-1",
        grossAmount: 10000,
        installmentCount: 3,
        transactionDate: "2026-08-16",
        currency: "TRY",
        description: "POS tahsilatı"
      }
    }
  },
  scope
);

assert.equal(collectionDecision.allowed, true);
if (collectionDecision.allowed) {
  assert.deepEqual(collectionDecision.guard, { mode: "ADMIN" });
}

const settlementDecision = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("SETTLE_TRANSACTION"),
      settlement: {
        transactionId: ids.transaction,
        scheduleLineId: ids.scheduleLine,
        settlementId: ids.settlement,
        settlementNumber: "POS-SET-1",
        amount: 9700,
        settlementDate: "2026-08-17",
        description: null
      }
    }
  },
  scope
);

assert.equal(settlementDecision.allowed, true);
if (settlementDecision.allowed) {
  assert.deepEqual(settlementDecision.guard, { mode: "ADMIN" });
}

const archiveDecision = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("ARCHIVE_RULE"),
      archive: {
        id: ids.rule,
        reason: "Tarife kapatıldı"
      }
    }
  },
  scope
);
assert.equal(archiveDecision.allowed, true);

const scopeMismatch = decidePosServerAuthorityContract(
  {
    posCommand: {
      ...base("ARCHIVE_CONTRACT"),
      branchId: "branch-2",
      archive: {
        id: ids.contract,
        reason: "Kapat"
      }
    }
  },
  scope
);

assert.equal(scopeMismatch.allowed, false);
if (!scopeMismatch.allowed) {
  assert.equal(scopeMismatch.code, "POS_COMMAND_SCOPE_MISMATCH");
}

console.log("[PASS] pos server authority policy");
