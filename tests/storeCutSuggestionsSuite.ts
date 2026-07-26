import assert from "node:assert/strict";
import { generateStoreCutSuggestions } from "../src/lib/storeCutSuggestions";
import type {
  StoreCutLot,
  StoreCutRequirement,
} from "../src/lib/storeCutPlanning";

const requirement: StoreCutRequirement = {
  id: "requirement-22",
  saleItemId: "sale-item-1",
  stockItemId: "fabric-1",
  pieceLengthMeters: 22,
  pieceCount: 1,
  continuity: "MULTI_PIECE_ALLOWED",
  requiredColorTone: "A",
  requiredPatternCode: "P1",
};

const lots: StoreCutLot[] = [
  {
    id: "lot-12",
    stockItemId: "fabric-1",
    onHandMeters: 12,
    reservedMeters: 0,
    lotCode: "L1",
    colorTone: "A",
    patternCode: "P1",
  },
  {
    id: "lot-10",
    stockItemId: "fabric-1",
    onHandMeters: 10,
    reservedMeters: 0,
    lotCode: "L1",
    colorTone: "A",
    patternCode: "P1",
  },
  {
    id: "lot-40",
    stockItemId: "fabric-1",
    onHandMeters: 40,
    reservedMeters: 0,
    lotCode: "L2",
    colorTone: "A",
    patternCode: "P1",
  },
  {
    id: "wrong-tone",
    stockItemId: "fabric-1",
    onHandMeters: 30,
    reservedMeters: 0,
    lotCode: "L3",
    colorTone: "B",
    patternCode: "P1",
  },
  {
    id: "reserved",
    stockItemId: "fabric-1",
    onHandMeters: 30,
    reservedMeters: 30,
    lotCode: "L4",
    colorTone: "A",
    patternCode: "P1",
  },
];

const suggestions = generateStoreCutSuggestions({
  requirement,
  lots,
});
assert.ok(suggestions.length >= 2);
assert.ok(
  suggestions.some(
    (suggestion) =>
      suggestion.lotIds.includes("lot-12") &&
      suggestion.lotIds.includes("lot-10")
  )
);
assert.ok(
  suggestions.some(
    (suggestion) =>
      suggestion.lotIds.length === 1 &&
      suggestion.lotIds[0] === "lot-40"
  )
);
assert.ok(
  suggestions.every(
    (suggestion) =>
      !suggestion.lotIds.includes("wrong-tone") &&
      !suggestion.lotIds.includes("reserved")
  )
);
assert.ok(suggestions.every((suggestion) => suggestion.evaluation.valid));
assert.ok(
  suggestions.every(
    (suggestion, index) =>
      index === 0 || suggestions[index - 1].score >= suggestion.score
  )
);

const singlePieceSuggestions = generateStoreCutSuggestions({
  requirement: {
    ...requirement,
    continuity: "SINGLE_PIECE_REQUIRED",
  },
  lots,
});
assert.ok(singlePieceSuggestions.length >= 1);
assert.ok(
  singlePieceSuggestions.every(
    (suggestion) =>
      suggestion.lotIds.length === 1 &&
      suggestion.lotIds[0] === "lot-40"
  )
);

const sameLotSuggestions = generateStoreCutSuggestions({
  requirement: {
    ...requirement,
    sameLotRequired: true,
  },
  lots,
});
assert.ok(
  sameLotSuggestions.every(
    (suggestion) =>
      suggestion.lotIds.length === 1 ||
      suggestion.lotIds.every((lotId) => ["lot-12", "lot-10"].includes(lotId))
  )
);

const defectiveLots: StoreCutLot[] = [
  {
    id: "defective",
    stockItemId: "fabric-1",
    onHandMeters: 25,
    reservedMeters: 0,
    unusableMeters: 5,
    colorTone: "A",
    patternCode: "P1",
  },
];
assert.equal(
  generateStoreCutSuggestions({ requirement, lots: defectiveLots }).length,
  0
);

console.log("[PASS] store cut suggestions");
