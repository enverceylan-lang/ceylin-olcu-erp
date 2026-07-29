import assert from "node:assert/strict";
import {
  decideCreateProviderAccountLink,
  resolveProviderAccountType
} from "../src/lib/providerAccountLinkService";

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-1"
};

const baseRequest = {
  ...scope,

  id: "provider-link-1",

  idempotencyKey:
    "PROVIDER-LINK:TAILOR-USER-1",

  user: {
    id: "tailor-user-1",
    role: "TAILOR",
    isActive: true
  },

  customer: {
    id: "tailor-cari-1",
    cariType: "TAILOR",
    isActive: true,
    isArchived: false
  },

  createdByUserId:
    "admin-1",

  now:
    "2026-07-29T09:00:00.000Z"
};

assert.equal(
  resolveProviderAccountType(
    "TAILOR"
  ),
  "TAILOR"
);

assert.equal(
  resolveProviderAccountType(
    "INSTALLER"
  ),
  "INSTALLER"
);

assert.equal(
  resolveProviderAccountType(
    "OFFICE"
  ),
  null
);

const created =
  decideCreateProviderAccountLink(
    baseRequest,
    []
  );

assert.equal(
  created.outcome,
  "CREATED"
);

if (created.outcome !== "CREATED") {
  throw new Error(
    "Terzi bağlantısı oluşturulamadı."
  );
}

assert.equal(
  created.link.providerCustomerId,
  "tailor-cari-1"
);

assert.equal(
  created.link.providerType,
  "TAILOR"
);

const replay =
  decideCreateProviderAccountLink(
    baseRequest,
    [created.link]
  );

assert.equal(
  replay.outcome,
  "REPLAY"
);

const wrongCustomerType =
  decideCreateProviderAccountLink(
    {
      ...baseRequest,

      id: "provider-link-2",

      idempotencyKey:
        "PROVIDER-LINK:WRONG-TYPE",

      customer: {
        ...baseRequest.customer,
        cariType: "INSTALLER"
      }
    },
    []
  );

assert.equal(
  wrongCustomerType.outcome,
  "REJECTED"
);

if (
  wrongCustomerType.outcome ===
  "REJECTED"
) {
  assert.equal(
    wrongCustomerType.reason,
    "CUSTOMER_TYPE_MISMATCH"
  );
}

const unsupportedRole =
  decideCreateProviderAccountLink(
    {
      ...baseRequest,

      id: "provider-link-3",

      idempotencyKey:
        "PROVIDER-LINK:OFFICE",

      user: {
        ...baseRequest.user,
        role: "OFFICE"
      }
    },
    []
  );

assert.equal(
  unsupportedRole.outcome,
  "REJECTED"
);

if (
  unsupportedRole.outcome ===
  "REJECTED"
) {
  assert.equal(
    unsupportedRole.reason,
    "ROLE_NOT_SUPPORTED"
  );
}

const duplicateActiveLink =
  decideCreateProviderAccountLink(
    {
      ...baseRequest,

      id: "provider-link-4",

      idempotencyKey:
        "PROVIDER-LINK:SECOND",

      customer: {
        ...baseRequest.customer,
        id: "tailor-cari-2"
      }
    },
    [created.link]
  );

assert.equal(
  duplicateActiveLink.outcome,
  "REJECTED"
);

if (
  duplicateActiveLink.outcome ===
  "REJECTED"
) {
  assert.equal(
    duplicateActiveLink.reason,
    "ACTIVE_LINK_ALREADY_EXISTS"
  );
}

const otherScope =
  decideCreateProviderAccountLink(
    {
      ...baseRequest,

      tenantId: "tenant-2",

      id: "provider-link-tenant-2",

      idempotencyKey:
        baseRequest.idempotencyKey
    },
    [created.link]
  );

assert.equal(
  otherScope.outcome,
  "CREATED"
);

console.log(
  "PROVIDER_ACCOUNT_LINK_SERVICE_TEST: PAK"
);