import assert from "node:assert/strict";
import {
  canViewInstallationTask,
  decideInstallationTaskCreation,
  decideInstallationTransition,
  type InstallationTask,
  type InstallationTaskRequest,
  type InstallationTaskStatus,
} from "../src/lib/installationWorkflow";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
};

function request(
  overrides: Partial<InstallationTaskRequest> = {}
): InstallationTaskRequest {
  return {
    ...scope,
    id: "installation-1",
    idempotencyKey: "installation:production-1",
    saleId: "sale-1",
    productionOrderId: "production-1",
    customerId: "customer-1",
    address: "Test adresi",
    productionStatus: "READY",
    qualityChecked: true,
    createdByUserId: "office-1",
    createdAt: "2026-07-26T09:00:00.000Z",
    ...overrides,
  };
}

const create = decideInstallationTaskCreation(request(), []);
assert.equal(create.outcome, "CREATE");
if (create.outcome !== "CREATE") {
  throw new Error("Montaj görevi oluşturulamadı.");
}
assert.equal(create.task.status, "READY_FOR_INSTALLATION");
assert.equal(create.audit.previousStatus, null);

assert.equal(
  decideInstallationTaskCreation(request(), [create.task]).outcome,
  "REPLAY"
);
const duplicate = decideInstallationTaskCreation(
  request({ id: "installation-2", idempotencyKey: "other-key" }),
  [create.task]
);
assert.equal(duplicate.outcome, "REJECT");
if (duplicate.outcome === "REJECT") {
  assert.equal(duplicate.reason, "DUPLICATE_PRODUCTION_ORDER");
}

const productionNotReady = decideInstallationTaskCreation(
  request({ productionStatus: "PACKAGING" }),
  []
);
assert.equal(productionNotReady.outcome, "REJECT");
if (productionNotReady.outcome === "REJECT") {
  assert.equal(productionNotReady.reason, "PRODUCTION_NOT_READY");
}

const unchecked = decideInstallationTaskCreation(
  request({ qualityChecked: false }),
  []
);
assert.equal(unchecked.outcome, "REJECT");
if (unchecked.outcome === "REJECT") {
  assert.equal(unchecked.reason, "QUALITY_CHECK_REQUIRED");
}

const office = { userId: "office-1", role: "OFFICE" };
const installer = { userId: "installer-1", role: "INSTALLER" };
const otherInstaller = { userId: "installer-2", role: "INSTALLER" };
let task: InstallationTask = create.task;

const sequence: Array<{
  target: InstallationTaskStatus;
  actor: typeof office;
  installerId?: string;
}> = [
  { target: "ASSIGNED", actor: office, installerId: "installer-1" },
  { target: "ACCEPTED", actor: installer },
  { target: "EN_ROUTE", actor: installer },
  { target: "IN_PROGRESS", actor: installer },
  { target: "COMPLETED", actor: installer },
  { target: "DELIVERED", actor: office },
];

for (const step of sequence) {
  const decision = decideInstallationTransition(
    task,
    step.target,
    step.actor,
    "2026-07-26T09:10:00.000Z",
    step.installerId
  );
  assert.equal(decision.allowed, true, `${step.target} reddedildi.`);
  if (decision.allowed) task = decision.task;
}
assert.equal(task.status, "DELIVERED");

const skipToComplete = decideInstallationTransition(
  create.task,
  "COMPLETED",
  installer,
  "2026-07-26T09:20:00.000Z"
);
assert.equal(skipToComplete.allowed, false);

const assigned = decideInstallationTransition(
  create.task,
  "ASSIGNED",
  office,
  "2026-07-26T09:30:00.000Z",
  "installer-1"
);
if (!assigned.allowed) throw new Error("Atama kurulamadı.");
assert.equal(canViewInstallationTask(assigned.task, installer), true);
assert.equal(canViewInstallationTask(assigned.task, otherInstaller), false);
const otherInstallerUpdate = decideInstallationTransition(
  assigned.task,
  "ACCEPTED",
  otherInstaller,
  "2026-07-26T09:40:00.000Z"
);
assert.equal(otherInstallerUpdate.allowed, false);
if (!otherInstallerUpdate.allowed) {
  assert.equal(otherInstallerUpdate.reason, "ASSIGNMENT_REQUIRED");
}

const terminalUpdate = decideInstallationTransition(
  task,
  "PROBLEM",
  office,
  "2026-07-26T09:50:00.000Z"
);
assert.equal(terminalUpdate.allowed, false);
if (!terminalUpdate.allowed) {
  assert.equal(terminalUpdate.reason, "TERMINAL_STATUS_LOCKED");
}

console.log("[PASS] installation workflow");
