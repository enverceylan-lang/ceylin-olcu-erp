import { calculateSelectedProduct } from "../src/lib/calculationEngine";

interface TestFailure {
  name: string;
  expected: unknown;
  actual: unknown;
}

interface SelectedProductFixture {
  productType: string;
  isActive: boolean;
  addedAt: string;
  calculation?: Record<string, unknown>;
}

const failures: TestFailure[] = [];

function expectEqual(
  testName: string,
  actual: unknown,
  expected: unknown
): void {
  if (actual === expected) {
    console.log(`[PASS] ${testName}`);
    return;
  }

  failures.push({
    name: testName,
    expected,
    actual
  });

  console.log(
    `[FAIL] ${testName}: expected ${String(expected)}, got ${String(actual)}`
  );
}

function createActiveRustic(
  billingWidth = 210
): SelectedProductFixture {
  return {
    productType: "RUSTIK",
    isActive: true,
    addedAt: "2026-07-26T00:00:00.000Z",
    calculation: {
      billingWidth,
      billingWidthCm: billingWidth
    }
  };
}

function calculateHeight(
  productType: string,
  measuredHeightCm: number,
  rawValues: Record<string, unknown>,
  siblingProducts: SelectedProductFixture[] = []
): number | undefined {
  const calculation = calculateSelectedProduct(
    productType,
    200,
    measuredHeightCm,
    rawValues,
    siblingProducts
  );

  return calculation.billingHeightCm;
}

function calculateWidth(
  productType: string,
  measuredWidthCm: number,
  measuredHeightCm: number,
  rawValues: Record<string, unknown>,
  siblingProducts: SelectedProductFixture[] = []
): number | undefined {
  const calculation = calculateSelectedProduct(
    productType,
    measuredWidthCm,
    measuredHeightCm,
    rawValues,
    siblingProducts
  );

  return calculation.billingWidthCm;
}

console.log("==================================================");
console.log("RUSTIK / CURTAIN HEIGHT RULES - SCOPED TESTS");
console.log("==================================================");

const detailedHeightValues = {
  camUstuCm: 40,
  camIciCm: 160,
  camAltiCm: 70
};

const activeRustic = [
  createActiveRustic()
];

/*
 * NORMAL KORNISLI URUNLER
 *
 * Rustik aktif degilken mevcut normal hesap korunur.
 * Cam ustu 20 cm ile sinirlanmaz.
 */
expectEqual(
  "normal_tul_preserves_existing_height_rule",
  calculateHeight(
    "TUL",
    270,
    detailedHeightValues
  ),
  265
);

expectEqual(
  "normal_guneslik_preserves_existing_height_rule",
  calculateHeight(
    "GUNESLIK",
    270,
    detailedHeightValues
  ),
  263
);

expectEqual(
  "normal_fon_preserves_existing_height_rule",
  calculateHeight(
    "FON",
    270,
    detailedHeightValues
  ),
  268
);

/*
 * NORMAL RUSTIK AKTIF URUNLER
 *
 * Yalniz aktif RUSTIK baglaminda:
 * ust pay = min(20, camUstu)
 * Tul = ust pay + cam ici + cam alti - 5
 * Guneslik = Tul - 2
 * Fon = Tul + 1
 */
expectEqual(
  "rustik_tul_uses_max_20_upper_allowance",
  calculateHeight(
    "TUL",
    270,
    detailedHeightValues,
    activeRustic
  ),
  245
);

expectEqual(
  "rustik_guneslik_is_two_cm_shorter_than_tul",
  calculateHeight(
    "GUNESLIK",
    270,
    detailedHeightValues,
    activeRustic
  ),
  243
);

expectEqual(
  "rustik_fon_is_one_cm_longer_than_tul",
  calculateHeight(
    "FON",
    270,
    detailedHeightValues,
    activeRustic
  ),
  246
);

expectEqual(
  "rustik_upper_allowance_uses_actual_value_below_20",
  calculateHeight(
    "TUL",
    245,
    {
      camUstuCm: 15,
      camIciCm: 160,
      camAltiCm: 70
    },
    activeRustic
  ),
  240
);

/*
 * KULLANICI OZEL BOYU
 *
 * Ozel boy nihai degerdir.
 * Rustik ofsetleri yeniden uygulanmaz.
 */
expectEqual(
  "rustik_custom_tul_height_is_final",
  calculateHeight(
    "TUL",
    270,
    {
      ...detailedHeightValues,
      heightMode: "CUSTOM",
      customHeightCm: 265
    },
    activeRustic
  ),
  265
);

expectEqual(
  "rustik_custom_guneslik_height_is_final",
  calculateHeight(
    "GUNESLIK",
    270,
    {
      ...detailedHeightValues,
      heightMode: "CUSTOM",
      customHeightCm: 265
    },
    activeRustic
  ),
  265
);

expectEqual(
  "rustik_custom_fon_height_is_final",
  calculateHeight(
    "FON",
    270,
    {
      ...detailedHeightValues,
      heightMode: "CUSTOM",
      customHeightCm: 265
    },
    activeRustic
  ),
  265
);

/*
 * RUSTIK EN HESABI
 */
expectEqual(
  "rustik_uses_25_cm_left_and_right_allowance",
  calculateWidth(
    "RUSTIK",
    155,
    250,
    {
      camAltiCm: 5
    }
  ),
  210
);

console.log("==================================================");

if (failures.length > 0) {
  console.log(
    `SCOPED TEST RESULT: ${failures.length} RULE(S) STILL RED`
  );

  failures.forEach((failure) => {
    console.log(
      `[RED] ${failure.name}: expected ${String(failure.expected)}, got ${String(failure.actual)}`
    );
  });

  process.exitCode = 1;
} else {
  console.log("ALL SCOPED RUSTIK HEIGHT TESTS PASSED");
}