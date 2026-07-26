import assert from "node:assert/strict";
import {
  evaluateStoreCutPlan,
  type StoreCutPlanInput,
} from "../src/lib/storeCutPlanning";

function createInput(): StoreCutPlanInput {
  return {
    requirements: [
      {
        id: "requirement-1",
        saleItemId: "sale-item-1",
        stockItemId: "fabric-1",
        pieceLengthMeters: 10,
        pieceCount: 2,
        continuity: "SINGLE_PIECE_REQUIRED",
      },
    ],
    lots: [
      {
        id: "lot-12",
        stockItemId: "fabric-1",
        onHandMeters: 12,
        reservedMeters: 0,
      },
      {
        id: "lot-10",
        stockItemId: "fabric-1",
        onHandMeters: 12,
        reservedMeters: 2,
      },
    ],
    cuts: [
      {
        id: "cut-1",
        requirementId: "requirement-1",
        lotId: "lot-12",
        lengthMeters: 10,
      },
      {
        id: "cut-2",
        requirementId: "requirement-1",
        lotId: "lot-10",
        lengthMeters: 10,
      },
    ],
  };
}

const validPlan = evaluateStoreCutPlan(createInput());
assert.equal(validPlan.valid, true);
assert.equal(validPlan.requiredMeters, 20);
assert.equal(validPlan.plannedCutMeters, 20);
assert.equal(validPlan.planWasteMeters, 0);
assert.equal(validPlan.lotResults[0].remainingAfterMeters, 2);
assert.equal(validPlan.lotResults[1].availableBeforeMeters, 10);
assert.equal(validPlan.lotResults[1].remainingAfterMeters, 0);

const splitSinglePiece = createInput();
splitSinglePiece.requirements[0].pieceCount = 1;
splitSinglePiece.cuts = [
  {
    id: "cut-1",
    requirementId: "requirement-1",
    lotId: "lot-12",
    lengthMeters: 6,
  },
  {
    id: "cut-2",
    requirementId: "requirement-1",
    lotId: "lot-10",
    lengthMeters: 4,
  },
];
const splitSinglePieceResult = evaluateStoreCutPlan(splitSinglePiece);
assert.equal(splitSinglePieceResult.valid, false);
assert.match(splitSinglePieceResult.errors.join("\n"), /tek parça zorunluluğu/);

const allowedSplit = createInput();
allowedSplit.requirements[0].pieceCount = 1;
allowedSplit.requirements[0].continuity = "MULTI_PIECE_ALLOWED";
allowedSplit.cuts = splitSinglePiece.cuts;
assert.equal(evaluateStoreCutPlan(allowedSplit).valid, true);

const reservedStockCannotBeCut = createInput();
reservedStockCannotBeCut.lots[1].reservedMeters = 5;
const reservedResult = evaluateStoreCutPlan(reservedStockCannotBeCut);
assert.equal(reservedResult.valid, false);
assert.match(reservedResult.errors.join("\n"), /kullanılabilir metreyi aşıyor/);

const blockedLot = createInput();
blockedLot.lots[0].isBlocked = true;
const blockedResult = evaluateStoreCutPlan(blockedLot);
assert.equal(blockedResult.valid, false);
assert.match(blockedResult.errors.join("\n"), /bloke top\/lot kullanılamaz/);

const wrongProduct = createInput();
wrongProduct.lots[0].stockItemId = "fabric-2";
const wrongProductResult = evaluateStoreCutPlan(wrongProduct);
assert.equal(wrongProductResult.valid, false);
assert.match(wrongProductResult.errors.join("\n"), /ürün ile top\/lot eşleşmiyor/);

const wastePlan = createInput();
wastePlan.cuts[0].lengthMeters = 11;
const wasteResult = evaluateStoreCutPlan(wastePlan);
assert.equal(wasteResult.valid, true);
assert.equal(wasteResult.planWasteMeters, 1);

console.log("[PASS] store cut planning");
