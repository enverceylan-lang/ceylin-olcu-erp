import assert from "node:assert/strict";
import type {
  SaleCutRequirementPlanResult
} from "../src/lib/saleCutRequirementPlan";
import type {
  StoreCutLot
} from "../src/lib/storeCutPlanning";
import {
  optimizeSaleCutRequirementPlan
} from "../src/lib/saleCutOptimizerAdapter";

const plan:
  SaleCutRequirementPlanResult = {
    outcome: "READY",
    saleId: "sale-1",
    totalMeters: 20,
    requirements: [
      {
        stockItemId: "stock-bambu",
        productType: "Bambu Tül",
        totalMeters: 20,
        pieces: [
          {
            id: "piece-1",
            saleId: "sale-1",
            saleItemId: "item-1",
            parentSaleItemId: "parent-item-1",
            measurementId: "m-1",
            stockItemId: "stock-bambu",
            roomName: "Salon",
            openingName: "1. Cam",
            productType: "Bambu Tül",
            requiredMeters: 12
          },
          {
            id: "piece-2",
            saleId: "sale-1",
            saleItemId: "item-2",
            parentSaleItemId: "parent-item-1",
            measurementId: "m-2",
            stockItemId: "stock-bambu",
            roomName: "Salon",
            openingName: "2. Cam",
            productType: "Bambu Tül",
            requiredMeters: 8
          }
        ]
      }
    ]
  };

const lots: StoreCutLot[] = [
  {
    id: "lot-12",
    stockItemId: "stock-bambu",
    onHandMeters: 12,
    reservedMeters: 0,
    lotCode: "L1",
    colorTone: "A",
    patternCode: "P1"
  },
  {
    id: "lot-8",
    stockItemId: "stock-bambu",
    onHandMeters: 8,
    reservedMeters: 0,
    lotCode: "L1",
    colorTone: "A",
    patternCode: "P1"
  },
  {
    id: "lot-40",
    stockItemId: "stock-bambu",
    onHandMeters: 40,
    reservedMeters: 0,
    lotCode: "L2",
    colorTone: "A",
    patternCode: "P1"
  }
];

const optimized =
  optimizeSaleCutRequirementPlan(
    plan,
    lots,
    {
      "stock-bambu": {
        continuity:
          "SINGLE_PIECE_REQUIRED",
        requiredColorTone: "A",
        requiredPatternCode: "P1"
      }
    }
  );

assert.equal(
  optimized.outcome,
  "READY"
);

if (
  optimized.outcome === "READY"
) {
  assert.equal(
    optimized.totalMeters,
    20
  );

  assert.equal(
    optimized.missingMeters,
    0
  );

  const pieces =
    optimized.stockRequirements[0]
      .pieces;

  assert.equal(
    pieces.length,
    2
  );

  assert.deepEqual(
    pieces.map(
      piece => [
        piece.openingName,
        piece.requiredMeters
      ]
    ),
    [
      ["1. Cam", 12],
      ["2. Cam", 8]
    ]
  );

  assert.ok(
    pieces.every(
      piece =>
        piece.suggestions.length > 0
    )
  );

  assert.ok(
    pieces[0].suggestions.some(
      suggestion =>
        suggestion.lotIds.includes(
          "lot-12"
        )
    )
  );

  assert.ok(
    pieces[1].suggestions.some(
      suggestion =>
        suggestion.lotIds.includes(
          "lot-8"
        )
    )
  );
}

const insufficient =
  optimizeSaleCutRequirementPlan(
    plan,
    [
      {
        id: "lot-10",
        stockItemId: "stock-bambu",
        onHandMeters: 10,
        reservedMeters: 0
      }
    ]
  );

assert.equal(
  insufficient.outcome,
  "READY"
);

if (
  insufficient.outcome === "READY"
) {
  assert.equal(
    insufficient.missingMeters,
    12
  );

  assert.equal(
    insufficient
      .stockRequirements[0]
      .fullyCovered,
    false
  );
}

const multiPiece =
  optimizeSaleCutRequirementPlan(
    plan,
    [
      {
        id: "lot-6-a",
        stockItemId: "stock-bambu",
        onHandMeters: 6,
        reservedMeters: 0
      },
      {
        id: "lot-6-b",
        stockItemId: "stock-bambu",
        onHandMeters: 6,
        reservedMeters: 0
      },
      {
        id: "lot-8",
        stockItemId: "stock-bambu",
        onHandMeters: 8,
        reservedMeters: 0
      }
    ],
    {
      "stock-bambu": {
        continuity:
          "MULTI_PIECE_ALLOWED"
      }
    }
  );

assert.equal(
  multiPiece.outcome,
  "READY"
);

if (
  multiPiece.outcome === "READY"
) {
  assert.equal(
    multiPiece.missingMeters,
    0
  );
}

const wrongTone =
  optimizeSaleCutRequirementPlan(
    plan,
    [
      {
        id: "wrong-tone",
        stockItemId: "stock-bambu",
        onHandMeters: 30,
        reservedMeters: 0,
        colorTone: "B",
        patternCode: "P1"
      }
    ],
    {
      "stock-bambu": {
        requiredColorTone: "A",
        requiredPatternCode: "P1"
      }
    }
  );

assert.equal(
  wrongTone.outcome,
  "READY"
);

if (
  wrongTone.outcome === "READY"
) {
  assert.equal(
    wrongTone.missingMeters,
    20
  );
}

console.log(
  "[PASS] sale20MetersPreserves12And8Openings"
);
console.log(
  "[PASS] existingOptimizerSuggestsLotsPerOpening"
);
console.log(
  "[PASS] insufficientStockReportsMissingMeters"
);
console.log(
  "[PASS] multiPiecePolicyUsesExistingEngine"
);
console.log(
  "[PASS] tonePatternFilteringPreserved"
);
const noDoubleSpendPlan:
  SaleCutRequirementPlanResult = {
    outcome: "READY",
    saleId: "sale-double-spend",
    totalMeters: 16,
    requirements: [
      {
        stockItemId: "stock-one-lot",
        productType: "TUL",
        totalMeters: 16,
        pieces: [
          {
            id: "double-piece-1",
            saleId: "sale-double-spend",
            saleItemId: "double-item-1",
            parentSaleItemId: "double-parent",
            stockItemId: "stock-one-lot",
            roomName: "Salon",
            openingName: "1. Cam",
            productType: "TUL",
            requiredMeters: 8
          },
          {
            id: "double-piece-2",
            saleId: "sale-double-spend",
            saleItemId: "double-item-2",
            parentSaleItemId: "double-parent",
            stockItemId: "stock-one-lot",
            roomName: "Salon",
            openingName: "2. Cam",
            productType: "TUL",
            requiredMeters: 8
          }
        ]
      }
    ]
  };

const noDoubleSpend =
  optimizeSaleCutRequirementPlan(
    noDoubleSpendPlan,
    [
      {
        id: "only-lot-12",
        stockItemId: "stock-one-lot",
        onHandMeters: 12,
        reservedMeters: 0
      }
    ]
  );

assert.equal(
  noDoubleSpend.outcome,
  "READY"
);

if (
  noDoubleSpend.outcome === "READY"
) {
  const pieces =
    noDoubleSpend
      .stockRequirements[0]
      .pieces;

  assert.equal(
    pieces[0].suggestions.length > 0,
    true
  );

  assert.equal(
    pieces[1].suggestions.length,
    0
  );

  assert.equal(
    noDoubleSpend.missingMeters,
    8
  );
}

console.log(
  "[PASS] sameLotCannotBeDoubleSpentAcrossOpenings"
);
console.log(
  "[PASS] saleCutOptimizerAdapterSuite completed"
);