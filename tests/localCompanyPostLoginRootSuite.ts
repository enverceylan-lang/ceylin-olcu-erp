import assert from "node:assert/strict";

import {
  decideLocalSurfaceRequest,
} from "../src/lib/localSurface";

const loggedOutRoot =
  decideLocalSurfaceRequest({
    surface: "COMPANY",
    pathname: "/",
    localCompanySlug: "ceylinperde",
    hasActiveCompanySlug: false,
    hasCompanySlugInPath: false,
  });

assert.deepEqual(
  loggedOutRoot,
  {
    action: "REDIRECT",
    pathname: "/ceylinperde",
  },
);

const loggedInRoot =
  decideLocalSurfaceRequest({
    surface: "COMPANY",
    pathname: "/",
    localCompanySlug: "ceylinperde",
    hasActiveCompanySlug: true,
    hasCompanySlugInPath: false,
  });

assert.deepEqual(
  loggedInRoot,
  {
    action: "NEXT",
  },
);

console.log(
  "LOCAL_COMPANY_POSTLOGIN_ROOT_SUITE: PAK",
);