import assert from "node:assert/strict";

import {
  canTransitionSaleStatus,
  getAllowedSaleStatusTransitions,
  requestSaleStatusTransition
} from "../src/lib/saleStatusTransitionService";

function runAllowedTransitionTests():
void {
  assert.deepEqual(
    getAllowedSaleStatusTransitions(
      "TEKLİF"
    ),
    [
      "ONAYLANDI",
      "İPTAL"
    ]
  );

  assert.equal(
    canTransitionSaleStatus(
      "TEKLİF",
      "ONAYLANDI"
    ),
    true
  );

  assert.equal(
    canTransitionSaleStatus(
      "TEKLİF",
      "İPTAL"
    ),
    true
  );

  assert.equal(
    canTransitionSaleStatus(
      "ONAYLANDI",
      "SİPARİŞ"
    ),
    true
  );

  assert.equal(
    canTransitionSaleStatus(
      "SİPARİŞ",
      "ÜRETİME_GÖNDERİLDİ"
    ),
    true
  );

  assert.equal(
    canTransitionSaleStatus(
      "MONTAJA_GÖNDERİLDİ",
      "TAMAMLANDI"
    ),
    true
  );
}

function runForbiddenTransitionTests():
void {
  assert.deepEqual(
    getAllowedSaleStatusTransitions(
      "TASLAK"
    ),
    []
  );

  assert.equal(
    canTransitionSaleStatus(
      "ONAYLANDI",
      "İPTAL"
    ),
    false
  );

  assert.equal(
    canTransitionSaleStatus(
      "ONAYLANDI",
      "TEKLİF"
    ),
    false
  );

  assert.equal(
    canTransitionSaleStatus(
      "SİPARİŞ",
      "İPTAL"
    ),
    false
  );

  assert.equal(
    canTransitionSaleStatus(
      "TAMAMLANDI",
      "İPTAL"
    ),
    false
  );

  assert.equal(
    canTransitionSaleStatus(
      "İPTAL",
      "TEKLİF"
    ),
    false
  );
}

function runAcceptedAuditTest():
void {
  const result =
    requestSaleStatusTransition({
      saleId: "sale-1",
      fromStatus: "TEKLİF",
      toStatus: "ONAYLANDI",
      actorUserId: "user-1",
      occurredAt:
        "2026-07-30T16:00:00.000Z",
      reason:
        "Müşteri onayı alındı."
    });

  assert.equal(
    result.outcome,
    "ACCEPTED"
  );

  if (
    result.outcome ===
    "ACCEPTED"
  ) {
    assert.equal(
      result.audit.fromStatus,
      "TEKLİF"
    );

    assert.equal(
      result.audit.toStatus,
      "ONAYLANDI"
    );

    assert.equal(
      result.audit.actorUserId,
      "user-1"
    );

    assert.equal(
      result.audit.reason,
      "Müşteri onayı alındı."
    );
  }
}

function runApprovedCancellationRequiresReturnTest():
void {
  const approvedStatuses = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ] as const;

  for (
    const status of approvedStatuses
  ) {
    assert.deepEqual(
      requestSaleStatusTransition({
        saleId:
          `sale-${status}`,
        fromStatus: status,
        toStatus: "İPTAL",
        actorUserId: "user-1",
        occurredAt:
          "2026-07-30T16:10:00.000Z"
      }),
      {
        outcome: "REJECTED",
        reason:
          "APPROVED_SALE_REQUIRES_RETURN"
      }
    );
  }
}

function runDraftRejectionTests():
void {
  assert.deepEqual(
    requestSaleStatusTransition({
      saleId: "sale-draft-1",
      fromStatus: "TASLAK",
      toStatus: "TEKLİF",
      actorUserId: "user-1",
      occurredAt:
        "2026-07-30T16:20:00.000Z"
    }),
    {
      outcome: "REJECTED",
      reason:
        "LEGACY_DRAFT_STATUS_NOT_ALLOWED"
    }
  );

  assert.deepEqual(
    requestSaleStatusTransition({
      saleId: "sale-draft-2",
      fromStatus: "TEKLİF",
      toStatus: "TASLAK",
      actorUserId: "user-1",
      occurredAt:
        "2026-07-30T16:20:00.000Z"
    }),
    {
      outcome: "REJECTED",
      reason:
        "LEGACY_DRAFT_STATUS_NOT_ALLOWED"
    }
  );
}

function runValidationTests():
void {
  assert.deepEqual(
    requestSaleStatusTransition({
      saleId: "sale-3",
      fromStatus: "TEKLİF",
      toStatus: "TEKLİF",
      actorUserId: "user-1",
      occurredAt:
        "2026-07-30T16:20:00.000Z"
    }),
    {
      outcome: "REJECTED",
      reason: "SAME_STATUS"
    }
  );

  assert.deepEqual(
    requestSaleStatusTransition({
      saleId: "sale-4",
      fromStatus: "TEKLİF",
      toStatus: "ONAYLANDI",
      actorUserId: "",
      occurredAt:
        "2026-07-30T16:30:00.000Z"
    }),
    {
      outcome: "REJECTED",
      reason: "ACTOR_REQUIRED"
    }
  );

  assert.deepEqual(
    requestSaleStatusTransition({
      saleId: "sale-5",
      fromStatus: "TEKLİF",
      toStatus: "ONAYLANDI",
      actorUserId: "user-1",
      occurredAt:
        "geçersiz-tarih"
    }),
    {
      outcome: "REJECTED",
      reason:
        "OCCURRED_AT_INVALID"
    }
  );
}

function main(): void {
  runAllowedTransitionTests();
  runForbiddenTransitionTests();
  runAcceptedAuditTest();
  runApprovedCancellationRequiresReturnTest();
  runDraftRejectionTests();
  runValidationTests();

  console.log(
    "saleStatusTransitionServiceSuite: PASS"
  );
}

main();