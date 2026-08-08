import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  decideOperationRelease,
  type OperationDependencySignal
} from "../src/lib/operationDependencyReleasePolicy";
import {
  decideOperationTransition,
  type OperationRecord
} from "../src/lib/operationsWorkflow";
import { updateOperationRecordStatus } from "../src/lib/operationsRepository";

function dependency(
  id: string,
  state: OperationDependencySignal["state"],
  required = true
): OperationDependencySignal {
  return {
    id,
    label: id,
    required,
    state
  };
}

{
  const result = decideOperationRelease({
    dependencies: []
  });

  assert.equal(result.state, "RELEASED");
  assert.equal(result.released, true);
  assert.deepEqual(result.waitingDependencyIds, []);
  assert.deepEqual(result.blockedDependencyIds, []);
}

{
  const result = decideOperationRelease({
    dependencies: [
      dependency("material", "SATISFIED"),
      dependency("predecessor", "WAITING")
    ]
  });

  assert.equal(result.state, "WAITING_DEPENDENCY");
  assert.equal(result.released, false);
  assert.deepEqual(result.waitingDependencyIds, [
    "predecessor"
  ]);
}

{
  const result = decideOperationRelease({
    dependencies: [
      dependency("material", "BLOCKED"),
      dependency("predecessor", "WAITING")
    ]
  });

  assert.equal(result.state, "BLOCKED");
  assert.equal(result.released, false);
  assert.deepEqual(result.blockedDependencyIds, [
    "material"
  ]);
  assert.deepEqual(result.waitingDependencyIds, [
    "predecessor"
  ]);
}

{
  const result = decideOperationRelease({
    dependencies: [
      dependency("optional-evidence", "WAITING", false)
    ]
  });

  assert.equal(result.state, "RELEASED");
  assert.equal(result.released, true);
}

{
  const result = decideOperationRelease({
    dependencies: [
      dependency("material", "SATISFIED")
    ],
    blockers: [
      {
        code: "MANUAL_BLOCK",
        message: "Explicit blocker"
      }
    ]
  });

  assert.equal(result.state, "BLOCKED");
  assert.equal(result.released, false);
  assert.equal(result.blockers.length, 1);
}

{
  const dependencies = [
    dependency("child-b", "WAITING"),
    dependency("child-a", "WAITING")
  ] as const;

  const snapshot = JSON.stringify(dependencies);
  const first = decideOperationRelease({
    dependencies
  });
  const second = decideOperationRelease({
    dependencies
  });

  assert.equal(JSON.stringify(dependencies), snapshot);
  assert.deepEqual(first, second);
  assert.deepEqual(first.waitingDependencyIds, [
    "child-a",
    "child-b"
  ]);
}

const transitionBase: OperationRecord = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1",
  id: "operation-release-1",
  idempotencyKey: "TAILOR:sale-1:release-1",
  kind: "TAILOR",
  sourceId: "sale-1",
  saleId: "sale-1",
  customerId: "customer-1",
  customerName: "Customer",
  title: "Tailor work",
  details: [],
  party: { id: "tailor-1", userId: "tailor-1", name: "Tailor" },
  scheduledAt: "2026-08-08T08:00:00.000Z",
  dueAt: "2026-08-08T16:00:00.000Z",
  status: "ASSIGNED",
  createdByUserId: "admin-1",
  createdAt: "2026-08-08T07:00:00.000Z",
  updatedAt: "2026-08-08T07:00:00.000Z"
};

{
  const waiting = decideOperationTransition(
    transitionBase, "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    { release: { dependencies: [dependency("material", "WAITING")] } }
  );
  assert.deepEqual(waiting, { allowed: false, reason: "OPERATION_RELEASE_WAITING" });
}

{
  const blocked = decideOperationTransition(
    transitionBase, "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    { release: { dependencies: [dependency("material", "BLOCKED")] } }
  );
  assert.deepEqual(blocked, { allowed: false, reason: "OPERATION_RELEASE_BLOCKED" });
}

{
  const released = decideOperationTransition(
    transitionBase, "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    { release: { dependencies: [dependency("material", "SATISFIED")] } }
  );
  assert.equal(released.allowed, true);
}

{
  const acceptedWhileWaiting = decideOperationTransition(
    transitionBase, "ACCEPTED",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    { release: { dependencies: [dependency("material", "WAITING")] } }
  );
  assert.equal(acceptedWhileWaiting.allowed, true);
}

{
  const legacyCaller = decideOperationTransition(
    transitionBase, "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z"
  );
  assert.equal(legacyCaller.allowed, true);
}

console.log("[PASS] operation dependency/release transition wiring contract");

console.log("[PASS] operation dependency/release policy contract");

{
  const repositoryState = {
    operations: [transitionBase],
    agendaEvents: []
  };

  const waiting = updateOperationRecordStatus(
    repositoryState,
    transitionBase.id,
    "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    {
      release: {
        dependencies: [dependency("material", "WAITING")]
      }
    }
  );

  assert.equal(waiting.outcome, "REJECTED");
  if (waiting.outcome === "REJECTED") {
    assert.equal(
      waiting.reason,
      "OPERATION_RELEASE_WAITING"
    );
  }

  const released = updateOperationRecordStatus(
    repositoryState,
    transitionBase.id,
    "IN_PROGRESS",
    { userId: "tailor-1", role: "TAILOR" },
    "2026-08-08T09:00:00.000Z",
    {
      release: {
        dependencies: [dependency("material", "SATISFIED")]
      }
    }
  );

  assert.equal(released.outcome, "UPDATED");
}

console.log("[PASS] repository forwards release context");

{
  const providerCommandSource = readFileSync(
    new URL(
      "../src/lib/providerOperationStatusCommandService.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    providerCommandSource,
    /context\?: OperationTransitionContext/
  );
  assert.match(
    providerCommandSource,
    /decideOperationRelease\(/
  );
  assert.match(
    providerCommandSource,
    /OPERATION_RELEASE_WAITING/
  );
  assert.match(
    providerCommandSource,
    /OPERATION_RELEASE_BLOCKED/
  );
}

console.log("[PASS] provider command release wiring contract");
