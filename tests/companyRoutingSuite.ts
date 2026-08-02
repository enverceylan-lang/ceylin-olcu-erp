import assert from "node:assert/strict";

import {
  getCompanySlugFromPath,
  isCompanyInternalPath,
  normalizeCompanyAppPath,
  withCompanyPrefix,
} from "../src/lib/companyRouting";

assert.equal(
  getCompanySlugFromPath(
    "/ceylinperde/cariler",
  ),
  "ceylinperde",
);

assert.equal(
  getCompanySlugFromPath(
    "/cariler",
  ),
  null,
);

assert.equal(
  normalizeCompanyAppPath(
    "/ceylinperde/ana-sayfa",
  ),
  "/",
);

assert.equal(
  normalizeCompanyAppPath(
    "/ceylinperde/cariler/123",
  ),
  "/cariler/123",
);

assert.equal(
  normalizeCompanyAppPath(
    "/cariler/123",
  ),
  "/cariler/123",
);

assert.equal(
  withCompanyPrefix(
    "/ceylinperde/cariler",
    "/satis",
  ),
  "/ceylinperde/satis",
);

assert.equal(
  withCompanyPrefix(
    "/ceylinperde/cariler",
    "/",
  ),
  "/ceylinperde/ana-sayfa",
);

assert.equal(
  withCompanyPrefix(
    "/cariler",
    "/satis",
  ),
  "/satis",
);

assert.equal(
  isCompanyInternalPath(
    "/ceylinperde/satis/123",
  ),
  true,
);

assert.equal(
  isCompanyInternalPath(
    "/ceylinperde",
  ),
  false,
);

console.log(
  "COMPANY_ROUTING_SUITE: PAK",
);