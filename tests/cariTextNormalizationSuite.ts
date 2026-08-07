import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCariAddress,
  normalizeCariName,
  normalizeCariRegion
} from "../src/lib/stringUtils";

test("Turkish cari name normalization", () => {
  assert.equal(normalizeCariName("  ışık   perde  "), "IŞIK PERDE");
  assert.equal(normalizeCariName("inci tekstil"), "İNCİ TEKSTİL");
});

test("Turkish address normalization", () => {
  assert.equal(
    normalizeCariAddress("  atatürk mah.   istiklal cad. no: 5 "),
    "ATATÜRK MAH. İSTİKLAL CAD. NO: 5"
  );
});

test("province and district normalization", () => {
  assert.equal(normalizeCariRegion(" istanbul "), "İSTANBUL");
  assert.equal(normalizeCariRegion(" kadıköy "), "KADIKÖY");
});
