import assert from "node:assert/strict";

import {
  canTransitionSaleStatus,
  getAllowedSaleStatusTransitions,
  requestSaleStatusTransition
} from "../src/lib/saleStatusTransitionService";

assert.deepEqual(
  getAllowedSaleStatusTransitions(
    "TASLAK"
  ),
  [
    "ONAYLANDI",
    "İPTAL"
  ]
);

assert.equal(
  canTransitionSaleStatus(
    "TASLAK",
    "ONAYLANDI"
  ),
  true
);

assert.equal(
  canTransitionSaleStatus(
    "TASLAK",
    "İPTAL"
  ),
  true
);

assert.equal(
  canTransitionSaleStatus(
    "TASLAK",
    "TEKLİF"
  ),
  false
);

/*
 * Legacy TEKLİF kayıtları desteklenir;
 * yeni normal iş akışı TASLAK'tır.
 */
assert.equal(
  canTransitionSaleStatus(
    "TEKLİF",
    "ONAYLANDI"
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

assert.equal(
  canTransitionSaleStatus(
    "ONAYLANDI",
    "İPTAL"
  ),
  false
);

const approved =
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "TASLAK",
    toStatus: "ONAYLANDI",
    actorUserId: "admin-1",
    occurredAt:
      "2026-08-02T12:00:00.000Z",
    reason:
      "Yetkili onayı"
  });

assert.equal(
  approved.outcome,
  "ACCEPTED"
);

if (
  approved.outcome !==
  "ACCEPTED"
) {
  throw new Error(
    "TASLAK -> ONAYLANDI kabul edilmedi."
  );
}

assert.equal(
  approved.audit.actorUserId,
  "admin-1"
);

assert.equal(
  approved.audit.fromStatus,
  "TASLAK"
);

assert.equal(
  approved.audit.toStatus,
  "ONAYLANDI"
);

assert.equal(
  approved.audit.reason,
  "Yetkili onayı"
);

assert.deepEqual(
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "TASLAK",
    toStatus: "ONAYLANDI",
    actorUserId: " ",
    occurredAt:
      "2026-08-02T12:00:00.000Z"
  }),
  {
    outcome: "REJECTED",
    reason: "ACTOR_REQUIRED"
  }
);

assert.deepEqual(
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "TASLAK",
    toStatus: "ONAYLANDI",
    actorUserId: "admin-1",
    occurredAt: "invalid-date"
  }),
  {
    outcome: "REJECTED",
    reason: "OCCURRED_AT_INVALID"
  }
);

assert.deepEqual(
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "TASLAK",
    toStatus: "TASLAK",
    actorUserId: "admin-1",
    occurredAt:
      "2026-08-02T12:00:00.000Z"
  }),
  {
    outcome: "REJECTED",
    reason: "SAME_STATUS"
  }
);

assert.deepEqual(
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "ONAYLANDI",
    toStatus: "İPTAL",
    actorUserId: "admin-1",
    occurredAt:
      "2026-08-02T12:00:00.000Z"
  }),
  {
    outcome: "REJECTED",
    reason:
      "APPROVED_SALE_REQUIRES_RETURN"
  }
);

assert.deepEqual(
  requestSaleStatusTransition({
    saleId: "sale-1",
    fromStatus: "TASLAK",
    toStatus: "SİPARİŞ",
    actorUserId: "admin-1",
    occurredAt:
      "2026-08-02T12:00:00.000Z"
  }),
  {
    outcome: "REJECTED",
    reason:
      "TRANSITION_NOT_ALLOWED"
  }
);

console.log(
  "saleStatusTransitionServiceSuite: PASS"
);