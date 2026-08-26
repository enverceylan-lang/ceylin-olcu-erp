import assert from "node:assert/strict";
import fs from "node:fs";

const topbar = fs.readFileSync(
  "src/components/Topbar.tsx",
  "utf8",
);
const scope = fs.readFileSync(
  "src/components/ErpScopeSelector.tsx",
  "utf8",
);
const visual = fs.readFileSync(
  "src/components/reports/MeasurementVisualReport.tsx",
  "utf8",
);

assert.match(
  topbar,
  /min-w-10 shrink-0 items-center justify-center/,
);

assert.match(
  scope,
  /max-w-\[150px\]/,
);

assert.match(
  scope,
  /max-w-\[112px\].*truncate/,
);

assert.match(
  visual,
  /canShare\(\{\s*files:\s*\[pdfFile\]/,
);

assert.match(
  visual,
  /a\.download\s*=/,
);

assert.match(
  visual,
  /window\.location\.assign\(wpUrl\)/,
);

assert.doesNotMatch(
  visual,
  /const fallbackWhatsApp[\s\S]*?await navigator\.share/,
);

console.log(
  "PAK_MOBILE_MEASUREMENT_SHARE_UX_V1"
);
