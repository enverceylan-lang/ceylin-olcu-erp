import assert from "node:assert/strict";

import {
  getRoomPreparationLockedProductType,
  isRoomPreparationProductAllowed,
  isRoomPreparationProductLocked
} from "../src/lib/roomPreparationProductPolicy";
import type {
  MeasurementRecord
} from "../src/store/measurementStore";

function measurement(
  overrides: Partial<MeasurementRecord>
): MeasurementRecord {
  return {
    id: "measurement-1",
    customerId: "customer-1",
    roomId: "room-1",
    openingId: "opening-1",
    windowId: "opening-1",
    templateType: "CURTAIN_DETAIL",
    selectedProducts: [],
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    ...overrides
  } as MeasurementRecord;
}

const verticalTulle = measurement({
  templateType: "mechanical_curtain",
  rawValues: {
    productType: "DIKEY_TUL"
  }
});

assert.equal(
  getRoomPreparationLockedProductType(
    verticalTulle
  ),
  "DIKEY_TUL"
);

assert.equal(
  isRoomPreparationProductLocked(
    verticalTulle
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    verticalTulle,
    "DIKEY_TUL"
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    verticalTulle,
    "TUL"
  ),
  false
);

assert.equal(
  isRoomPreparationProductAllowed(
    verticalTulle,
    "STOR"
  ),
  false
);

const plicell = measurement({
  templateType: "PLICELL"
});

assert.equal(
  getRoomPreparationLockedProductType(
    plicell
  ),
  "PLICELL"
);

assert.equal(
  isRoomPreparationProductAllowed(
    plicell,
    "PLICELL"
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    plicell,
    "TUL"
  ),
  false
);

const detail = measurement({
  templateType: "CURTAIN_DETAIL"
});

assert.equal(
  isRoomPreparationProductLocked(
    detail
  ),
  false
);

assert.equal(
  isRoomPreparationProductAllowed(
    detail,
    "TUL"
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    detail,
    "FON"
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    detail,
    "STOR"
  ),
  true
);

assert.equal(
  isRoomPreparationProductAllowed(
    detail,
    "PLICELL"
  ),
  false
);

console.log(
  "roomPreparationProductPolicySuite: PASS"
);