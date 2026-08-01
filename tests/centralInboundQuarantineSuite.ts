import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const db = fs.readFileSync(path.join(root, "src", "lib", "localDraftDb.ts"), "utf8");
const delta = fs.readFileSync(path.join(root, "src", "lib", "deltaSyncClient.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "src", "app", "olculer", "page.tsx"), "utf8");

assert(db.includes("'QUARANTINE'"), "Inbound QUARANTINE status missing");
assert(db.includes("validationIssues?: MeasurementValidationIssue[]"), "Validation metadata missing");
assert(db.includes("existingEntity.status === 'QUARANTINE'"), "Quarantine merge preservation missing");

assert(
  delta.includes('import { validateMeasurementRecord } from "@/lib/measurementValidationEngine";'),
  "Validation import missing",
);

const validateIndex = delta.indexOf("const validationIssues = validateMeasurementRecord(");
const structureIndex = delta.indexOf("await ensureCustomerStructureForMeasurement(", validateIndex);
const upsertIndex = delta.indexOf(".batchUpsertMeasurements([measurementToPersist])", validateIndex);

assert(validateIndex >= 0, "CENTRAL_INBOUND validation missing");
assert(structureIndex > validateIndex, "Validation must precede customer structure mutation");
assert(upsertIndex > validateIndex, "Validation must precede permanent measurement upsert");
assert(delta.includes('status: "QUARANTINE"'), "Quarantine write missing");
assert(delta.includes('failureReason: "VALIDATION_QUARANTINED"'), "Receipt quarantine reason missing");

assert(page.includes("setQuarantinedMeasurements("), "Quarantine UI loading missing");
assert(page.includes("Ölçü Sağlığı / Düzeltme Bekleyenler"), "Health panel missing");
assert(page.includes("DÜZELTME BEKLİYOR"), "Health state missing");
assert(page.includes("item.measuredBy || item.measuredById || item.senderId"), "Measured-by display missing");

console.log("[PASS] centralInboundQuarantineSuite completed");