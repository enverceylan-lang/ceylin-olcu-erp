import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();

const page = fs.readFileSync(
  path.join(root, "src", "app", "cariler", "[id]", "page.tsx"),
  "utf8",
);
const plicell = fs.readFileSync(
  path.join(root, "src", "components", "measurements", "PlicellCamListEditor.tsx"),
  "utf8",
);
const visual = fs.readFileSync(
  path.join(root, "src", "components", "reports", "MeasurementVisualReport.tsx"),
  "utf8",
);
const formatter = fs.readFileSync(
  path.join(root, "src", "lib", "reportFormatters.ts"),
  "utf8",
);

assert(
  page.includes("getMeasurementUserShortCode"),
  "Mobile user short-code helper missing",
);
assert(
  page.includes('className="hidden sm:block"'),
  "Measured-by field is not compact on mobile",
);
assert(
  page.includes("Toplam En: {facadeTotalWidth} cm"),
  "Saved measurement total facade width is missing",
);
assert(
  plicell.includes('className="mb-4 grid grid-cols-2 gap-2"'),
  "Plicell mode buttons are not side-by-side on mobile",
);
assert(
  visual.includes("buildWhatsAppShortReport"),
  "Visual report does not reuse full WhatsApp report text",
);
assert(
  visual.includes("await navigator.share({"),
  "Native mobile text share fallback is missing",
);
assert(
  visual.includes("https://wa.me/?text="),
  "WhatsApp full-text URL fallback is missing",
);
assert(
  formatter.includes("dimensions.structuralWidth <= 0"),
  "Zero-dimension legacy report guard is missing",
);

console.log("[PASS] mobileMeasurementUxShareSuite completed");