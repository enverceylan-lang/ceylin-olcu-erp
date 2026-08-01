import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const db = fs.readFileSync(path.join(root, "src", "lib", "localDraftDb.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "src", "app", "olculer", "page.tsx"), "utf8");

const getIndex = db.indexOf("const currentDraft = await localDraftDb.measurementDrafts.get(id);");
const validateIndex = db.indexOf("validateMeasurementTransferTree(", getIndex);
const readyIndex = db.indexOf("syncStatus: 'READY_TO_TRANSFER'", getIndex);

assert(getIndex >= 0, "draft read missing");
assert(validateIndex > getIndex, "SOURCE_EXIT validation missing");
assert(readyIndex > validateIndex, "validation must run before READY_TO_TRANSFER");
assert(db.includes('"SOURCE_EXIT"'), "SOURCE_EXIT stage missing");
assert(page.includes("Ölçüler gönderilemedi. Eksik veya geçersiz ölçü bulundu."), "user-facing error missing");

console.log("[PASS] measurementSourceExitGateSuite completed");