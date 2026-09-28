import assert from "node:assert/strict";
import { shouldPreferRemoteSyncName } from "../src/lib/syncFallbackNameRepair";

const oldRemote = "2026-09-25T09:00:00.000Z";
const newLocal = "2026-09-28T09:00:00.000Z";
const newerRemote = "2026-09-29T09:00:00.000Z";

assert.equal(
  shouldPreferRemoteSyncName({
    localName: "Gelen Oda",
    remoteName: "9 C SALON NO 3",
    localUpdatedAt: newLocal,
    remoteUpdatedAt: oldRemote,
    fallbackName: "Gelen Oda",
  }),
  true,
  "fallback room name must be repaired by exact remote parent name even when remote timestamp is older",
);

assert.equal(
  shouldPreferRemoteSyncName({
    localName: "Gelen Açıklık",
    remoteName: "Diğer cam",
    localUpdatedAt: newLocal,
    remoteUpdatedAt: oldRemote,
    fallbackName: "Gelen Açıklık",
  }),
  true,
  "fallback opening name must be repaired by exact remote parent name even when remote timestamp is older",
);

assert.equal(
  shouldPreferRemoteSyncName({
    localName: "SALON",
    remoteName: "ESKİ SALON",
    localUpdatedAt: newLocal,
    remoteUpdatedAt: oldRemote,
    fallbackName: "Gelen Oda",
  }),
  false,
  "a real local room name must keep the existing timestamp conflict policy",
);

assert.equal(
  shouldPreferRemoteSyncName({
    localName: "Gelen Oda",
    remoteName: "",
    localUpdatedAt: newLocal,
    remoteUpdatedAt: oldRemote,
    fallbackName: "Gelen Oda",
  }),
  false,
  "empty remote name must not erase a fallback value",
);

assert.equal(
  shouldPreferRemoteSyncName({
    localName: "SALON",
    remoteName: "YENİ SALON",
    localUpdatedAt: newLocal,
    remoteUpdatedAt: newerRemote,
    fallbackName: "Gelen Oda",
  }),
  true,
  "normal records must preserve the existing newer-remote timestamp behavior",
);

console.log("PAK_SYNC_FALLBACK_NAME_REPAIR");
