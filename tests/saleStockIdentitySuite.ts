import assert from "node:assert/strict";
import {
  resolveSaleStockItemId
} from "../src/lib/saleStockIdentity";

const exact =
  resolveSaleStockItemId(
    [
      {
        productType: "TUL",
        isActive: true,
        stockId: "stock-tul-1"
      },
      {
        productType: "FON",
        isActive: true,
        stockId: "stock-fon-1"
      }
    ],
    "TUL"
  );

assert.equal(
  exact,
  "stock-tul-1"
);

const oneActiveFallback =
  resolveSaleStockItemId(
    [
      {
        productType: "TUL",
        isActive: true,
        stockId: "stock-only"
      },
      {
        productType: "FON",
        isActive: false,
        stockId: "stock-inactive"
      }
    ],
    "BASKA"
  );

assert.equal(
  oneActiveFallback,
  "stock-only"
);

const ambiguous =
  resolveSaleStockItemId(
    [
      {
        productType: "TUL",
        isActive: true,
        stockId: "stock-1"
      },
      {
        productType: "FON",
        isActive: true,
        stockId: "stock-2"
      }
    ],
    "BASKA"
  );

assert.equal(
  ambiguous,
  undefined
);

const inactive =
  resolveSaleStockItemId(
    [
      {
        productType: "TUL",
        isActive: false,
        stockId: "stock-disabled"
      }
    ],
    "TUL"
  );

assert.equal(
  inactive,
  undefined
);

const blank =
  resolveSaleStockItemId(
    [
      {
        productType: "TUL",
        isActive: true,
        stockId: "   "
      }
    ],
    "TUL"
  );

assert.equal(
  blank,
  undefined
);

console.log(
  "[PASS] exactProductStockIdentity"
);
console.log(
  "[PASS] singleActiveStockFallback"
);
console.log(
  "[PASS] ambiguousStockIdentityFailsClosed"
);
console.log(
  "[PASS] inactiveStockIdentityIgnored"
);
console.log(
  "[PASS] blankStockIdentityIgnored"
);
console.log(
  "[PASS] saleStockIdentitySuite completed"
);