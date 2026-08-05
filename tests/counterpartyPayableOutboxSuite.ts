import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCounterpartyPayableOutboxId,
  enqueueCounterpartyPayablePersistence,
  listCounterpartyPayableOutbox
} from "../src/lib/finance/counterpartyPayableOutbox";

const movement = {
  tenantId:
    "tenant-1",
  companyId:
    "company-1",
  branchId:
    "branch-1",
  accountingPeriodId:
    "period-1",
  id:
    "movement-1",
  idempotencyKey:
    "idem-1",
  counterpartyCustomerId:
    "supplier-1",
  counterpartyType:
    "SUPPLIER" as const,
  kind:
    "ACCRUAL" as const,
  amount:
    100,
  currency:
    "TRY" as const,
  occurredAt:
    "2026-08-05T00:00:00.000Z",
  recordedAt:
    "2026-08-05T00:00:00.000Z"
};

test(
  "outbox id is deterministic and enqueue is idempotent",
  () => {
    const first =
      enqueueCounterpartyPayablePersistence(
        movement
      );

    const second =
      enqueueCounterpartyPayablePersistence(
        movement
      );

    assert.equal(
      first.id,
      second.id
    );

    assert.equal(
      first.id,
      buildCounterpartyPayableOutboxId(
        movement
      )
    );

    assert.equal(
      listCounterpartyPayableOutbox()
        .filter(
          item =>
            item.id ===
            first.id
        )
        .length,
      1
    );
  }
);