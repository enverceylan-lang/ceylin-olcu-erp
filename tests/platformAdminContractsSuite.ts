import assert from "node:assert/strict";
import {
  assertPlatformMetadataOnly,
  buildPlatformCompanyLicenseView,
  canChangePlatformLicense,
  canReadPlatformCompanies,
  isLicenseEffectiveAt,
  isPlatformSuperAdmin,
  validatePlatformLicenseUpdate,
  type PlatformCompanyLicenseRecord
} from "../src/lib/platformAdminContracts";

assert.equal(
  isPlatformSuperAdmin({
    userId: "platform-1",
    role: "PLATFORM_SUPER_ADMIN"
  }),
  true
);

assert.equal(
  isPlatformSuperAdmin({
    userId: "admin-1",
    role: "ADMIN"
  }),
  false
);

assert.equal(
  canReadPlatformCompanies({
    userId: "support-1",
    role: "SUPPORT"
  }),
  false
);

assert.equal(
  canChangePlatformLicense({
    userId: "platform-1",
    role: "PLATFORM_SUPER_ADMIN"
  }),
  true
);

const validUpdate =
  validatePlatformLicenseUpdate({
    tenantId: "tenant-1",
    companyId: "company-1",

    package: "STANDARD",
    licenseActive: true,

    licenseStartsAt:
      "2026-07-01T00:00:00.000Z",

    licenseEndsAt:
      "2027-07-01T00:00:00.000Z",

    branchLimit: 3,
    userLimit: 25,

    changedByUserId:
      "platform-1",

    changedAt:
      "2026-07-28T09:30:00.000Z"
  });

assert.deepEqual(
  validUpdate,
  {
    valid: true,
    normalizedPackage: "NORMAL"
  }
);

assert.deepEqual(
  validatePlatformLicenseUpdate({
    tenantId: "tenant-1",
    companyId: "company-1",

    package: "PLUS",
    licenseActive: true,

    licenseStartsAt:
      "2027-01-01T00:00:00.000Z",

    licenseEndsAt:
      "2026-01-01T00:00:00.000Z",

    branchLimit: 1,
    userLimit: 10,

    changedByUserId:
      "platform-1",

    changedAt:
      "2026-07-28T09:30:00.000Z"
  }),
  {
    valid: false,
    reason: "DATE_RANGE_INVALID"
  }
);

assert.deepEqual(
  validatePlatformLicenseUpdate({
    tenantId: "tenant-1",
    companyId: "company-1",

    package: "ECO",
    licenseActive: true,

    licenseStartsAt:
      "2026-01-01T00:00:00.000Z",

    branchLimit: 0,
    userLimit: 10,

    changedByUserId:
      "platform-1",

    changedAt:
      "2026-07-28T09:30:00.000Z"
  }),
  {
    valid: false,
    reason:
      "BRANCH_LIMIT_INVALID"
  }
);

const record:
  PlatformCompanyLicenseRecord = {
    tenantId: "tenant-1",
    companyId: "company-1",

    companyCode: "CEYLIN",
    companySlug: "ceylinperde",
    companyName: "Ceylin Perde",

    package: "NORMAL",

    licenseActive: true,

    licenseStartsAt:
      "2026-01-01T00:00:00.000Z",

    licenseEndsAt:
      "2027-01-01T00:00:00.000Z",

    branchLimit: 3,
    userLimit: 25,

    createdAt:
      "2026-01-01T00:00:00.000Z",

    updatedAt:
      "2026-07-28T09:30:00.000Z"
  };

const view =
  buildPlatformCompanyLicenseView(
    record
  );

assert.equal(
  view.package,
  "NORMAL"
);

assert.equal(
  view.packageLabel,
  "STANDARD"
);

assert.equal(
  isLicenseEffectiveAt(
    record,
    "2026-07-28T09:30:00.000Z"
  ),
  true
);

assert.equal(
  isLicenseEffectiveAt(
    {
      ...record,
      licenseActive: false
    },
    "2026-07-28T09:30:00.000Z"
  ),
  false
);

assert.doesNotThrow(() =>
  assertPlatformMetadataOnly({
    companies: [
      {
        tenantId: "tenant-1",
        companyId: "company-1",
        companyName: "Ceylin Perde",
        package: "NORMAL",
        licenseActive: true
      }
    ]
  })
);

assert.throws(
  () =>
    assertPlatformMetadataOnly({
      companies: [
        {
          companyId: "company-1",
          sales: [
            {
              totalAmount: 1000
            }
          ]
        }
      ]
    }),
  /PLATFORM_OPERATIONAL_DATA_FORBIDDEN/
);

assert.throws(
  () =>
    assertPlatformMetadataOnly({
      companyId: "company-1",
      finance: {
        balance: 5000
      }
    }),
  /PLATFORM_OPERATIONAL_DATA_FORBIDDEN/
);

console.log(
  "PLATFORM_ADMIN_CONTRACTS_TEST: PAK"
);