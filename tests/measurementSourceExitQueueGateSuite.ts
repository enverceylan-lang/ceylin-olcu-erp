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

const db = fs.readFileSync(
  path.join(root, "src", "lib", "localDraftDb.ts"),
  "utf8",
);

assert(
  !page.includes("V1A Queue - Add to sync queue for push"),
  "Cari detayında SOURCE_EXIT öncesi DRAFT enqueue hâlâ var",
);

const createStart = db.indexOf("export async function createMeasurementDraft");
const updateStart = db.indexOf("export async function updateMeasurementDraft");
const installStart = db.indexOf("export async function createInstallationDraft");
const markReadyStart = db.indexOf("export async function markDraftReadyToTransfer");

assert(createStart >= 0 && updateStart > createStart, "createMeasurementDraft bulunamadı");
assert(installStart > updateStart, "updateMeasurementDraft sınırı bulunamadı");
assert(markReadyStart > installStart, "markDraftReadyToTransfer bulunamadı");

const createBlock = db.slice(createStart, updateStart);
const updateBlock = db.slice(updateStart, installStart);
const markReadyBlock = db.slice(markReadyStart);

assert(
  !createBlock.includes("enqueueSyncEvent('DRAFT'"),
  "createMeasurementDraft SOURCE_EXIT öncesi enqueue ediyor",
);

assert(
  !updateBlock.includes("enqueueSyncEvent('DRAFT'"),
  "updateMeasurementDraft SOURCE_EXIT öncesi enqueue ediyor",
);

assert(
  markReadyBlock.includes('"SOURCE_EXIT"'),
  "markDraftReadyToTransfer SOURCE_EXIT doğrulaması içermiyor",
);

const validationIndex = markReadyBlock.indexOf("validateMeasurementTransferTree(");
const enqueueIndex = markReadyBlock.indexOf("enqueueSyncEvent('DRAFT'");

assert(validationIndex >= 0, "SOURCE_EXIT validation bulunamadı");
assert(enqueueIndex > validationIndex, "DRAFT enqueue validation sonrasında olmalı");

console.log("[PASS] measurementSourceExitQueueGateSuite completed");