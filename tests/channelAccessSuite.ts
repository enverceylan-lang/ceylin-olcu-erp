import assert from "node:assert/strict";
import {
  ERP_CHANNELS,
  buildChannelAccessKey,
  decideChannelAccess,
  normalizeErpChannel,
} from "../src/lib/channelAccess";

assert.deepEqual(
  ERP_CHANNELS,
  ["WEB", "MOBILE", "DESKTOP"],
);

assert.equal(
  normalizeErpChannel("web"),
  "WEB",
);

assert.equal(
  normalizeErpChannel(" mobile "),
  "MOBILE",
);

assert.equal(
  normalizeErpChannel("api"),
  null,
);

assert.deepEqual(
  decideChannelAccess({
    channel: "WEB",
    licenseActive: true,
    userScopeActive: true,
    licenseAllows: true,
    userScopeAllows: true,
  }),
  {
    allowed: true,
    channel: "WEB",
    reason: "ALLOWED",
  },
);

assert.equal(
  decideChannelAccess({
    channel: "WEB",
    licenseActive: true,
    userScopeActive: true,
    licenseAllows: false,
    userScopeAllows: true,
  }).reason,
  "LICENSE_CHANNEL_DENIED",
);

assert.equal(
  decideChannelAccess({
    channel: "WEB",
    licenseActive: true,
    userScopeActive: true,
    licenseAllows: true,
    userScopeAllows: false,
  }).reason,
  "USER_SCOPE_CHANNEL_DENIED",
);

assert.equal(
  decideChannelAccess({
    channel: "MOBILE",
    licenseActive: false,
    userScopeActive: true,
    licenseAllows: true,
    userScopeAllows: true,
  }).reason,
  "LICENSE_INACTIVE",
);

assert.equal(
  decideChannelAccess({
    channel: "DESKTOP",
    licenseActive: true,
    userScopeActive: false,
    licenseAllows: true,
    userScopeAllows: true,
  }).reason,
  "USER_SCOPE_INACTIVE",
);

assert.equal(
  buildChannelAccessKey(
    "scope-1",
    "MOBILE",
  ),
  "scope-1:MOBILE",
);

assert.throws(
  () =>
    buildChannelAccessKey(
      "",
      "WEB",
    ),
  /CHANNEL_ACCESS_SCOPE_REQUIRED/,
);

console.log(
  "CHANNEL_ACCESS_TEST: PAK",
);