import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCariIdentityNumber,
  formatCariPhone,
  formatCariTaxNumber,
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

test("cari phone display formatting", () => {
  assert.equal(formatCariPhone("05051234567"), "0505 123 45 67");
  assert.equal(formatCariPhone("0505 123 45 67"), "0505 123 45 67");
});

test("cari identity display formatting", () => {
  assert.equal(formatCariIdentityNumber("12345678901"), "123 4567 8901");
});

test("cari tax display formatting", () => {
  assert.equal(formatCariTaxNumber("1234567890"), "123 456 7890");
});