import assert from "node:assert/strict";
import {
  decidePlatformSuperAdminAccess,
} from "../src/lib/platformAdminServerGuard";

assert.deepEqual(
  decidePlatformSuperAdminAccess(null),
  {
    allowed: false,
    status: 401,
    code: "UNAUTHORIZED",
  },
);

assert.deepEqual(
  decidePlatformSuperAdminAccess({
    id: "company-admin-1",
    role: "COMPANY_ADMIN",
  }),
  {
    allowed: false,
    status: 403,
    code: "PLATFORM_SUPER_ADMIN_REQUIRED",
  },
);

const allowed =
  decidePlatformSuperAdminAccess({
    id: "platform-1",
    role: "PLATFORM_SUPER_ADMIN",
  });

assert.equal(
  allowed.allowed,
  true,
);

console.log(
  "PLATFORM_ADMIN_SERVER_GUARD_TEST: PAK",
);