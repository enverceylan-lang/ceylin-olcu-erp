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

const technical = fs.readFileSync(
  path.join(
    root,
    "src",
    "components",
    "reports",
    "TechnicalMeasurementSketch.tsx",
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

/* ENVERP_A5_SVG_HEIGHT_AUTO_RUNTIME_CONTRACT_V1 */
assert.equal(
  technical.includes('height="auto"'),
  false,
);

assert.equal(
  technical.includes("height: 'auto'"),
  true,
);

assert.equal(
  visual.includes(
    'function normalizeA5SvgAutoHeightAttribute(',
  ),
  true,
);

assert.equal(
  visual.includes(
    "svg.getAttribute('height')",
  ),
  true,
);

assert.equal(
  visual.includes(
    "svg.removeAttribute('height')",
  ),
  true,
);

assert.equal(
  visual.includes(
    "svg.style.height = 'auto'",
  ),
  true,
);

assert.equal(
  visual.includes(
    "normalizeA5SvgAutoHeightAttribute(\n      roomClone",
  ) ||
    visual.includes(
      "normalizeA5SvgAutoHeightAttribute(\r\n      roomClone",
    ),
  true,
);

assert.equal(
  visual.includes(
    "normalizeA5SvgAutoHeightAttribute(\n        totalsClone",
  ) ||
    visual.includes(
      "normalizeA5SvgAutoHeightAttribute(\r\n        totalsClone",
    ),
  true,
);
/* ENVERP_A5_SRGB_COLOR_SAFETY_CONTRACT_V1 */
const a5SrgbMarker =
  '/* ENVERP_A5_SRGB_COLOR_SAFETY_V1';

const a5SrgbStart =
  visual.indexOf(a5SrgbMarker);

assert.ok(
  a5SrgbStart >= 0,
  'A5 sRGB safety marker missing',
);

const a5SrgbEnd =
  visual.indexOf(
    '[data-a5-room-header="true"]',
    a5SrgbStart,
  );

assert.ok(
  a5SrgbEnd > a5SrgbStart,
  'A5 sRGB safety block boundary missing',
);

const a5SrgbBlock =
  visual.slice(
    a5SrgbStart,
    a5SrgbEnd,
  );

const a4SrgbStart =
  visual.indexOf(
    'sourceColorSafetyStyle.textContent = `',
  );

assert.ok(
  a4SrgbStart >= 0,
  'A4 sRGB source contract missing',
);

const a4SrgbEnd =
  visual.indexOf(
    '`;',
    a4SrgbStart,
  );

assert.ok(
  a4SrgbEnd > a4SrgbStart,
  'A4 sRGB source contract boundary missing',
);

const a4SrgbBlock =
  visual.slice(
    a4SrgbStart,
    a4SrgbEnd,
  );

const sharedSrgbContract = [
  'font-family: Arial, Helvetica, sans-serif !important;',
  'color: #0f172a !important;',
  'background-color: #ffffff !important;',
  'border-color: #cbd5e1 !important;',
  'outline-color: #cbd5e1 !important;',
  'text-decoration-color: #0f172a !important;',
  'background-image: none !important;',
  'box-shadow: none !important;',
  'text-shadow: none !important;',
];

for (const rule of sharedSrgbContract) {
  assert.equal(
    a5SrgbBlock.includes(rule),
    true,
    `A5 sRGB contract drift: ${rule}`,
  );
  assert.equal(
    a4SrgbBlock.includes(rule),
    true,
    `A4 sRGB reference drift: ${rule}`,
  );
}

assert.equal(
  a5SrgbBlock.includes(
    '[data-enverp-a5-live] *::before',
  ),
  true,
);

assert.equal(
  a5SrgbBlock.includes(
    '[data-enverp-a5-live] *::after',
  ),
  true,
);

const a5SrgbDeclarationLines =
  a5SrgbBlock
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();

      return (
        trimmed.includes(':') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('//')
      );
    })
    .join('\n');

assert.doesNotMatch(
  a5SrgbDeclarationLines,
  /\b(?:oklab|oklch|lab|lch|color-mix)\s*\(/i,
);

assert.doesNotMatch(
  a5SrgbBlock,
  /(?:^|\n)\s*(?:fill|stroke)\s*:/m,
);

assert.match(
  a5SrgbBlock,
  /FUTURE_ME_A5_SRGB_GUARD/,
);

const firstA5CaptureAfterSafety =
  visual.indexOf(
    'html2canvas(',
    a5SrgbEnd,
  );

assert.ok(
  firstA5CaptureAfterSafety > a5SrgbEnd,
  'A5 sRGB guard must exist before html2canvas capture',
);

const packageLock =
  JSON.parse(
    fs.readFileSync(
      path.join(root, 'package-lock.json'),
      'utf8',
    ),
  );

const packageJson =
  JSON.parse(
    fs.readFileSync(
      path.join(root, 'package.json'),
      'utf8',
    ),
  );

assert.equal(
  packageLock.packages?.['node_modules/html2canvas']?.version,
  '1.4.1',
  'FUTURE_ME: html2canvas changed; re-evaluate A5 sRGB guard with browser runtime proof',
);

assert.match(
  String(packageJson.devDependencies?.tailwindcss || ''),
  /^\^?4(?:\.|$)/,
  'FUTURE_ME: Tailwind major changed; re-evaluate A5 sRGB guard with browser runtime proof',
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
