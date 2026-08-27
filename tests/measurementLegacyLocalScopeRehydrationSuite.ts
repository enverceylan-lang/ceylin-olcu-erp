import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/store/useStore.ts", "utf8");

assert.match(
  source,
  /import \{ loadVerifiedClientErpScope \} from '@\/lib\/clientErpScope';/,
);
assert.match(
  source,
  /saveLocalCustomerWithoutSync/,
);
assert.match(
  source,
  /inheritConsistentErpScope,[\s\S]*readErpScope/,
);
assert.match(
  source,
  /const activeMeasurementScope = await loadVerifiedClientErpScope\(\s*authState\.sessionToken/,
);
assert.match(
  source,
  /inheritConsistentErpScope\([\s\S]*targetCustomer,[\s\S]*targetRoom,[\s\S]*targetOpening,[\s\S]*activeMeasurementScope,/,
);
assert.match(source, /requiresLegacyScopeRehydrate/);
assert.match(source, /!readErpScope\(targetCustomer\)/);
assert.match(source, /!readErpScope\(targetRoom\)/);
assert.match(source, /!readErpScope\(targetOpening\)/);
assert.match(source, /await saveLocalCustomerWithoutSync\(rehydratedCustomer\)/);
assert.match(
  source,
  /customer\.id === customerId \? rehydratedCustomer : customer/,
);
assert.match(source, /throw new Error\('MEASUREMENT_SCOPE_MISSING'\)/);

console.log("PAK_MEASUREMENT_LEGACY_LOCAL_SCOPE_REHYDRATION_V1_3");
