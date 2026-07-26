import {
  getSlopedCeilingReportPresentation
} from "../src/lib/slopedCeilingReport";

interface TestFailure {
  name: string;
  expected: unknown;
  actual: unknown;
}

const failures: TestFailure[] = [];

function expectEqual(
  name: string,
  actual: unknown,
  expected: unknown
): void {
  if (
    JSON.stringify(actual) ===
    JSON.stringify(expected)
  ) {
    console.log(`[PASS] ${name}`);
    return;
  }

  failures.push({
    name,
    expected,
    actual
  });

  console.log(
    `[FAIL] ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

console.log("==================================================");
console.log("TAVAN YAMUK REPORT PRESENTATION SUITE");
console.log("==================================================");

const slopedPresentation =
  getSlopedCeilingReportPresentation({
    warning: "TAVAN YAMUK",
    productionHeightsCm: {
      left: 248,
      middle: 246,
      right: 243
    }
  });

expectEqual(
  "sloped_warning_is_visible",
  slopedPresentation.isVisible,
  true
);

expectEqual(
  "sloped_warning_uses_single_title",
  slopedPresentation.warningTitle,
  "TAVAN YAMUK"
);

expectEqual(
  "sloped_final_heights_are_preserved",
  slopedPresentation.productionHeightsCm,
  {
    left: 248,
    middle: 246,
    right: 243
  }
);

expectEqual(
  "sloped_final_height_text_is_report_ready",
  slopedPresentation.productionHeightText,
  "Sol Dikim: 248 cm | Orta Dikim: 246 cm | Sağ Dikim: 243 cm"
);

const flatPresentation =
  getSlopedCeilingReportPresentation({
    warning: "",
    productionHeightsCm: {
      left: 248,
      middle: 248,
      right: 248
    }
  });

expectEqual(
  "flat_ceiling_warning_is_hidden",
  flatPresentation.isVisible,
  false
);

const incompletePresentation =
  getSlopedCeilingReportPresentation({
    warning: "TAVAN YAMUK",
    productionHeightsCm: {
      left: 248,
      middle: 0,
      right: 243
    }
  });

expectEqual(
  "incomplete_profile_is_not_rendered",
  incompletePresentation.isVisible,
  false
);

const alternateWarningPresentation =
  getSlopedCeilingReportPresentation({
    warning: "TAVAN ÇAP",
    productionHeightsCm: {
      left: 248,
      middle: 246,
      right: 243
    }
  });

expectEqual(
  "alternate_warning_is_not_rendered",
  alternateWarningPresentation.isVisible,
  false
);

console.log("==================================================");

if (failures.length > 0) {
  console.log(
    `REPORT PRESENTATION RESULT: ${failures.length} FAILURE(S)`
  );

  failures.forEach((failure) => {
    console.log(
      `[RED] ${failure.name}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`
    );
  });

  process.exitCode = 1;
} else {
  console.log(
    "ALL REPORT PRESENTATION TESTS PASSED"
  );
}