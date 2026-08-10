import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/gorevler/page.tsx"),
  "utf8",
);

const requiredImports = [
  "listArchivedFieldTasks",
  "deleteLocalFieldTask",
  "putFieldTask",
  "updateRemoteFieldTaskLifecycle",
  "deleteRemoteFieldTaskLifecycle",
];

for (const requiredImport of requiredImports) {
  assert.ok(
    source.includes(requiredImport),
    `UI must reuse ${requiredImport}`,
  );
}

assert.match(
  source,
  /const canManageLifecycle = role === "ADMIN";/,
  "destructive lifecycle visibility must use exact normalized ADMIN",
);
assert.doesNotMatch(
  source,
  /canManageLifecycle\s*=\s*isAdminView/,
  "broad office view must not grant lifecycle management",
);

const remoteDelete = source.indexOf(
  "await deleteRemoteFieldTaskLifecycle",
);
const localDelete = source.indexOf(
  "await deleteLocalFieldTask",
);
assert.ok(
  remoteDelete >= 0 && localDelete > remoteDelete,
  "hard delete must be remote-first",
);

const remoteLifecycle = source.indexOf(
  "await updateRemoteFieldTaskLifecycle",
);
const localPutAfterLifecycle = source.indexOf(
  "await putFieldTask(result.task)",
  remoteLifecycle,
);
assert.ok(
  remoteLifecycle >= 0 && localPutAfterLifecycle > remoteLifecycle,
  "lifecycle success must precede local canonical put",
);

for (const action of [
  "Yola Çıktım",
  "Ölçüye Başla",
  "Ölçü Alındı",
  "Tamamla",
  "Cariyi Aç",
  "Yol Tarifi",
]) {
  assert.ok(source.includes(action), `FIELD action missing: ${action}`);
}

for (const searchField of [
  "task.customerName",
  "task.assignedUserName",
  "task.customerPhone",
  "task.customerAddress",
  "task.mapLocation",
  "task.note",
]) {
  assert.ok(source.includes(searchField), `search field missing: ${searchField}`);
}

assert.match(source, /role="dialog"/);
assert.match(source, /needsReason && !reason\.trim\(\)/);
assert.match(source, /viewMode === "ARCHIVE"/);
assert.match(source, /lg:grid-cols-2/);
assert.match(source, /min-h-11/);
assert.match(source, /dark:/);

for (const fakeMetric of ["Critical", "Risk", "Blocker", "AI score"]) {
  assert.ok(!source.includes(fakeMetric), `fake KPI found: ${fakeMetric}`);
}

assert.ok(
  !source.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "browser UI must not contain a service role key",
);
assert.ok(
  !source.includes(".from(\"field_tasks\")"),
  "UI must not directly delete from the database",
);

console.log("[PASS] field tasks UI behavior contract");
