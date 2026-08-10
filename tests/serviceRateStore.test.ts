import assert from "node:assert/strict";
import test from "node:test";

import type {
  ServiceRate,
} from "../src/lib/serviceRateEngine";
import {
  useServiceRateStore,
} from "../src/store/useServiceRateStore";

const rate: ServiceRate = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "2026",
  id: "rate-1",
  providerCustomerId: "okan",
  providerType: "TAILOR",
  serviceStockItemId: "tul-dikim",
  unit: "METER",
  unitPrice: 70,
  currency: "TRY",
  validFrom:
    "2026-01-01T00:00:00.000Z",
  active: true,
  createdAt:
    "2026-01-01T00:00:00.000Z",
};

test(
  "tarife append-only olusturulur ve ayni istek replay olur",
  () => {
    useServiceRateStore
      .getState()
      .replaceSnapshot([]);

    const first =
      useServiceRateStore
        .getState()
        .addRate(rate);

    const second =
      useServiceRateStore
        .getState()
        .addRate(rate);

    assert.equal(
      first.outcome,
      "CREATED",
    );

    assert.equal(
      second.outcome,
      "REPLAY",
    );

    assert.equal(
      useServiceRateStore
        .getState()
        .rates.length,
      1,
    );
  },
);

test(
  "ayni id farkli veri ile sessiz ezilmez",
  () => {
    useServiceRateStore
      .getState()
      .replaceSnapshot([rate]);

    const result =
      useServiceRateStore
        .getState()
        .addRate({
          ...rate,
          unitPrice: 100,
        });

    assert.deepEqual(
      result,
      {
        outcome: "REJECTED",
        reason: "ID_CONFLICT",
      },
    );

    assert.equal(
      useServiceRateStore
        .getState()
        .rates[0].unitPrice,
      70,
    );
  },
);