import assert from "node:assert/strict";

import {
  APPROVED_SALE_DELETE_ERROR,
  assertSaleCanBeDeleted,
  canDeleteSale
} from "../src/lib/saleDeletionPolicy";

function runDeletableStatusTests():
void {
  const statuses = [
    "TASLAK",
    "TEKLİF",
    "İPTAL"
  ] as const;

  for (const status of statuses) {
    assert.equal(
      canDeleteSale(status),
      true
    );

    assert.doesNotThrow(
      () =>
        assertSaleCanBeDeleted(
          status
        )
    );
  }
}

function runProtectedStatusTests():
void {
  const statuses = [
    "ONAYLANDI",
    "SİPARİŞ",
    "ÜRETİME_GÖNDERİLDİ",
    "MONTAJA_GÖNDERİLDİ",
    "TAMAMLANDI"
  ] as const;

  for (const status of statuses) {
    assert.equal(
      canDeleteSale(status),
      false
    );

    assert.throws(
      () =>
        assertSaleCanBeDeleted(
          status
        ),
      {
        message:
          APPROVED_SALE_DELETE_ERROR
      }
    );
  }
}

function main(): void {
  runDeletableStatusTests();
  runProtectedStatusTests();

  console.log(
    "saleDeletionPolicySuite: PASS"
  );
}

main();