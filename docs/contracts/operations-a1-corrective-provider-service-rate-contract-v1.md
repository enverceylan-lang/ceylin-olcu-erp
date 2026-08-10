# ENVerp Operations A1 Corrective Provider / Service Rate Contract V1

## PACKAGE

`OPERATIONS_A1_CORRECTIVE_PROVIDER_SERVICE_RATE`

## PURPOSE

Operations A1 commits `ProviderOperationActions` into the fresh-clone build.
That UI depends on provider service-rate, completion-earnings, and tailor-to-installation routing modules.
This contract binds that compile-time dependency closure to explicit domain behavior.

## SOURCE FILES

1. `src/lib/serviceRateEngine.ts`
2. `src/store/useServiceRateStore.ts`
3. `src/lib/tailorCompletionEarningsCoordinator.ts`
4. `src/lib/installationCompletionEarningsCoordinator.ts`
5. `src/lib/tailorCompletionInstallationCoordinator.ts`

## INVARIANTS

### SR-1 — Exact business scope

Service-rate resolution must match the exact
`tenantId + companyId + branchId + accountingPeriodId` scope.
A rate from another company, branch, tenant, or period must not be selected.

### SR-2 — Provider and service identity

Rate selection must match the exact provider customer, provider type, and service stock item.
No fallback to another provider or another service is permitted.

### SR-3 — Effective-date truth

Historical completion uses the rate effective at `occurredAt/completedAt`.
A later tariff must not rewrite an older completed job.

### SR-4 — Ambiguity fails closed

If the highest-priority effective-rate selection is ambiguous, resolution must reject rather than guess.

### STORE-1 — Append-only rate history

A new service-rate record is appended.
The same exact record may replay idempotently.
The same id with different payload must reject with `ID_CONFLICT`; silent overwrite is forbidden.

### TAILOR-1 — Tailor earnings only from completed tailor truth

Tailor earnings require:
- `operation.kind === TAILOR`,
- `operation.status === COMPLETED`,
- a completion timestamp,
- a provider identity,
- a sale,
- sewing-required production items,
- a linked sewing service,
- and an exact effective service rate.

The calculation uses production breakdown when present and does not invent missing truth.

### INSTALL-1 — Installation earnings distinguish internal vs external

Internal installation creates no provider earning.
External installation requires provider identity and exact installation service-rate truth.
The earnings amount is derived from sale/production quantity and the completion-date rate.

### INSTALL-2 — Provider earning bridge remains ledger-based

Automatic installation earning is created through the provider earnings bridge.
It must not directly mutate a balance.
Replay must remain replay-safe through the downstream earnings contract.

### ROUTE-1 — Tailor completion is a prerequisite

`routeInstallationAfterTailorCompletion` rejects non-tailor and non-completed operations before reading mutable routing state.

### ROUTE-2 — No installer fallback

If installation is required but no valid assigned installer exists, routing waits.
It must not silently choose another installer.

### ROUTE-3 — Exact scoped main-operation routing

When routing installation, the parent/main operation lookup must preserve exact
`tenantId + companyId + branchId + accountingPeriodId + saleId` scope.

### ROUTE-4 — Route through canonical operation mutation

Installation child creation must use the canonical operation routing/store path.
The coordinator must not directly mutate operation state.

## BEHAVIOR TESTS

Existing proven tests:

- `tests/serviceRateEngine.test.ts`
  - historical effective-date selection,
  - later tariff does not rewrite past work,
  - provider isolation,
  - company isolation,
  - service-cost calculation.

- `tests/serviceRateStore.test.ts`
  - append-only create,
  - exact replay,
  - same-id/different-payload conflict with no silent overwrite.

- `tests/packageA1ProviderCariFinanceSuite.ts`
  - completed tailor earnings use effective completion-date sewing rate,
  - production breakdown is used for service quantity.

- `tests/installationCompletionEarningsCoordinatorSuite.ts`
  - external installation M2 earnings,
  - production breakdown,
  - internal installer no provider earning,
  - provider earning finalization wiring.

Corrective behavior test added by this package:

- `tests/tailorCompletionInstallationCoordinatorSuite.ts`
  - non-tailor fails closed before routing,
  - incomplete tailor fails closed before routing.

Corrective manifest contract test:

- `tests/operationsA1CorrectiveDependencyContractSuite.ts`
  - all five source files are bound by this contract,
  - all required behavior-test ownership references are present,
  - ProviderOperationActions retains the compile-time imports that make this dependency closure mandatory.

## DEPENDENCIES

All direct local imports of these five sources, except `serviceRateEngine.ts`,
were proven tracked-clean before this contract package.
`serviceRateEngine.ts` is intentionally part of this same corrective package.

## DO NOT CHANGE WITHOUT

Do not change these files or remove them from an Operations A1 release without re-running:

1. the behavior tests listed above,
2. the corrective manifest contract suite,
3. ESLint,
4. TypeScript,
5. local production build,
6. dependency-closure proof,
7. commit-tree / fresh-clone build proof,
8. exact-stage and cached diff checks,
9. Vercel READY verification after push.

No fallback, no silent overwrite, no cross-scope rate selection, and no direct finance balance mutation.
## Provider Status API Drift Closure

This corrective release also owns `src/lib/providerOperationStatusService.ts` because the already-tracked `src/components/operations/ProviderOperationActions.tsx` calls `getProviderStatusActionLabel(action, link.providerType)` while HEAD previously exposed only the one-argument service signature.

### Invariants

- `PS-1` `getProviderStatusActionLabel` accepts the optional provider type without changing generic provider transition rules.
- `PS-2` `START` for `TAILOR` is presented as `Planlamaya Başla`.
- `PS-3` `START` for `INSTALLER` or an unspecified provider type remains `İşe Başla`.
- `PS-4` The UI continues to pass `link.providerType`; the corrective fix must not remove the second argument to hide the API mismatch.
- `PS-5` This API drift closure does not pull unrelated dirty `productionBridge.ts`, `localCustomerDb.ts`, or montage-page work into the corrective release.
- `PS-6` Fresh-clone / simulated commit-tree TypeScript and production build must pass before exact staging.

### Contract tests

- `tests/tailorPortalPlanningSemanticsSuite.ts`
- `tests/providerStatusServiceCorrectiveContractSuite.ts`

### Regression evidence

- `tests/providerOperationActionsUiSuite.ts`
- `tests/providerOperationStatusServiceSuite.ts`
