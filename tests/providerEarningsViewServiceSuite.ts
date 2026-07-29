import assert from "node:assert/strict";
import {
  listProviderEarnings,
  type ProviderEarningsActor,
  type ProviderEarningsEntry,
  type ProviderEarningsLink
} from "../src/lib/providerEarningsViewService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const actor:
  ProviderEarningsActor = {
    ...scope,
    userId:
      "user-tailor-1",
    role:
      "TAILOR"
};

const link:
  ProviderEarningsLink = {
    userId:
      "user-tailor-1",

    providerCustomerId:
      "provider-cari-1",

    providerType:
      "TAILOR"
};

function entry(
  overrides:
    Partial<ProviderEarningsEntry> = {}
): ProviderEarningsEntry {
  return {
    ...scope,

    id:
      "earning-1",

    providerCustomerId:
      "provider-cari-1",

    providerType:
      "TAILOR",

    operationId:
      "operation-1",

    sourceDocumentId:
      "document-1",

    title:
      "Salon Tül Dikim İşi",

    occurredAt:
      "2026-07-29T10:00:00.000Z",

    currency:
      "TRY",

    estimatedAmount:
      1500,

    finalizedAmount:
      1200,

    paidAmount:
      400,

    status:
      "PARTIALLY_PAID",

    ...overrides
  };
}

const result =
  listProviderEarnings(
    [
      entry(),

      entry({
        id:
          "earning-2",
        operationId:
          "operation-2",
        estimatedAmount:
          500,
        finalizedAmount:
          500,
        paidAmount:
          500,
        status:
          "PAID",
        occurredAt:
          "2026-07-29T11:00:00.000Z"
      }),

      entry({
        id:
          "earning-other-provider",
        providerCustomerId:
          "provider-cari-2"
      }),

      entry({
        id:
          "earning-other-company",
        companyId:
          "company-2"
      }),

      entry({
        id:
          "earning-other-branch",
        branchId:
          "branch-2"
      }),

      entry({
        id:
          "earning-other-period",
        accountingPeriodId:
          "period-2"
      }),

      entry({
        id:
          "earning-other-tenant",
        tenantId:
          "tenant-2"
      }),

      entry({
        id:
          "earning-wrong-type",
        providerType:
          "INSTALLER"
      }),

      entry({
        id:
          "earning-cancelled",
        status:
          "CANCELLED"
      })
    ],
    actor,
    link
  );

assert.equal(
  result.entryCount,
  2
);

assert.deepEqual(
  result.entries.map(
    item =>
      item.id
  ),
  [
    "earning-2",
    "earning-1"
  ]
);

assert.equal(
  result.summaries.length,
  1
);

assert.equal(
  result.summaries[0].currency,
  "TRY"
);

assert.equal(
  result.summaries[0].estimatedAmount,
  2000
);

assert.equal(
  result.summaries[0].finalizedAmount,
  1700
);

assert.equal(
  result.summaries[0].paidAmount,
  900
);

assert.equal(
  result.summaries[0].remainingAmount,
  800
);

const multiCurrency =
  listProviderEarnings(
    [
      entry(),

      entry({
        id:
          "earning-eur",
        currency:
          "EUR",
        estimatedAmount:
          100,
        finalizedAmount:
          80,
        paidAmount:
          20
      })
    ],
    actor,
    link
  );

assert.equal(
  multiCurrency.summaries.length,
  2
);

assert.deepEqual(
  multiCurrency.summaries.map(
    summary =>
      summary.currency
  ),
  [
    "EUR",
    "TRY"
  ]
);

assert.equal(
  multiCurrency.summaries[0].remainingAmount,
  60
);

assert.equal(
  multiCurrency.summaries[1].remainingAmount,
  800
);

const missingLink =
  listProviderEarnings(
    [
      entry()
    ],
    actor
  );

assert.equal(
  missingLink.entryCount,
  0
);

assert.equal(
  missingLink.summaries.length,
  0
);

const wrongUserLink =
  listProviderEarnings(
    [
      entry()
    ],
    actor,
    {
      ...link,
      userId:
        "different-user"
    }
  );

assert.equal(
  wrongUserLink.entryCount,
  0
);

const wrongRoleLink =
  listProviderEarnings(
    [
      entry()
    ],
    actor,
    {
      ...link,
      providerType:
        "INSTALLER"
    }
  );

assert.equal(
  wrongRoleLink.entryCount,
  0
);

const invalidOverpayment =
  listProviderEarnings(
    [
      entry({
        id:
          "invalid-overpayment",
        finalizedAmount:
          100,
        paidAmount:
          101
      })
    ],
    actor,
    link
  );

assert.equal(
  invalidOverpayment.entryCount,
  0
);

const invalidNegative =
  listProviderEarnings(
    [
      entry({
        id:
          "invalid-negative",
        finalizedAmount:
          -1
      })
    ],
    actor,
    link
  );

assert.equal(
  invalidNegative.entryCount,
  0
);

const serialized =
  JSON.stringify(
    result
  );

assert.doesNotMatch(
  serialized,
  /password|token|hash|secret/
);

assert.doesNotMatch(
  serialized,
  /financeTransaction|paymentCommand|cashAccountMutation/
);

console.log(
  "PROVIDER_EARNINGS_VIEW_SERVICE_TEST: PAK"
);