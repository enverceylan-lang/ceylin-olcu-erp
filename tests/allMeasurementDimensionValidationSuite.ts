import {
  validateMeasurementRecord,
  validateCustomerMeasurementExit,
} from "../src/lib/measurementValidationEngine";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasCode(
  issues: ReturnType<typeof validateMeasurementRecord>,
  code: string,
): boolean {
  return issues.some(issue => issue.code === code);
}

// DETAIL
const detailWidthOnly = validateMeasurementRecord({
  id: "detail-width-only",
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ widthCm: 350 }],
  },
});

assert(
  hasCode(detailWidthOnly, "OLC-VAL-002"),
  "Detay: EN var, BOY yok reddedilmeli",
);
console.log("[PASS] detailWidthOnlyRejected");

const detailHeightOnly = validateMeasurementRecord({
  id: "detail-height-only",
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    solYukseklikCm: 275,
  },
});

assert(
  hasCode(detailHeightOnly, "OLC-VAL-001"),
  "Detay: BOY var, EN yok reddedilmeli",
);
console.log("[PASS] detailHeightOnlyRejected");

const detailValid = validateMeasurementRecord({
  id: "detail-valid",
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ widthCm: 350 }],
    ortaYukseklikCm: 274,
  },
});

assert(
  detailValid.length === 0,
  "Detay: EN + en az bir boy geçmeli",
);
console.log("[PASS] detailWidthAndOneHeightAccepted");

// SIMPLE
const simpleWidthOnly = validateMeasurementRecord({
  id: "simple-width-only",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: {
    width: 250,
    height: 0,
  },
});

assert(
  hasCode(simpleWidthOnly, "OLC-VAL-004"),
  "Basit: EN var, BOY yok reddedilmeli",
);
console.log("[PASS] simpleWidthOnlyRejected");

const simpleHeightOnly = validateMeasurementRecord({
  id: "simple-height-only",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: {
    width: 0,
    height: 260,
  },
});

assert(
  hasCode(simpleHeightOnly, "OLC-VAL-003"),
  "Basit: BOY var, EN yok reddedilmeli",
);
console.log("[PASS] simpleHeightOnlyRejected");

// MECHANICAL
const mechanicalWidthOnly = validateMeasurementRecord({
  id: "mechanical-width-only",
  templateType: "mechanical_curtain",
  rawValues: {
    width: 160,
    height: 0,
  },
});

assert(
  hasCode(mechanicalWidthOnly, "OLC-VAL-004"),
  "Mekanik: EN var, BOY yok reddedilmeli",
);
console.log("[PASS] mechanicalWidthOnlyRejected");

const mechanicalHeightOnly = validateMeasurementRecord({
  id: "mechanical-height-only",
  templateType: "mechanical_curtain",
  rawValues: {
    width: 0,
    height: 200,
  },
});

assert(
  hasCode(mechanicalHeightOnly, "OLC-VAL-003"),
  "Mekanik: BOY var, EN yok reddedilmeli",
);
console.log("[PASS] mechanicalHeightOnlyRejected");

// PLICELL SINGLE
const plicellWidthOnly = validateMeasurementRecord({
  id: "plicell-width-only",
  templateType: "PLICELL",
  rawValues: {
    glassWidth: 54,
    glassHeight: 0,
  },
});

assert(
  hasCode(plicellWidthOnly, "OLC-VAL-004"),
  "Plicell: EN var, BOY yok reddedilmeli",
);
console.log("[PASS] plicellWidthOnlyRejected");

const plicellHeightOnly = validateMeasurementRecord({
  id: "plicell-height-only",
  templateType: "PLICELL",
  rawValues: {
    glassWidth: 0,
    glassHeight: 93,
  },
});

assert(
  hasCode(plicellHeightOnly, "OLC-VAL-003"),
  "Plicell: BOY var, EN yok reddedilmeli",
);
console.log("[PASS] plicellHeightOnlyRejected");

// PLICELL LIST
const plicellListMissingWidth = validateMeasurementRecord({
  id: "plicell-list-missing-width",
  templateType: "PLICELL",
  rawValues: {
    ortakCamBoyuCm: 100,
    plicellCamListesi: [
      { widthCm: 60, heightCm: 100 },
      { widthCm: 0, heightCm: 100 },
    ],
  },
});

assert(
  hasCode(plicellListMissingWidth, "OLC-VAL-003"),
  "Plicell liste: bir camın eni yoksa reddedilmeli",
);
console.log("[PASS] plicellListMissingWidthRejected");

const plicellListMissingHeight = validateMeasurementRecord({
  id: "plicell-list-missing-height",
  templateType: "PLICELL",
  rawValues: {
    plicellCamListesi: [
      { widthCm: 60, heightCm: 100 },
      { widthCm: 55, heightCm: 0 },
    ],
  },
});

assert(
  hasCode(plicellListMissingHeight, "OLC-VAL-004"),
  "Plicell liste: ortak boy yok ve bir cam boyu yoksa reddedilmeli",
);
console.log("[PASS] plicellListMissingHeightRejected");

const plicellListValid = validateMeasurementRecord({
  id: "plicell-list-valid",
  templateType: "PLICELL",
  rawValues: {
    ortakCamBoyuCm: 100,
    plicellCamListesi: [
      { widthCm: 60, heightCm: 0 },
      { widthCm: 55, heightCm: 0 },
    ],
  },
});

assert(
  plicellListValid.length === 0,
  "Plicell liste: tüm enler + ortak boy geçmeli",
);
console.log("[PASS] plicellListWithCommonHeightAccepted");

// CUSTOMER PASSPORT MUST REUSE SAME RULE
const customerWithMechanicalWidthOnly =
  validateCustomerMeasurementExit(
    {
      rooms: [
        {
          id: "r1",
          name: "Salon",
          windows: [
            {
              id: "w1",
              name: "Pencere",
              products: [
                {
                  id: "m1",
                  templateType: "mechanical_curtain",
                  rawValues: {
                    width: 160,
                    height: 0,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    "SOURCE_EXIT",
  );

assert(
  !customerWithMechanicalWidthOnly.valid,
  "CUSTOMER pasaportu EN var BOY yok mekanik ölçüyü durdurmalı",
);

assert(
  customerWithMechanicalWidthOnly.issues.some(
    issue => issue.code === "OLC-VAL-004",
  ),
  "CUSTOMER pasaportunda eksik BOY kodu bekleniyor",
);

console.log("[PASS] customerPassportReusesDimensionRule");

console.log(
  "[PASS] allMeasurementDimensionValidationSuite completed",
);