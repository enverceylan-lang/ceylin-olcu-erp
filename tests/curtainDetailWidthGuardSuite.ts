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

assert(
  page.includes("if (selectedTemplate === 'CURTAIN_DETAIL')"),
  "CURTAIN_DETAIL width guard missing",
);
assert(
  page.includes("positiveNumber(rawValues.windowWidth)"),
  "legacy windowWidth fallback missing",
);
assert(
  page.includes("if (!hasFacadeWidth) {"),
  "CURTAIN_DETAIL empty-width rejection missing",
);
assert(
  page.includes("En az bir geçerli ölçü girmeden kayıt yapılamaz."),
  "existing validation message missing",
);

console.log("[PASS] curtainDetailWidthGuardSuite completed");