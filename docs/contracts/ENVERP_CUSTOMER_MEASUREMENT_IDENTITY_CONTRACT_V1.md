# ENVERP CUSTOMER / MEASUREMENT IDENTITY CONTRACT V1

## Status

Original Gate 4 integration candidate: PAK

Production deployed commit:
6352ce46fb4afcdeb7888b98c9adb368b06a25c4 = PAK

Production deployment artifact: PAK

Production manual measurement push at commit 6352ce4: DUR

Observed live behavior:
"Olculeri Gonder" returned failure while the production Topbar masked the
underlying result as an internet-connection message.

Manual-push wiring fix commit:
058e5d18c312930efd2b90f7fe9e5aabd6867e7a

Production deployment of 058e5d1: PAK

Live retry of the preserved measurement event at 058e5d1: DUR

Observed client error:

MEASUREMENT_PARENT_CANONICAL_ACK_FAILED:Internal server error

Current follow-up fix candidate:
source / targeted regression / TypeScript / production build = PAK

Live end-to-end retest of the current follow-up candidate: KANITLANMADI

This contract records the canonical customer, address and measurement identity
rules verified in the Customer Address Authority / Gate 4 integration candidate.

## Canonical identity hierarchy

- companyId identifies company scope.
- customerId identifies customer ownership.
- measurementId identifies the measurement.
- customerAddressId identifies an optional customer location.
- customerAddressId is not customer ownership.

Canonical ownership hierarchy:

companyId -> customerId -> measurementId

## Customer rule

A customer may be created with only a customer name.

Address, phone, map location and similar customer metadata are optional for
measurement workflow continuation.

## Address rule

No address:
- workflow may continue.

One address:
- workflow may continue.
- address detail fields may be empty.

Additional / multi-address:
- human-readable title is required where needed to distinguish addresses.

A supplied customerAddressId must belong to the same customer.
A customerAddressId belonging to another customer is invalid.

Two different customers may have identical textual addresses.
Text equality is not an ownership violation.

## Room and measurement rule

A room does not require customerAddressId.

A measurement does not require customerAddressId.

Missing customerAddressId must not by itself cause:
- CUSTOMER_ADDRESS_REQUIRED_FOR_ROOM
- SALE_CUSTOMER_ADDRESS_REQUIRED
- ordinary measurement workflow rejection.

If a customerAddressId is supplied, customer/address ownership integrity remains
mandatory.

## Sales rule

Missing address is not a global sales blocker.

If selected measurements contain more than one different real
customerAddressId and no explicit address resolves the ambiguity, the existing
mixed-address guard remains required.

Canonical preserved guard:

SALE_MIXED_CUSTOMER_ADDRESSES_UNSUPPORTED

## Sync boundary

Automatic customer sync carries customer/master data.

The measurement tree is not part of normal automatic customer push:

- Room
- Opening / Window
- Measurement
- measurement-bound details

These remain part of the manual measurement package.

Canonical manual flow:

Local measurement package
-> SOURCE_EXIT validation
-> explicit "Olculeri Gonder"
-> canonical parent customer ACK
-> delta-sync push
-> canonical measurement authority

Normal automatic customer sync must not push the nested measurement tree.

## Measurement write authority

The legacy /api/sync/customers path may read and merge measurements for response
compatibility.

It is not the canonical measurement writer.

Canonical measurement writes belong to the measurement authority / delta-sync
path.

## Scope isolation

Outbound and inbound sync remain scoped by ERP scope.

Cross-company data must not be accepted merely because it exists in a local
queue or aggregate.

Server-side scope validation remains the final safety wall.

## Data preservation

Gate 4 does not authorize deletion or cleanup of existing customer or
measurement records.

No live customer deletion.
No live measurement deletion.
No backfill.
No live SQL mutation.

Historical and field records remain valuable for diagnosis, regression,
development and real-usage verification.

## Gate 4 source evidence

Verified source boundaries include:

- src/app/cariler/[id]/page.tsx
- src/store/useStore.ts
- src/lib/salesAdapter.ts
- src/lib/syncService.ts
- src/app/api/sync/customers/route.ts
- src/lib/measurementParentAckGate.ts
- src/lib/deltaSyncClient.ts
- src/components/Topbar.tsx

## Gate 4 regression evidence

PAK:

- tests/cariEditMultiAddressContractSuite.ts
- tests/addressModelFinalClosurePhaseCSuite.ts
- tests/customerMeasurementParentAckContractSuite.ts
- tests/measurementSourceExitGateSuite.ts
- tests/measurementSourceExitQueueGateSuite.ts
- tests/measurementPendingInsertDeferredUpdateSuite.ts
- TypeScript noEmit
- Next.js production build
- git diff --check

## Live runtime delta evidence

The original Gate 4 candidate contained a canonical parent ACK helper and a
passing helper contract test.

Live production verification later proved that the real manual measurement
producer did not use that helper.

Exact observed producer path at deployed commit 6352ce4:

Topbar
-> pushDeltaSyncEvents
-> /api/delta-sync/push
-> persistMeasurementAuthorityCommand
-> persist_measurement_authority_v1

The real producer therefore bypassed the intended canonical parent ACK step.

Classification:

- parent ACK helper exists: PAK
- parent ACK helper contract: PAK
- real producer parent ACK wiring at deployed commit 6352ce4: DUR
- generic production "internet connection" error classification: DUR
- exact underlying phone event server error code: KANITLANMADI
- root cause class: PRODUCER WIRING GAP / SAME-LINE REGRESSION

The current fix candidate changes the real producer so that pending measurement
events project only their required canonical parent chain:

Customer
-> referenced Room
-> referenced Opening / Window
-> products: []

The parent projection is sent to /api/sync/customers first.

Only after a successful canonical parent ACK may the existing delta measurement
authority call continue.

The normal automatic customer synchronization rule remains unchanged:

rooms: []

The fix does not authorize or perform:

- live SQL
- customer deletion
- measurement deletion
- queue deletion
- queue cleanup
- backfill

The existing failed field measurement event must be preserved for live
regression verification after deployment of the fix.

Current fix candidate evidence:

- tests/customerMeasurementParentAckContractSuite.ts: PAK
- tests/measurementSourceExitQueueGateSuite.ts: PAK
- tests/measurementSourceExitGateSuite.ts: PAK
- tests/measurementPendingInsertDeferredUpdateSuite.ts: PAK
- tests/cariEditMultiAddressContractSuite.ts: PAK
- tests/addressModelFinalClosurePhaseCSuite.ts: PAK
- targeted regression: 6/6 PAK
- TypeScript noEmit: PAK
- Next.js production build: PAK
- git diff --check: PAK

The current source mutation boundary before ledger update is exactly:

- src/components/Topbar.tsx
- src/lib/deltaSyncClient.ts
- tests/customerMeasurementParentAckContractSuite.ts

Live runtime acceptance of this fix remains:

KANITLANMADI

## Post-release runtime RCA — 058e5d1

Historical source analysis identified the strongest first-bad architectural
commit as:

a840331 — feat: close measurement media authority and sync hardening

At a840331:

- persist_measurement_authority_v1 became the canonical measurement writer.
- the legacy measurement writer inside /api/sync/customers was removed.
- Customer / Room / Opening parent lifecycle closure was not wired into the
  real manual measurement producer at the same time.

Classification:

- measurement authority split: PAK
- required parent lifecycle closure at the split: DUR
- parent lifecycle gap: PAK
- CAB as the primary root cause: not supported by current evidence
- CAB exposing the pre-existing parent lifecycle gap: supported

At ef16bc9 a canonical parent ACK helper existed, but the real
pushDeltaSyncEvents producer did not use it.

At 058e5d1 the real producer was wired to the parent ACK flow.

Production deployment of 058e5d1 was Ready, but retrying the same preserved
field measurement event failed with:

MEASUREMENT_PARENT_CANONICAL_ACK_FAILED:Internal server error

Further exact-source review showed that the 058e5d1 parent projection used:

...customer

and therefore also carried customer addresses into /api/sync/customers.

That caused the manual measurement parent preflight to be coupled to the
Customer Address Authority even though address persistence is not required for
the measurement parent ACK.

Classification:

- 058e5d1 producer wiring exists: PAK
- 058e5d1 production manual measurement send: DUR
- 058e5d1 parent projection minimality: DUR
- measurement send -> Customer Address Authority coupling: DUR
- /api/sync/customers outer catch hides the inner server failure: PAK

The current follow-up candidate changes the parent projection to:

Customer
-> addresses: []
-> exact referenced Room
-> exact referenced Opening / Window
-> products: []

It also classifies /api/sync/customers server failures into safe public error
codes without exposing raw database error text.

Current follow-up candidate evidence:

- tests/customerMeasurementParentAckContractSuite.ts: PAK
- tests/measurementSourceExitQueueGateSuite.ts: PAK
- tests/measurementSourceExitGateSuite.ts: PAK
- tests/measurementPendingInsertDeferredUpdateSuite.ts: PAK
- tests/cariEditMultiAddressContractSuite.ts: PAK
- tests/addressModelFinalClosurePhaseCSuite.ts: PAK
- targeted regression: 6/6 PAK
- TypeScript noEmit: PAK
- Next.js production build: PAK
- git diff --check: PAK

No live SQL, queue deletion, customer deletion, measurement deletion, cleanup
or backfill is authorized or performed.

The same existing failed field measurement event remains the required live
runtime acceptance fixture.

Live runtime acceptance of the current follow-up candidate remains:

KANITLANMADI
## Explicit boundary

tests/measurementAuthorityContinuationSuite.ts is not used as Gate 4 closure
evidence.

Its observed failure concerns an exact-text expectation in Media source outside
the Gate 4 owned mutation boundary. It is recorded as:

FOREIGN / PRE-EXISTING KANITLANMADI

No Media source mutation is authorized by this contract.

## Release state

Historical released state:

- integration merge commit:
  6352ce46fb4afcdeb7888b98c9adb368b06a25c4
- integration branch push: PAK
- origin/main fast-forward to 6352ce4: PAK
- Vercel production deployment for 6352ce4: PAK
- production artifact status: Ready

Runtime evidence after that deployment:

- manual measurement push: DUR
- exact producer wiring defect: PAK
- exact underlying phone event server error code: KANITLANMADI

Current state:

The first manual-push parent ACK wiring correction was released as:

058e5d18c312930efd2b90f7fe9e5aabd6867e7a

Release evidence for 058e5d1:

- commit: PAK
- integration branch push: PAK
- origin/main fast-forward: PAK
- Vercel production deployment: PAK
- production status Ready: PAK
- live retry of the preserved field measurement event: DUR

The current follow-up parent-projection isolation and safe-diagnostic
correction is an uncommitted candidate.

Current follow-up source/test/build evidence is PAK.

This contract does not yet prove for the current follow-up candidate:

- commit
- push
- main update
- deployment
- production freshness
- successful live retry of the preserved field measurement event

Those remain separate release and runtime gates.

## 2026-09-15 - Measurement Package Authority source candidate

- Production commit `66fe80d306fba8e32f5a5b282aff5c95af7a1172` is Ready but the SAME preserved manual-measurement queue event still fails.
- Exact live classification: `MEASUREMENT_PARENT_CANONICAL_ACK_FAILED:SYNC_CUSTOMER_UPSERT_FAILED`.
- `/api/sync/customers` is rejected as measurement parent-preflight authority because it mutates customer master state before Room/Opening parent assurance.
- Candidate: `persist_measurement_package_authority_v1` verifies Customer, creates missing Room/Opening only for INSERT, verifies-only for UPDATE/SOFT_DELETE, and delegates measurement persistence to `persist_measurement_authority_v1` in the same PostgreSQL transaction.
- Existing Room/Opening rows are never updated by this package authority.
- Measurement INSERT additionally requires the canonical Customer to be active (`isDeleted=false`); UPDATE/SOFT_DELETE keep scope/parent verification without an active-customer resurrection rule.
- Non-null `customerAddressId` is verify-only against active same-customer same-scope `customer_addresses` before a missing Room is created.
- Concurrent parent creation uses `ON CONFLICT (id) DO NOTHING` followed by exact owner/scope verification.
- Legacy NULL scope rows fail closed with `IS DISTINCT FROM` checks.
- Client manual push enriches measurement events from the current local customer tree and no longer calls `/api/sync/customers` as a parent gate.
- Events without `parentPackage` keep the legacy `persist_measurement_authority_v1` server path for backward compatibility.
- LIVE SQL, staging, commit, push and deploy are not part of this source mutation approval.
- Global closure remains KANITLANMADI until separate LIVE SQL approval/application, production deployment, and success of the SAME preserved failed queue event without clearing/recreating it.
