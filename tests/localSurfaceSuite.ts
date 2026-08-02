import assert from "node:assert/strict";

import {
  decideLocalSurfaceRequest,
  normalizeLocalCompanySlug,
  normalizeLocalSurface,
} from "../src/lib/localSurface";

assert.equal(
  normalizeLocalSurface("company"),
  "COMPANY",
);

assert.equal(
  normalizeLocalSurface("PLATFORM"),
  "PLATFORM",
);

assert.equal(
  normalizeLocalSurface(undefined),
  "SHARED",
);

assert.equal(
  normalizeLocalCompanySlug(
    "ceylinperde",
  ),
  "ceylinperde",
);

assert.equal(
  decideLocalSurfaceRequest({
    surface: "COMPANY",
    pathname: "/",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }).action,
  "REDIRECT",
);

assert.deepEqual(
  decideLocalSurfaceRequest({
    surface: "COMPANY",
    pathname:
      "/api/auth/login",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }),
  {
    action: "FORBID",
    code:
      "COMPANY_SURFACE_REQUIRED",
  },
);

assert.deepEqual(
  decideLocalSurfaceRequest({
    surface: "COMPANY",
    pathname:
      "/super-admin",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }),
  {
    action: "FORBID",
    code:
      "COMPANY_SURFACE_REQUIRED",
  },
);

assert.deepEqual(
  decideLocalSurfaceRequest({
    surface: "PLATFORM",
    pathname: "/",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }),
  {
    action: "REDIRECT",
    pathname: "/platform",
  },
);

assert.equal(
  decideLocalSurfaceRequest({
    surface: "PLATFORM",
    pathname:
      "/api/auth/login",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }).action,
  "NEXT",
);

assert.deepEqual(
  decideLocalSurfaceRequest({
    surface: "PLATFORM",
    pathname:
      "/api/auth/company-login",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      false,
  }),
  {
    action: "FORBID",
    code:
      "PLATFORM_SURFACE_REQUIRED",
  },
);

assert.deepEqual(
  decideLocalSurfaceRequest({
    surface: "PLATFORM",
    pathname:
      "/ceylinperde",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      true,
  }),
  {
    action: "FORBID",
    code:
      "PLATFORM_SURFACE_REQUIRED",
  },
);

assert.equal(
  decideLocalSurfaceRequest({
    surface: "SHARED",
    pathname:
      "/ceylinperde",
    localCompanySlug:
      "ceylinperde",
    hasActiveCompanySlug:
      false,
    hasCompanySlugInPath:
      true,
  }).action,
  "NEXT",
);

console.log(
  "LOCAL_SURFACE_TEST: PAK",
);