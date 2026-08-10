import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateServiceCost,
  resolveServiceRate,
  ServiceRate,
} from "../src/lib/serviceRateEngine";

const scope = {
  tenantId: "tenant-a",
  companyId: "company-a",
  branchId: "branch-a",
  accountingPeriodId: "2026",
};

const rates: ServiceRate[] = [
  {
    ...scope,
    id: "okan-tul-70",
    providerCustomerId: "okan",
    providerType: "TAILOR",
    serviceStockItemId: "tul-dikim",
    unit: "METER",
    unitPrice: 70,
    currency: "TRY",
    validFrom:
      "2026-01-01T00:00:00.000Z",
    validTo:
      "2026-09-01T00:00:00.000Z",
    active: true,
    createdAt:
      "2026-01-01T00:00:00.000Z",
  },
  {
    ...scope,
    id: "okan-tul-100",
    providerCustomerId: "okan",
    providerType: "TAILOR",
    serviceStockItemId: "tul-dikim",
    unit: "METER",
    unitPrice: 100,
    currency: "TRY",
    validFrom:
      "2026-09-01T00:00:00.000Z",
    active: true,
    createdAt:
      "2026-08-15T00:00:00.000Z",
  },
];

test(
  "gecmis is gecmis tarifeyi kullanir",
  () => {
    const result = resolveServiceRate({
      ...scope,
      rates,
      providerCustomerId: "okan",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      occurredAt:
        "2026-08-15T12:00:00.000Z",
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.rate.unitPrice,
      70,
    );
  },
);

test(
  "gelecek fiyat eski isi degistirmez",
  () => {
    const oldResult =
      resolveServiceRate({
        ...scope,
        rates,
        providerCustomerId: "okan",
        providerType: "TAILOR",
        serviceStockItemId: "tul-dikim",
        occurredAt:
          "2026-08-31T23:59:59.000Z",
      });

    const newResult =
      resolveServiceRate({
        ...scope,
        rates,
        providerCustomerId: "okan",
        providerType: "TAILOR",
        serviceStockItemId: "tul-dikim",
        occurredAt:
          "2026-09-01T00:00:00.000Z",
      });

    assert.equal(oldResult.ok, true);
    assert.equal(newResult.ok, true);

    if (
      !oldResult.ok ||
      !newResult.ok
    ) {
      return;
    }

    assert.equal(
      oldResult.rate.unitPrice,
      70,
    );

    assert.equal(
      newResult.rate.unitPrice,
      100,
    );
  },
);

test(
  "provider bazli tarife ayridir",
  () => {
    const muratRate: ServiceRate = {
      ...scope,
      id: "murat-tul-55",
      providerCustomerId: "murat",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      unit: "METER",
      unitPrice: 55,
      currency: "TRY",
      validFrom:
        "2026-01-01T00:00:00.000Z",
      active: true,
      createdAt:
        "2026-01-01T00:00:00.000Z",
    };

    const result = resolveServiceRate({
      ...scope,
      rates: [
        ...rates,
        muratRate,
      ],
      providerCustomerId: "murat",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      occurredAt:
        "2026-08-15T12:00:00.000Z",
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.rate.unitPrice,
      55,
    );
  },
);

test(
  "farkli sirket tarifesi asla kullanilmaz",
  () => {
    const foreignRate: ServiceRate = {
      ...scope,
      companyId: "company-b",
      id: "foreign",
      providerCustomerId: "okan",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      unit: "METER",
      unitPrice: 1,
      currency: "TRY",
      validFrom:
        "2026-08-01T00:00:00.000Z",
      active: true,
      createdAt:
        "2026-08-01T00:00:00.000Z",
    };

    const result = resolveServiceRate({
      ...scope,
      rates: [
        foreignRate,
        ...rates,
      ],
      providerCustomerId: "okan",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      occurredAt:
        "2026-08-15T12:00:00.000Z",
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      result.rate.unitPrice,
      70,
    );
  },
);

test(
  "10 metre x 70 TL = 700 TL hizmet maliyeti",
  () => {
    const result = resolveServiceRate({
      ...scope,
      rates,
      providerCustomerId: "okan",
      providerType: "TAILOR",
      serviceStockItemId: "tul-dikim",
      occurredAt:
        "2026-08-15T12:00:00.000Z",
    });

    assert.equal(result.ok, true);

    if (!result.ok) {
      return;
    }

    assert.equal(
      calculateServiceCost(
        result.rate,
        10,
      ),
      700,
    );
  },
);