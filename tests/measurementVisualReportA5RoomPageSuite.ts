import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const visual = fs.readFileSync(
  path.join(
    root,
    "src",
    "components",
    "reports",
    "MeasurementVisualReport.tsx",
  ),
  "utf8",
);

const plicell = fs.readFileSync(
  path.join(
    root,
    "src",
    "components",
    "reports",
    "PlicellMeasurementSketch.tsx",
  ),
  "utf8",
);

const adapter = fs.readFileSync(
  path.join(
    root,
    "src",
    "lib",
    "measurementAdapter.ts",
  ),
  "utf8",
);

assert.match(
  visual,
  /ENVERP_A5_ROOM_REPORT_V1/,
);

assert.match(
  visual,
  /format:\s*'a5'/,
);

assert.match(
  visual,
  /ENVERP_A5_PAGE_WIDTH_MM\s*=\s*148/,
);

assert.match(
  visual,
  /ENVERP_A5_PAGE_HEIGHT_MM\s*=\s*210/,
);

assert.match(
  visual,
  /ENVERP_A5_MIN_FONT_PX\s*=\s*7/,
);

assert.match(
  visual,
  /querySelectorAll<HTMLElement>\(\s*['"]\.room-section['"]\s*\)/,
);

assert.match(
  visual,
  /A5_ROOM_LAYOUT_OVERFLOW/,
);

assert.match(
  visual,
  /A5_ROOM_LAYOUT_FONT_FLOOR_VIOLATION/,
);

assert.match(
  visual,
  /generalDisplayDimensions\.dimensionText/,
);

/*
 * The canonical PDF producer is consumed by both:
 * - Yazdır / PDF Al (object URL download)
 * - WhatsApp / native file share
 *
 * A5 must therefore preserve Promise<File>; a save-only Promise<void>
 * path would compile-break or silently regress file sharing.
 */
assert.match(
  visual,
  /async function generateA5RoomPdfFile\([\s\S]*?\): Promise<File>/,
);

assert.match(
  visual,
  /return await generateA5RoomPdfFile\(/,
);

assert.match(
  visual,
  /pdf\.output\('blob'\)/,
);

assert.match(
  visual,
  /return new File\(/,
);

assert.doesNotMatch(
  visual,
  /generateA5RoomPdfFile[\s\S]*?pdf\.save\(/,
);

assert.match(
  plicell,
  /data-plicell-a5-grid=["']true["']/,
);

assert.match(
  adapter,
  /summaryLabel:\s*templateType === 'PLICELL' \? base\.summaryLabel : dimensionText/,
);

/*
 * A4 legacy path must remain in the same source file.
 * It is intentionally unreachable from live UI while
 * isLegacyA4LiveEnabled() returns false.
 */
assert.match(
  visual,
  /format:\s*'a4'/,
);

assert.match(
  visual,
  /const pageWidth = 210;/,
);

assert.match(
  visual,
  /const pageHeight = 297;/,
);

assert.match(
  visual,
  /function isLegacyA4LiveEnabled\(\): boolean \{[\s\S]*?return false;/,
);

assert.doesNotMatch(
  visual,
  /transferSelections/,
);

const plicell40 = 40;
const columns = 4;
const rows = Math.ceil(
  plicell40 / columns,
);
assert.equal(rows, 10);

console.log(
  "PAK measurementVisualReportA5RoomPageSuite",
);
