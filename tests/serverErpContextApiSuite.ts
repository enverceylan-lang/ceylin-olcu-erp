import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildShadowErpContextApiResponse } from "../src/lib/serverErpContextApi";

assert.deepEqual(
  buildShadowErpContextApiResponse({
    ready: false,
    reason: "USER_SCOPE_NOT_FOUND",
  }),
  {
    status: 200,
    body: {
      success: true,
      mode: "shadow",
      configured: false,
      reason: "USER_SCOPE_NOT_FOUND",
    },
  }
);

assert.deepEqual(
  buildShadowErpContextApiResponse({
    ready: false,
    reason: "READ_FAILED",
  }),
  {
    status: 503,
    body: {
      success: false,
      mode: "shadow",
      error: "ERP_CONTEXT_READ_FAILED",
    },
  }
);

assert.deepEqual(
  buildShadowErpContextApiResponse({
    ready: true,
    scope: {
      tenantId: "tenant-uuid",
      companyId: "company-uuid",
      branchId: "branch-uuid",
      accountingPeriodId: "period-uuid",
    },
    package: "PLUS",
    featureOverrides: {},
  }),
  {
    status: 200,
    body: {
      success: true,
      mode: "shadow",
      configured: true,
      context: {
        ready: true,
        scope: {
          tenantId: "tenant-uuid",
          companyId: "company-uuid",
          branchId: "branch-uuid",
          accountingPeriodId: "period-uuid",
        },
        package: "PLUS",
        featureOverrides: {},
      },
    },
  }
);

const readyWithRole = buildShadowErpContextApiResponse(
  {
    ready: true,
    scope: {
      tenantId: "tenant-uuid",
      companyId: "company-uuid",
      branchId: "branch-uuid",
      accountingPeriodId: "period-uuid",
    },
    package: "ECO",
    featureOverrides: {},
  },
  "OFFICE",
  "shadow"
);
assert.equal(readyWithRole.status, 200);
assert.equal(
  readyWithRole.body.success &&
    readyWithRole.body.configured &&
    readyWithRole.body.accessSummary?.evaluatedFeatureCount,
  16
);
assert.equal(
  readyWithRole.body.success &&
    readyWithRole.body.configured &&
    readyWithRole.body.accessSummary?.differenceCount,
  1
);
assert.equal(
  readyWithRole.body.success &&
    readyWithRole.body.configured &&
    readyWithRole.body.measurementPilot?.configured &&
    readyWithRole.body.measurementPilot.mode,
  "shadow"
);

const routeSource = readFileSync(
  resolve(process.cwd(), "src/app/api/erp-context/route.ts"),
  "utf8"
);

assert.match(routeSource, /await verifyAuth\(req\)/);
assert.match(
  routeSource,
  /loadShadowErpContext\(supabaseServer, user\.id, \{[\s\S]*?requestedScopeId: readRequestedErpScopeId\(req\),[\s\S]*?\}\)/
);
assert.match(
  routeSource,
  /import \{ readRequestedErpScopeId \} from "@\/lib\/erpActiveScopeCookie"/
);
assert.match(
  routeSource,
  /process\.env\.ERP_PACKAGE_ENFORCEMENT_MODE/
);
assert.match(routeSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(routeSource, /Cache-Control/);
assert.match(routeSource, /no-store/);
assert.match(routeSource, /status:\s*401/);
assert.doesNotMatch(routeSource, /req\.json\(\)/);
assert.doesNotMatch(routeSource, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);

console.log("[PASS] server ERP shadow context API contract");
