import assert from "node:assert/strict";
import test from "node:test";
import {
  readFile
} from "node:fs/promises";

import {
  recalculateConfiguredHeightCalculation
} from "../src/lib/configuredHeightCalculationService";

test(
  "segmented STOR custom part height recalculates m2 from same central engine",
  () => {
    const result =
      recalculateConfiguredHeightCalculation({
        productType: "STOR",
        rawValues: {
          kalORiferMermerBoyuCm: 200
        },
        userOverrides: {
          partHeightOverrides: {
            "mechanical-part-1": {
              mode: "CUSTOM",
              customHeightCm: 210
            },
            "mechanical-part-2": {
              mode: "CUSTOM",
              customHeightCm: 270
            }
          }
        },
        calculation: {
          productType: "STOR",
          isSegmented: true,
          groups: [
            {
              generatedItemId:
                "mechanical-part-1",
              groupType:
                "CAM_PENCERE",
              realWidthCm: 200,
              realHeightCm: 200,
              calculatedWidthCm: 200,
              calculatedHeightCm: 200,
              quantity: 1,
              unitM2: 4,
              totalM2: 4
            },
            {
              generatedItemId:
                "mechanical-part-2",
              groupType:
                "KAPI",
              realWidthCm: 100,
              realHeightCm: 270,
              calculatedWidthCm: 100,
              calculatedHeightCm: 270,
              quantity: 1,
              unitM2: 2.7,
              totalM2: 2.7
            }
          ],
          totalM2: 6.7,
          salesItems: [
            {
              id: "old-1",
              unit: "m2",
              quantity: 4,
              totalM2: 4
            },
            {
              id: "old-2",
              unit: "m2",
              quantity: 2.7,
              totalM2: 2.7
            }
          ]
        }
      });

    const groups =
      result.groups as Array<
        Record<string, unknown>
      >;

    assert.equal(
      groups[0].realHeightCm,
      210
    );

    assert.equal(
      groups[0].billingHeightCm,
      210
    );

    assert.equal(
      groups[0].totalM2,
      4.2
    );

    assert.equal(
      groups[1].realHeightCm,
      270
    );

    assert.equal(
      groups[1].totalM2,
      2.7
    );

    assert.equal(
      result.totalM2,
      6.9
    );

    const salesItems =
      result.salesItems as Array<
        Record<string, unknown>
      >;

    assert.equal(
      salesItems[0].totalM2,
      4.2
    );

    assert.equal(
      salesItems[0].realHeightCm,
      210
    );
  }
);

for (
  const productType of [
    "ZEBRA",
    "AHSAP_JALUZI",
    "JALUZI",
    "PICASSO"
  ]
) {
  test(
    `${productType} uses same mechanical height recalculation`,
    () => {
      const result =
        recalculateConfiguredHeightCalculation({
          productType,
          rawValues: {},
          userOverrides: {
            heightMode: "CUSTOM",
            customHeightCm: 210
          },
          calculation: {
            productType,
            realWidthCm: 200,
            realHeightCm: 200,
            totalM2: 4,
            salesItems: [
              {
                id: "main",
                unit: "m2",
                quantity: 4,
                totalM2: 4
              }
            ]
          }
        });

      assert.equal(
        result.realHeightCm,
        210
      );

      assert.equal(
        result.totalM2,
        4.2
      );
    }
  );
}

test(
  "segmented STOR measurement-source door height overrides marble fallback",
  () => {
    const result =
      recalculateConfiguredHeightCalculation({
        productType: "STOR",
        rawValues: {
          kaloriferMermerBoyuCm: 200,
          sagYukseklikCm: 265
        },
        userOverrides: {
          partHeightOverrides: {
            "mechanical-part-2": {
              mode: "MEASUREMENT",
              source: "sagYukseklikCm"
            }
          }
        },
        calculation: {
          productType: "STOR",
          isSegmented: true,
          groups: [
            {
              generatedItemId:
                "mechanical-part-1",
              groupType:
                "CAM_PENCERE",
              realWidthCm: 200,
              realHeightCm: 200,
              calculatedWidthCm: 200,
              calculatedHeightCm: 200,
              quantity: 1,
              unitM2: 4,
              totalM2: 4
            },
            {
              generatedItemId:
                "mechanical-part-2",
              groupType:
                "KAPI",
              realWidthCm: 100,
              realHeightCm: 200,
              calculatedWidthCm: 100,
              calculatedHeightCm: 200,
              quantity: 1,
              unitM2: 2,
              totalM2: 2
            }
          ],
          totalM2: 6
        }
      });

    const groups =
      result.groups as Array<
        Record<string, unknown>
      >;

    assert.equal(
      groups[0].realHeightCm,
      200
    );

    assert.equal(
      groups[1].realHeightCm,
      265
    );

    assert.equal(
      groups[1].billingHeightCm,
      270
    );

    assert.equal(
      groups[1].totalM2,
      2.7
    );
  }
);
test(
  "measurement-source height selection uses raw measurement field",
  () => {
    const result =
      recalculateConfiguredHeightCalculation({
        productType: "STOR",
        rawValues: {
          solBoyuCm: 265
        },
        userOverrides: {
          heightMode: "MEASUREMENT",
          heightSource: "solBoyuCm"
        },
        calculation: {
          productType: "STOR",
          realWidthCm: 200,
          realHeightCm: 200,
          totalM2: 4,
          salesItems: [
            {
              id: "main",
              unit: "m2",
              quantity: 4,
              totalM2: 4
            }
          ]
        }
      });

    assert.equal(
      result.realHeightCm,
      265
    );

    assert.equal(
      result.billingHeightCm,
      270
    );

    assert.equal(
      result.totalM2,
      5.4
    );
  }
);

test(
  "TUL custom height updates final and cutting height without changing meter quantity",
  () => {
    const result =
      recalculateConfiguredHeightCalculation({
        productType: "TUL",
        rawValues: {},
        userOverrides: {
          heightMode: "CUSTOM",
          customHeightCm: 265
        },
        calculation: {
          productType: "TUL",
          realHeightCm: 270,
          fabricUsageMeters: 6.2,
          salesItems: [
            {
              id: "tul-main",
              unit: "mt",
              quantity: 6.2,
              fabricMeters: 6.2,
              realHeightCm: 270,
              productionHeightCm: 265
            }
          ]
        }
      });

    assert.equal(
      result.realHeightCm,
      265
    );

    assert.equal(
      result.productionHeightCm,
      260
    );

    const items =
      result.salesItems as Array<
        Record<string, unknown>
      >;

    assert.equal(
      items[0].quantity,
      6.2
    );

    assert.equal(
      items[0].realHeightCm,
      265
    );

    assert.equal(
      items[0].productionHeightCm,
      260
    );
  }
);

test(
  "PLICELL remains outside generic configured-height bridge",
  () => {
    const original = {
      productType: "PLICELL",
      realHeightCm: 93,
      totalM2: 1
    };

    const result =
      recalculateConfiguredHeightCalculation({
        productType: "PLICELL",
        rawValues: {},
        userOverrides: {
          heightMode: "CUSTOM",
          customHeightCm: 210
        },
        calculation: original
      });

    assert.deepEqual(
      result,
      original
    );
  }
);

test(
  "Room Preparation writes recalculated calculation before report and sales consumers read it",
  async () => {
    const roomPreparation =
      await readFile(
        "src/components/reports/RoomPreparationModal.tsx",
        "utf8"
      );

    const visualReport =
      await readFile(
        "src/components/reports/MeasurementVisualReport.tsx",
        "utf8"
      );

    const whatsappFormatter =
      await readFile(
        "src/lib/reportFormatters.ts",
        "utf8"
      );

    const salesAdapter =
      await readFile(
        "src/lib/salesAdapter.ts",
        "utf8"
      );

    assert.match(
      roomPreparation,
      /recalculateConfiguredHeightCalculation/
    );

    assert.match(
      visualReport,
      /getStoredProductCalculation/
    );

    assert.match(
      visualReport,
      /buildWhatsAppShortReport/
    );

    assert.match(
      whatsappFormatter,
      /getStoredProductCalculation/
    );

    assert.match(
      salesAdapter,
      /buildSaleCalculationLines/
    );
  }
);