import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();

const queue = fs.readFileSync(
  path.join(root, "src/lib/localSyncQueueDb.ts"),
  "utf8",
);

const page = fs.readFileSync(
  path.join(root, "src/app/cariler/[id]/page.tsx"),
  "utf8",
);

assert(
  queue.includes("validateCustomerMeasurementExit"),
  "CUSTOMER passport sync queue'ya bağlı değil",
);

assert(
  queue.includes("syncStatus: 'PENDING' | 'SYNCED' | 'ERROR' | 'BLOCKED';"),
  "BLOCKED status eksik",
);

assert(
  queue.includes("[MeasurementPassport] Existing queued CUSTOMER event blocked"),
  "Eski kuyruk passport koruması eksik",
);

assert(
  page.includes("[MeasurementValidation] Ölçü kayıt kapısı"),
  "Ölçü kayıt kapısı eksik",
);

assert(
  page.includes("[MeasurementValidation] Satışa Hazırlık kapısı"),
  "Satışa Hazırlık kapısı eksik",
);

assert(
  page.includes("openRoomPreparation(room);"),
  "Satışa Hazırlık güvenli açılışı eksik",
);

console.log("[PASS] measurementDomainPassportSourceGuardSuite completed");