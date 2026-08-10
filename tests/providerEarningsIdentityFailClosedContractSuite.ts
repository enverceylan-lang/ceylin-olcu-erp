import assert from "node:assert/strict";
import test from "node:test";
import type {
  OperationRecord
} from "../src/lib/operationsWorkflow";
import {
  createEstimatedEarningFromCompletedOperation
} from "../src/lib/providerCompletionEarningsBridge";
import {
  createProviderEarningsPendingDraft
} from "../src/lib/providerEarningsPendingDraftService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

function operation(
  party: OperationRecord["party"]
): OperationRecord {
  return {
    ...scope,
    id: "operation-identity-1",
    idempotencyKey: "TAILOR:sale-1:identity",
    kind: "TAILOR",
    sourceId: "sale-1",
    saleId: "sale-1",
    customerId: "customer-1",
    customerName: "Müşteri",
    title: "Terzi işi",
    details: [],
    party,
    scheduledAt: "2026-08-10T08:00:00.000Z",
    dueAt: "2026-08-10T12:00:00.000Z",
    status: "COMPLETED",
    completedAt: "2026-08-10T11:00:00.000Z",
    createdByUserId: "admin-1",
    createdAt: "2026-08-10T07:00:00.000Z",
    updatedAt: "2026-08-10T11:00:00.000Z"
  };
}

const legacyAliasParty = {
  id: "provider-cari-legacy",
  userId: "tailor-user-1",
  name: "Legacy Terzi"
};

const internalParty = {
  id: "internal-user:tailor-user-1",
  userId: "tailor-user-1",
  name: "İç Terzi",
  assignmentType: "INTERNAL" as const
};

const externalWithoutExplicitProvider = {
  id: "provider-cari-legacy",
  userId: "tailor-user-1",
  name: "Eksik Dış Terzi",
  assignmentType: "EXTERNAL" as const
};

const validExternalParty = {
  id: "provider-cari-1",
  userId: "tailor-user-1",
  name: "Dış Terzi",
  assignmentType: "EXTERNAL" as const,
  providerCustomerId: "provider-cari-1"
};

for (
  const [
    label,
    party
  ] of [
    ["legacy-alias", legacyAliasParty],
    ["internal", internalParty],
    ["external-missing-explicit-provider", externalWithoutExplicitProvider]
  ] as const
) {
  test(
    `completion bridge rejects ${label} provider identity`,
    () => {
      const result =
        createEstimatedEarningFromCompletedOperation({
          state: {
            entries: [],
            paymentSnapshots: []
          },
          operation: operation(party),
          earningsEntryId: `earning:${label}`,
          currency: "TRY",
          estimatedAmount: 100
        });

      assert.equal(result.outcome, "REJECTED");

      if (result.outcome === "REJECTED") {
        assert.equal(
          result.reason,
          "PROVIDER_NOT_ASSIGNED"
        );
      }
    }
  );

  test(
    `pending draft rejects ${label} provider identity`,
    () => {
      const result =
        createProviderEarningsPendingDraft({
          state: {
            drafts: []
          },
          operation: operation(party),
          draftId: `draft:${label}`,
          currency: "TRY",
          occurredAt: "2026-08-10T11:00:00.000Z"
        });

      assert.equal(result.outcome, "REJECTED");

      if (result.outcome === "REJECTED") {
        assert.equal(
          result.reason,
          "PROVIDER_NOT_ASSIGNED"
        );
      }
    }
  );
}

test(
  "both provider earning boundaries accept explicit EXTERNAL provider identity",
  () => {
    const completed =
      createEstimatedEarningFromCompletedOperation({
        state: {
          entries: [],
          paymentSnapshots: []
        },
        operation: operation(validExternalParty),
        earningsEntryId: "earning:valid",
        currency: "TRY",
        estimatedAmount: 100
      });

    assert.equal(completed.outcome, "CREATED");

    const draft =
      createProviderEarningsPendingDraft({
        state: {
          drafts: []
        },
        operation: operation(validExternalParty),
        draftId: "draft:valid",
        currency: "TRY",
        occurredAt: "2026-08-10T11:00:00.000Z"
      });

    assert.equal(draft.outcome, "CREATED");
  }
);

test(
  "provider earning boundaries contain no party.id provider-cari recovery",
  async () => {
    const fs = await import("node:fs/promises");

    for (
      const relativePath of [
        "src/lib/providerCompletionEarningsBridge.ts",
        "src/lib/providerEarningsPendingDraftService.ts"
      ]
    ) {
      const text = await fs.readFile(
        new URL(`../${relativePath}`, import.meta.url),
        "utf8"
      );

      assert.doesNotMatch(
        text,
        /providerCustomerId[\s\S]{0,120}operation\.party\?\.id/
      );

      assert.match(
        text,
        /operation\.party[\s\S]{0,120}\?\.providerCustomerId[\s\S]{0,120}\?\.trim\(\)/
      );

      assert.match(
        text,
        /operation\.party[\s\S]{0,120}\?\.assignmentType\s*!==\s*"EXTERNAL"/
      );
    }
  }
);