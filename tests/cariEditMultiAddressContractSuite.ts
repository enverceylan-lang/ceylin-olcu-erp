import assert from "node:assert/strict";
import fs from "node:fs";

const modal = fs.readFileSync(
  "src/components/modals/CariEditModal.tsx",
  "utf8",
);
const detail = fs.readFileSync(
  "src/app/cariler/[id]/page.tsx",
  "utf8",
);
const addressModal = fs.readFileSync(
  "src/components/modals/CustomerAddressModal.tsx",
  "utf8",
);
const store = fs.readFileSync("src/store/useStore.ts", "utf8");
const model = fs.readFileSync(
  "src/lib/customerAddressModel.ts",
  "utf8",
);

assert.match(modal, /data-cari-edit-address-tabs-v1/);
assert.match(modal, />\s*Ana Adres\s*</);
assert.match(modal, /\+ Adres Ekle/);
assert.match(modal, /activeCustomerAddresses/);
assert.match(modal, /customerAddressDisplayTitle/);
assert.match(modal, /ensureCustomerAddressIdentity/);
assert.match(modal, /addCustomerAddress/);
assert.match(modal, /updateCustomerAddress/);
assert.match(modal, /CustomerAddressModal/);

assert.doesNotMatch(detail, /Yeni Adres Ekle/);
assert.doesNotMatch(detail, /CustomerAddressModal/);
assert.doesNotMatch(detail, /handleAddAddress/);
assert.match(detail, /selectedCustomerAddressId/);
assert.match(detail, /ensureCustomerAddressIdentity/);
assert.match(
  detail,
  /onClick=\{\(\) => setIsEditModalOpen\(true\)\}/,
);

assert.match(addressModal, /Yeni Adres/);
assert.match(store, /customerAddressId\?: string/);
assert.match(store, /CUSTOMER_ADDRESS_REQUIRED_FOR_ROOM/);
assert.match(store, /CUSTOMER_ADDRESS_INVALID_FOR_ROOM/);
assert.match(model, /validateCustomerAddressTitle/);
assert.match(model, /normalizeCustomerAddressTitle/);
assert.match(model, /activeCustomerAddresses/);

console.log("PAK cariEditMultiAddressContractSuite");