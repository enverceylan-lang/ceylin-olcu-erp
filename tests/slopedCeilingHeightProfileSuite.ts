import { calculateSelectedProduct } from "../src/lib/calculationEngine";

type UnknownRecord = Record<string, unknown>;

interface HeightProfile {
  left: number;
  middle: number;
  right: number;
}

interface TestFailure {
  name: string;
  expected: unknown;
  actual: unknown;
}

const failures: TestFailure[] = [];

function asRecord(value: unknown): UnknownRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function readHeightProfile(
  resultValue: unknown
): HeightProfile | undefined {
  const result = asRecord(resultValue);
  const legacy = asRecord(result.legacyCalculation);

  const candidate = asRecord(
    result.productionHeightsCm ??
    result.sewingHeightsCm ??
    result.heightProfileCm ??
    legacy.productionHeightsCm ??
    legacy.sewingHeightsCm ??
    legacy.heightProfileCm
  );

  const left = Number(
    candidate.left ??
    candidate.sol ??
    0
  );

  const middle = Number(
    candidate.middle ??
    candidate.center ??
    candidate.orta ??
    0
  );

  const right = Number(
    candidate.right ??
    candidate.sag ??
    0
  );

  if (
    left <= 0 ||
    middle <= 0 ||
    right <= 0
  ) {
    return undefined;
  }

  return {
    left,
    middle,
    right
  };
}

function readWarningText(
  resultValue: unknown
): string {
  const result = asRecord(resultValue);
  const legacy = asRecord(result.legacyCalculation);

  const warnings =
    Array.isArray(result.warnings)
      ? result.warnings
      : [];

  const normalizedWarnings = warnings
    .map((warning) => {
      const record = asRecord(warning);

      return String(
        record.message ||
        record.code ||
        ""
      );
    })
    .filter(Boolean);

  return [
    ...normalizedWarnings,
    String(result.warning || ""),
    String(result.description || ""),
    String(legacy.warning || ""),
    String(legacy.description || "")
  ]
    .filter(Boolean)
    .join(" | ")
    .toUpperCase();
}

function expectJsonEqual(
  name: string,
  actual: unknown,
  expected: unknown
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson === expectedJson) {
    console.log(`[PASS] ${name}`);
    return;
  }

  failures.push({
    name,
    expected,
    actual
  });

  console.log(
    `[FAIL] ${name}: expected ${expectedJson}, got ${actualJson}`
  );
}

function expectIncludes(
  name: string,
  actual: string,
  expectedText: string
): void {
  if (actual.includes(expectedText)) {
    console.log(`[PASS] ${name}`);
    return;
  }

  failures.push({
    name,
    expected: expectedText,
    actual
  });

  console.log(
    `[FAIL] ${name}: expected text "${expectedText}", got "${actual}"`
  );
}

function expectNotIncludes(
  name: string,
  actual: string,
  unexpectedText: string
): void {
  if (!actual.includes(unexpectedText)) {
    console.log(`[PASS] ${name}`);
    return;
  }

  failures.push({
    name,
    expected: `not containing ${unexpectedText}`,
    actual
  });

  console.log(
    `[FAIL] ${name}: unexpected text "${unexpectedText}" found`
  );
}

const activeCeilingRustic = [
  {
    productType: "TAVAN_RUSTIK",
    isActive: true,
    addedAt: "2026-07-26T00:00:00.000Z"
  }
];

console.log("==================================================");
console.log("SLOPED CEILING HEIGHT PROFILE - TEST-FIRST");
console.log("==================================================");

/*
 * Tavan rustik Fon:
 * Sol 260 - kartonpiyer 10 - 2 = 248
 * Orta 258 - kartonpiyer 10 - 2 = 246
 * Sağ 255 - kartonpiyer 10 - 2 = 243
 */
const slopedFonResult = calculateSelectedProduct(
  "FON",
  300,
  260,
  {
    solYukseklikCm: 260,
    ortaYukseklikCm: 258,
    sagYukseklikCm: 255,
    ceilingGap: 10,
    kartonpiyerBoslukCm: 10,
    wingQuantity: 2
  },
  activeCeilingRustic
);

expectJsonEqual(
  "sloped_ceiling_preserves_final_sewing_heights",
  readHeightProfile(slopedFonResult),
  {
    left: 248,
    middle: 246,
    right: 243
  }
);

expectIncludes(
  "sloped_ceiling_creates_warning",
  readWarningText(slopedFonResult),
  "TAVAN YAMUK"
);


/*
 * Düz tavanda üç nihai değer aynı korunur.
 */
const flatFonResult = calculateSelectedProduct(
  "FON",
  300,
  260,
  {
    solYukseklikCm: 260,
    ortaYukseklikCm: 260,
    sagYukseklikCm: 260,
    ceilingGap: 10,
    kartonpiyerBoslukCm: 10,
    wingQuantity: 2
  },
  activeCeilingRustic
);

expectJsonEqual(
  "flat_ceiling_keeps_equal_final_sewing_heights",
  readHeightProfile(flatFonResult),
  {
    left: 248,
    middle: 248,
    right: 248
  }
);

expectNotIncludes(
  "flat_ceiling_has_no_sloped_warning",
  readWarningText(flatFonResult),
  "TAVAN YAMUK"
);

console.log("==================================================");

if (failures.length > 0) {
  console.log(
    `TEST-FIRST RESULT: ${failures.length} RULE(S) RED`
  );

  failures.forEach((failure) => {
    console.log(
      `[RED] ${failure.name}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`
    );
  });

  process.exitCode = 1;
} else {
  console.log(
    "ALL SLOPED CEILING PROFILE TESTS PASSED"
  );
}
