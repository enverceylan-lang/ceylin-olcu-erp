# ENVERP CUSTOMER / MEASUREMENT IDENTITY CONTRACT V1

## Status

Integration candidate: PAK

Production deployed behavior: KANITLANMADI
Live end-to-end runtime: KANITLANMADI

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

## Explicit boundary

tests/measurementAuthorityContinuationSuite.ts is not used as Gate 4 closure
evidence.

Its observed failure concerns an exact-text expectation in Media source outside
the Gate 4 owned mutation boundary. It is recorded as:

FOREIGN / PRE-EXISTING KANITLANMADI

No Media source mutation is authorized by this contract.

## Release state

The verified state is an uncommitted integration candidate.

This contract does not prove:
- main merge
- push
- deployment
- production freshness
- live end-to-end runtime

Those require separate evidence and separate authorization.