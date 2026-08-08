export type OperationDependencyState =
  | "SATISFIED"
  | "WAITING"
  | "BLOCKED";

export type OperationReleaseState =
  | "RELEASED"
  | "WAITING_DEPENDENCY"
  | "BLOCKED";

export interface OperationDependencySignal {
  id: string;
  label: string;
  required: boolean;
  state: OperationDependencyState;
  reason?: string;
  sourceRef?: string;
}

export interface OperationReleaseBlocker {
  code: string;
  message: string;
  sourceRef?: string;
}

export interface OperationReleaseDecision {
  state: OperationReleaseState;
  released: boolean;
  waitingDependencyIds: string[];
  blockedDependencyIds: string[];
  blockers: OperationReleaseBlocker[];
}

function normalizedIds(
  dependencies: readonly OperationDependencySignal[],
  state: OperationDependencyState
): string[] {
  return dependencies
    .filter(
      dependency =>
        dependency.required && dependency.state === state
    )
    .map(dependency => dependency.id)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Operation release is an orchestration decision.
 *
 * Important:
 * - Material readiness may be represented as one dependency input.
 * - This policy does NOT calculate stock/material truth.
 * - This policy does NOT mutate operation, stock, production or finance state.
 */
export function decideOperationRelease(input: {
  dependencies: readonly OperationDependencySignal[];
  blockers?: readonly OperationReleaseBlocker[];
}): OperationReleaseDecision {
  const blockers = [...(input.blockers ?? [])];
  const blockedDependencyIds = normalizedIds(
    input.dependencies,
    "BLOCKED"
  );
  const waitingDependencyIds = normalizedIds(
    input.dependencies,
    "WAITING"
  );

  if (blockers.length > 0 || blockedDependencyIds.length > 0) {
    return {
      state: "BLOCKED",
      released: false,
      waitingDependencyIds,
      blockedDependencyIds,
      blockers
    };
  }

  if (waitingDependencyIds.length > 0) {
    return {
      state: "WAITING_DEPENDENCY",
      released: false,
      waitingDependencyIds,
      blockedDependencyIds,
      blockers
    };
  }

  return {
    state: "RELEASED",
    released: true,
    waitingDependencyIds,
    blockedDependencyIds,
    blockers
  };
}