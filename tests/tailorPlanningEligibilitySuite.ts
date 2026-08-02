import assert from "node:assert/strict";
import {
  shouldPublishTailorPlanning
} from "../src/lib/tailorPlanningEligibility";

assert.equal(
  shouldPublishTailorPlanning(
    "TASLAK"
  ),
  false
);

assert.equal(
  shouldPublishTailorPlanning(
    "TEKLİF"
  ),
  false
);

assert.equal(
  shouldPublishTailorPlanning(
    "ONAYLANDI"
  ),
  true
);

assert.equal(
  shouldPublishTailorPlanning(
    "SİPARİŞ"
  ),
  true
);

assert.equal(
  shouldPublishTailorPlanning(
    "ÜRETİME_GÖNDERİLDİ"
  ),
  true
);

assert.equal(
  shouldPublishTailorPlanning(
    "İPTAL"
  ),
  false
);

console.log(
  "[PASS] draftAndOfferDoNotReachTailor"
);
console.log(
  "[PASS] approvedSaleReachesTailorPlanningEarly"
);
console.log(
  "[PASS] orderAndProductionStatusesRemainEligible"
);
console.log(
  "[PASS] tailorPlanningEligibilitySuite completed"
);