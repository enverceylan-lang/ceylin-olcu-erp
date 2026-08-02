import assert from "node:assert/strict";
import {
  buildSafePlatformCompanyViews
} from "../src/store/usePlatformAdminStore";

const views =
  buildSafePlatformCompanyViews([
    {
      tenantId: "tenant-1",
      companyId: "company-2",
      companyCode: "BETA",
      companySlug: "betaperde",
      companyName: "Beta Perde",
      package: "PLUS",
      licenseActive: true,
      licenseStartsAt:
        "2026-01-01T00:00:00.000Z",
      branchLimit: 5,
      userLimit: 50,
      createdAt:
        "2026-01-01T00:00:00.000Z",
      updatedAt:
        "2026-07-28T10:00:00.000Z"
    },
    {
      tenantId: "tenant-1",
      companyId: "company-1",
      companyCode: "ALFA",
      companySlug: "alfaperde",
      companyName: "Alfa Perde",
      package: "NORMAL",
      licenseActive: true,
      licenseStartsAt:
        "2026-01-01T00:00:00.000Z",
      branchLimit: 2,
      userLimit: 15,
      createdAt:
        "2026-01-01T00:00:00.000Z",
      updatedAt:
        "2026-07-28T10:00:00.000Z"
    }
  ]);

assert.equal(
  views.length,
  2
);

assert.equal(
  views[0].companyName,
  "Alfa Perde"
);

assert.equal(
  views[0].packageLabel,
  "STANDARD"
);

assert.throws(
  () =>
    buildSafePlatformCompanyViews(
      [
        {
          tenantId: "tenant-1",
          companyId: "company-1",
          companyCode: "ALFA",
          companyName: "Alfa Perde",
          package: "NORMAL",
          licenseActive: true,
          licenseStartsAt:
            "2026-01-01T00:00:00.000Z",
          branchLimit: 2,
          userLimit: 15,
          createdAt:
            "2026-01-01T00:00:00.000Z",
          updatedAt:
            "2026-07-28T10:00:00.000Z",
          sales: []
        } as never
      ]
    ),
  /PLATFORM_OPERATIONAL_DATA_FORBIDDEN/
);

console.log(
  "PLATFORM_ADMIN_STORE_TEST: PAK"
);