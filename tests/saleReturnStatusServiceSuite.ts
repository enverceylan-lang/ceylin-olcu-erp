import assert from "node:assert/strict";
import {
  canTransitionSaleReturnStatus,
  getAllowedSaleReturnStatuses,
  requestSaleReturnStatusTransition
} from "../src/lib/saleReturnStatusService";

const occurredAt =
  "2026-07-31T02:00:00.000Z";

assert.deepEqual(
  getAllowedSaleReturnStatuses(
    "BAŞLATILDI"
  ),
  [
    "ONAYLANDI",
    "REDDEDİLDİ"
  ]
);

assert.deepEqual(
  getAllowedSaleReturnStatuses(
    "ONAYLANDI"
  ),
  [
    "TAMAMLANDI"
  ]
);

assert.deepEqual(
  getAllowedSaleReturnStatuses(
    "TAMAMLANDI"
  ),
  []
);

assert.deepEqual(
  getAllowedSaleReturnStatuses(
    "REDDEDİLDİ"
  ),
  []
);

assert.equal(
  canTransitionSaleReturnStatus(
    "BAŞLATILDI",
    "ONAYLANDI"
  ),
  true
);

assert.equal(
  canTransitionSaleReturnStatus(
    "BAŞLATILDI",
    "REDDEDİLDİ"
  ),
  true
);

assert.equal(
  canTransitionSaleReturnStatus(
    "ONAYLANDI",
    "TAMAMLANDI"
  ),
  true
);

assert.equal(
  canTransitionSaleReturnStatus(
    "ONAYLANDI",
    "BAŞLATILDI"
  ),
  false
);

assert.equal(
  canTransitionSaleReturnStatus(
    "TAMAMLANDI",
    "ONAYLANDI"
  ),
  false
);

assert.equal(
  canTransitionSaleReturnStatus(
    "REDDEDİLDİ",
    "BAŞLATILDI"
  ),
  false
);

const approved =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "BAŞLATILDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-1",
    occurredAt,
    reason: "Yönetici onayı"
  });

assert.equal(
  approved.outcome,
  "ACCEPTED"
);

if (approved.outcome !== "ACCEPTED") {
  throw new Error(
    "Expected accepted transition."
  );
}

assert.equal(
  approved.audit.saleReturnId,
  "return-1"
);

assert.equal(
  approved.audit.fromStatus,
  "BAŞLATILDI"
);

assert.equal(
  approved.audit.toStatus,
  "ONAYLANDI"
);

assert.equal(
  approved.audit.actorUserId,
  "user-1"
);

assert.equal(
  approved.audit.reason,
  "Yönetici onayı"
);

const replay =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "BAŞLATILDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-1",
    occurredAt,
    reason: "Yönetici onayı"
  });

assert.equal(
  replay.outcome,
  "ACCEPTED"
);

if (replay.outcome !== "ACCEPTED") {
  throw new Error(
    "Expected deterministic replay."
  );
}

assert.equal(
  replay.audit.id,
  approved.audit.id
);

const rejected =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-2",
    fromStatus: "BAŞLATILDI",
    toStatus: "REDDEDİLDİ",
    actorUserId: "user-2",
    occurredAt,
    reason: "İade koşulları oluşmadı"
  });

assert.equal(
  rejected.outcome,
  "ACCEPTED"
);

const backwards =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "ONAYLANDI",
    toStatus: "BAŞLATILDI",
    actorUserId: "user-1",
    occurredAt
  });

assert.deepEqual(
  backwards,
  {
    outcome: "REJECTED",
    reason:
      "TRANSITION_NOT_ALLOWED"
  }
);

const reopenRejected =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-2",
    fromStatus: "REDDEDİLDİ",
    toStatus: "BAŞLATILDI",
    actorUserId: "user-2",
    occurredAt
  });

assert.deepEqual(
  reopenRejected,
  {
    outcome: "REJECTED",
    reason:
      "TRANSITION_NOT_ALLOWED"
  }
);

const reopenCompleted =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-3",
    fromStatus: "TAMAMLANDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-3",
    occurredAt
  });

assert.deepEqual(
  reopenCompleted,
  {
    outcome: "REJECTED",
    reason:
      "TRANSITION_NOT_ALLOWED"
  }
);

const sameStatus =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "ONAYLANDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-1",
    occurredAt
  });

assert.deepEqual(
  sameStatus,
  {
    outcome: "REJECTED",
    reason: "SAME_STATUS"
  }
);

const noReturnId =
  requestSaleReturnStatusTransition({
    saleReturnId: " ",
    fromStatus: "BAŞLATILDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-1",
    occurredAt
  });

assert.deepEqual(
  noReturnId,
  {
    outcome: "REJECTED",
    reason: "RETURN_ID_REQUIRED"
  }
);

const noActor =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "BAŞLATILDI",
    toStatus: "ONAYLANDI",
    actorUserId: " ",
    occurredAt
  });

assert.deepEqual(
  noActor,
  {
    outcome: "REJECTED",
    reason: "ACTOR_REQUIRED"
  }
);

const invalidDate =
  requestSaleReturnStatusTransition({
    saleReturnId: "return-1",
    fromStatus: "BAŞLATILDI",
    toStatus: "ONAYLANDI",
    actorUserId: "user-1",
    occurredAt: "invalid-date"
  });

assert.deepEqual(
  invalidDate,
  {
    outcome: "REJECTED",
    reason:
      "OCCURRED_AT_INVALID"
  }
);

console.log(
  "saleReturnStatusServiceSuite: PASS"
);