import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {
  filterFieldTasksByView,
  isArchivedFieldTask,
} from "../src/lib/fieldTaskViewPolicy";
import {
  listAllFieldTasks,
  listArchivedFieldTasks,
  localFieldTaskDb,
  reconcileAuthoritativeRemoteFieldTasks,
  type FieldTask,
} from "../src/lib/localFieldTaskDb";

const activeTask = {
  id: "active-task",
  status: "MEASUREMENT_STARTED",
  archivedAt: undefined,
};

const archivedTask = {
  id: "archived-task",
  status: "CANCELLED",
  archivedAt: "2026-08-11T00:00:00.000Z",
};

const mixedTasks = [activeTask, archivedTask];

assert.deepEqual(
  filterFieldTasksByView(mixedTasks, "ACTIVE").map(task => task.id),
  ["active-task"],
  "ACTIVE must contain only tasks without archivedAt",
);

assert.deepEqual(
  filterFieldTasksByView(mixedTasks, "ARCHIVE").map(task => task.id),
  ["archived-task"],
  "ARCHIVE must contain only tasks with archivedAt",
);

assert.equal(isArchivedFieldTask(activeTask), false);
assert.equal(isArchivedFieldTask(archivedTask), true);

const archivedAfterLifecycle = {
  ...activeTask,
  status: "CANCELLED",
  archivedAt: "2026-08-11T00:05:00.000Z",
};

assert.equal(
  filterFieldTasksByView([archivedAfterLifecycle], "ACTIVE").length,
  0,
  "CANCEL + ARCHIVE must leave ACTIVE",
);
assert.equal(
  filterFieldTasksByView([archivedAfterLifecycle], "ARCHIVE").length,
  1,
  "CANCEL + ARCHIVE must enter ARCHIVE",
);

const restoredTask = {
  ...archivedAfterLifecycle,
  archivedAt: undefined,
};

assert.equal(
  filterFieldTasksByView([restoredTask], "ARCHIVE").length,
  0,
  "RESTORE must leave ARCHIVE",
);
assert.equal(
  filterFieldTasksByView([restoredTask], "ACTIVE").length,
  1,
  "RESTORE must return to ACTIVE",
);

const now = "2026-08-11T00:00:00.000Z";
const canonicalActiveTask: FieldTask = {
  id: "canonical-active-task",
  customerId: "customer-1",
  customerName: "Active Customer",
  assignedUserId: "user-1",
  assignedUserName: "Field User",
  assignedById: "admin-1",
  assignedByName: "Admin",
  status: "MEASUREMENT_STARTED",
  createdAt: now,
  updatedAt: now,
};
const canonicalArchivedTask: FieldTask = {
  ...canonicalActiveTask,
  id: "canonical-archived-task",
  customerId: "customer-2",
  customerName: "Archived Customer",
  status: "CANCELLED",
  archivedAt: "2026-08-11T00:05:00.000Z",
};

async function verifyCanonicalLocalLists() {
  await localFieldTaskDb.fieldTasks.clear();
  await localFieldTaskDb.fieldTasks.bulkPut([
    canonicalActiveTask,
    canonicalArchivedTask,
  ]);

  assert.deepEqual(
    (await listAllFieldTasks()).map(task => task.id),
    ["canonical-active-task"],
    "canonical active list must exclude archived records",
  );
  assert.deepEqual(
    (await listArchivedFieldTasks()).map(task => task.id),
    ["canonical-archived-task"],
    "canonical archive list must exclude active records",
  );

  const knownRemoteA: FieldTask = {
    ...canonicalActiveTask,
    id: "known-remote-a",
    remoteKnownAt: now,
  };
  const staleKnownRemoteB: FieldTask = {
    ...canonicalActiveTask,
    id: "stale-known-remote-b",
    remoteKnownAt: now,
  };
  const protectedLocalDraft: FieldTask = {
    ...canonicalActiveTask,
    id: "protected-local-draft",
    remoteKnownAt: undefined,
  };

  await localFieldTaskDb.fieldTasks.clear();
  await localFieldTaskDb.fieldTasks.bulkPut([
    knownRemoteA,
    staleKnownRemoteB,
    protectedLocalDraft,
  ]);

  const reconciliation = await reconcileAuthoritativeRemoteFieldTasks({
    tasks: [{ ...knownRemoteA, updatedAt: "2026-08-11T01:00:00.000Z" }],
    remoteKnownAt: "2026-08-11T01:00:01.000Z",
  });
  const reconciledIds = (
    await localFieldTaskDb.fieldTasks.orderBy("id").toArray()
  ).map(task => task.id);

  assert.deepEqual(
    reconciliation.removedTaskIds,
    ["stale-known-remote-b"],
    "known-remote B absent from an authoritative response must be removed",
  );
  assert.deepEqual(
    reconciledIds,
    ["known-remote-a", "protected-local-draft"],
    "authoritative reconciliation must retain remote A and protect a genuine local draft",
  );
  assert.equal(
    (await localFieldTaskDb.fieldTasks.get("known-remote-a"))?.remoteKnownAt,
    "2026-08-11T01:00:01.000Z",
    "authoritative remote records must retain remote provenance",
  );

  await localFieldTaskDb.delete();
}

void verifyCanonicalLocalLists()
  .then(() => {
    console.log("[PASS] field task view isolation behavior");
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
