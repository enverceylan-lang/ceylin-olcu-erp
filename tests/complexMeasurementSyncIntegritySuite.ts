import assert from "node:assert/strict";

import {
  mergeMeasurementForSync,
  type MeasurementRecord,
} from "../src/store/measurementStore";

function baseMeasurement(
  overrides: Partial<MeasurementRecord> = {},
): MeasurementRecord {
  return {
    id: "measurement-1",
    customerId: "customer-1",
    roomId: "room-1",
    openingId: "opening-1",
    windowId: "opening-1",
    roomName: "SALON",
    openingName: "BALKON",
    templateType: "PLICELL",
    rawValues: {},
    notes: "",
    status: "MEASURED",
    measuredBy: "TEST",
    measuredDate: "2026-07-31T00:00:00.000Z",
    notesHistory: [],
    photos: [],
    videos: [],
    version: 1,
    ...overrides,
  };
}

function normalizeSignaturePart(
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .replaceAll("|", "%7C")
    .replaceAll("~", "%7E");
}

function buildArraySignature(
  value: unknown,
  keys: string[],
): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        return "!INVALID";
      }

      const record =
        item as Record<string, unknown>;

      return keys
        .map((key) =>
          normalizeSignaturePart(
            record[key],
          ),
        )
        .join("|");
    })
    .join("~");
}

function fullIntegrity(
  measurement: MeasurementRecord,
): NonNullable<MeasurementRecord["syncIntegrity"]> {
  const rawValues =
    measurement.rawValues || {};

  const facadeSegments =
    rawValues.facadeSegments;

  const plicellCamListesi =
    rawValues.plicellCamListesi;

  const selectedProducts =
    measurement.selectedProducts;

  return {
    schemaVersion: 2,
    completeness: "FULL",
    facadeSegmentCount:
      Array.isArray(facadeSegments)
        ? facadeSegments.length
        : 0,
    plicellGlassCount:
      Array.isArray(plicellCamListesi)
        ? plicellCamListesi.length
        : 0,
    selectedProductCount:
      Array.isArray(selectedProducts)
        ? selectedProducts.length
        : 0,
    facadeShapeSignature:
      buildArraySignature(
        facadeSegments,
        ["id", "type", "widthCm"],
      ),
    plicellShapeSignature:
      buildArraySignature(
        plicellCamListesi,
        [
          "id",
          "widthCm",
          "heightCm",
          "sourceMode",
        ],
      ),
    selectedProductSignature:
      buildArraySignature(
        selectedProducts,
        ["productType", "isActive"],
      ),
  };
}

const existingPlicell = baseMeasurement({
  rawValues: {
    camAdedi: 8,
    ortakCamBoyuCm: 170,
    profilRengi: "BEYAZ",
    plicellCamListesi: [
      { id: "p1", widthCm: "40", heightCm: 150, sourceMode: "PIECE_BASED" },
      { id: "p2", widthCm: "41", heightCm: 151, sourceMode: "PIECE_BASED" },
      { id: "p3", widthCm: "42", heightCm: 152, sourceMode: "PIECE_BASED" },
      { id: "c1", widthCm: "50", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
      { id: "c2", widthCm: "51", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
      { id: "c3", widthCm: "52", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
      { id: "c4", widthCm: "53", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
      { id: "c5", widthCm: "54", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
    ],
  },
});

const partialPlicell = baseMeasurement({
  rawValues: {
    camAdedi: 2,
    plicellCamListesi: [
      { id: "p1", widthCm: "45", heightCm: 155, sourceMode: "PIECE_BASED" },
      { id: "p2", widthCm: "46", heightCm: 156, sourceMode: "PIECE_BASED" },
    ],
  },
  updatedAt: "2026-07-31T01:00:00.000Z",
});

const protectedPlicell =
  mergeMeasurementForSync(
    existingPlicell,
    partialPlicell,
  );

assert.equal(
  protectedPlicell.rawValues
    .plicellCamListesi.length,
  8,
);

assert.equal(
  protectedPlicell.rawValues
    .ortakCamBoyuCm,
  170,
);

const intentionalReducedPlicell =
  baseMeasurement({
    rawValues: {
      camAdedi: 5,
      ortakCamBoyuCm: 175,
      profilRengi: "GRİ",
      plicellCamListesi: [
        { id: "n1", widthCm: "60", heightCm: 175, sourceMode: "COMMON_HEIGHT" },
        { id: "n2", widthCm: "61", heightCm: 175, sourceMode: "COMMON_HEIGHT" },
        { id: "n3", widthCm: "62", heightCm: 175, sourceMode: "COMMON_HEIGHT" },
        { id: "n4", widthCm: "63", heightCm: 175, sourceMode: "COMMON_HEIGHT" },
        { id: "n5", widthCm: "64", heightCm: 175, sourceMode: "COMMON_HEIGHT" },
      ],
    },
    updatedAt: "2026-07-31T02:00:00.000Z",
  });

intentionalReducedPlicell.syncIntegrity =
  fullIntegrity(intentionalReducedPlicell);

const acceptedReducedPlicell =
  mergeMeasurementForSync(
    existingPlicell,
    intentionalReducedPlicell,
  );

assert.equal(
  acceptedReducedPlicell.rawValues
    .plicellCamListesi.length,
  5,
);

const existingFacade = baseMeasurement({
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [
      { id: "s1", widthCm: 100, type: "WINDOW" },
      { id: "s2", widthCm: 80, type: "DOOR" },
      { id: "s3", widthCm: 120, type: "WINDOW" },
    ],
    totalFacadeWidthCm: 300,
    solYukseklikCm: 250,
    ortaYukseklikCm: 248,
    sagYukseklikCm: 247,
  },
});

const partialFacade = baseMeasurement({
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [
      { id: "s1", widthCm: 101, type: "WINDOW" },
    ],
  },
});

const protectedFacade =
  mergeMeasurementForSync(
    existingFacade,
    partialFacade,
  );

assert.equal(
  protectedFacade.rawValues
    .facadeSegments.length,
  3,
);

assert.equal(
  protectedFacade.rawValues
    .sagYukseklikCm,
  247,
);

const existingSelected = baseMeasurement({
  selectedProducts: [
    {
      productType: "Stor Perde",
      isActive: true,
      userOverrides: {
        chainDirection: "RIGHT",
      },
    },
    {
      productType: "Güneşlik",
      isActive: true,
    },
  ],
});

const partialSelected = baseMeasurement({
  selectedProducts: [],
});

const protectedSelected =
  mergeMeasurementForSync(
    existingSelected,
    partialSelected,
  );

assert.equal(
  protectedSelected.selectedProducts?.length,
  2,
);


const sameCountBrokenPlicell =
  baseMeasurement({
    rawValues: {
      camAdedi: 8,
      plicellCamListesi: [
        { id: "dup", widthCm: "40", heightCm: 150, sourceMode: "PIECE_BASED" },
        { id: "dup", widthCm: "", heightCm: 151, sourceMode: "PIECE_BASED" },
        { id: "p3", widthCm: "42", heightCm: 0, sourceMode: "PIECE_BASED" },
        { id: "c1", widthCm: "50", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c2", widthCm: "51", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c3", widthCm: "52", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c4", widthCm: "53", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c5", widthCm: "54", heightCm: 170, sourceMode: "BROKEN" },
      ],
    },
  });

sameCountBrokenPlicell.syncIntegrity =
  fullIntegrity(sameCountBrokenPlicell);

const protectedSameCountPlicell =
  mergeMeasurementForSync(
    existingPlicell,
    sameCountBrokenPlicell,
  );

assert.equal(
  protectedSameCountPlicell.rawValues
    .plicellCamListesi[0].id,
  "p1",
);

assert.equal(
  protectedSameCountPlicell.rawValues
    .plicellCamListesi.length,
  8,
);

const sameCountBrokenFacade =
  baseMeasurement({
    templateType: "CURTAIN_DETAIL",
    rawValues: {
      facadeSegments: [
        { id: "s1", widthCm: 100, type: "WINDOW" },
        { id: "s1", widthCm: 0, type: "DOOR" },
        { id: "", widthCm: 120, type: "WINDOW" },
      ],
    },
  });

sameCountBrokenFacade.syncIntegrity =
  fullIntegrity(sameCountBrokenFacade);

const protectedSameCountFacade =
  mergeMeasurementForSync(
    existingFacade,
    sameCountBrokenFacade,
  );

assert.equal(
  protectedSameCountFacade.rawValues
    .facadeSegments[1].id,
  "s2",
);

const signatureMismatchPlicell =
  baseMeasurement({
    rawValues: {
      camAdedi: 8,
      plicellCamListesi: [
        { id: "p1", widthCm: "40", heightCm: 150, sourceMode: "PIECE_BASED" },
        { id: "p2", widthCm: "41", heightCm: 151, sourceMode: "PIECE_BASED" },
        { id: "p3", widthCm: "42", heightCm: 152, sourceMode: "PIECE_BASED" },
        { id: "c1", widthCm: "50", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c2", widthCm: "51", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c3", widthCm: "52", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c4", widthCm: "53", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
        { id: "c5", widthCm: "999", heightCm: 170, sourceMode: "COMMON_HEIGHT" },
      ],
    },
  });

signatureMismatchPlicell.syncIntegrity =
  fullIntegrity(existingPlicell);

const protectedSignatureMismatch =
  mergeMeasurementForSync(
    existingPlicell,
    signatureMismatchPlicell,
  );

assert.equal(
  protectedSignatureMismatch.rawValues
    .plicellCamListesi[7].widthCm,
  "54",
);
console.log(
  "[PASS] partialPlicellCannotShrinkFullMeasurement",
);
console.log(
  "[PASS] verifiedFullPlicellCanApplyIntentionalReduction",
);
console.log(
  "[PASS] partialFacadeCannotShrinkSegments",
);
console.log(
  "[PASS] partialSelectedProductsCannotEraseProducts",
);
console.log(
  "[PASS] sameCountBrokenPlicellCannotReplaceFullList",
);
console.log(
  "[PASS] sameCountBrokenFacadeCannotReplaceFullSegments",
);
console.log(
  "[PASS] signatureMismatchCannotReplaceFullMeasurement",
);
console.log(
  "[PASS] complexMeasurementSyncIntegritySuite completed",
);