import assert from "node:assert/strict";
import {
  parsePlicellPieceInput
} from "../src/lib/plicellPieceInput";

const multiline =
  parsePlicellPieceInput(
    [
      "56,60x175",
      "38.40x20",
      "74,8 × 20"
    ].join("\n")
  );

assert.deepEqual(
  multiline.errors,
  []
);

assert.deepEqual(
  multiline.pieces,
  [
    {
      widthCm:
        56.6,
      heightCm:
        175
    },
    {
      widthCm:
        38.4,
      heightCm:
        20
    },
    {
      widthCm:
        74.8,
      heightCm:
        20
    }
  ]
);

const repeated =
  parsePlicellPieceInput(
    [
      "4*174,5x221",
      "61,7x177",
      "74,8x20"
    ].join("\n")
  );

assert.equal(
  repeated.errors.length,
  0
);

assert.equal(
  repeated.pieces.length,
  6
);

assert.deepEqual(
  repeated.pieces.slice(
    0,
    4
  ),
  Array.from(
    {
      length:
        4
    },
    () => ({
      widthCm:
        174.5,
      heightCm:
        221
    })
  )
);

assert.deepEqual(
  repeated.pieces[4],
  {
    widthCm:
      61.7,
    heightCm:
      177
  }
);

assert.deepEqual(
  repeated.pieces[5],
  {
    widthCm:
      74.8,
    heightCm:
      20
  }
);

const semicolon =
  parsePlicellPieceInput(
    "56,6x175; 38,4x20"
  );

assert.equal(
  semicolon.pieces.length,
  2
);

const partial =
  parsePlicellPieceInput(
    [
      "56,6x175",
      "hatalı",
      "2*40x20"
    ].join("\n")
  );

assert.equal(
  partial.pieces.length,
  3
);

assert.equal(
  partial.errors.length,
  1
);

assert.match(
  partial.errors[0],
  /2\. giriş çözümlenemedi/
);

const invalidZero =
  parsePlicellPieceInput(
    "0x175"
  );

assert.equal(
  invalidZero.pieces.length,
  0
);

assert.equal(
  invalidZero.errors.length,
  1
);

const excessiveRepeat =
  parsePlicellPieceInput(
    "101*56x175"
  );

assert.equal(
  excessiveRepeat.pieces.length,
  0
);

assert.match(
  excessiveRepeat.errors[0],
  /1-100/
);

const empty =
  parsePlicellPieceInput(
    "   "
  );

assert.deepEqual(
  empty.pieces,
  []
);

assert.deepEqual(
  empty.errors,
  [
    "En az bir ölçü girin."
  ]
);

console.log(
  "PLICELL_PIECE_INPUT_TEST: PAK"
);