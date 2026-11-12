import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureAddressLocation, parseAddressMapLocation } from "../src/lib/customerAddressLocation";
import { resolveInstallationWorkAddress, validateCustomerAddressTitle } from "../src/lib/customerAddressModel";
import type { Sale } from "../src/store/salesStore";
import type { Customer } from "../src/store/useStore";

const coords = { latitude: 41.01, longitude: 28.97, accuracy: 24 } as GeolocationCoordinates;
assert.deepEqual(captureAddressLocation(coords), { ...coords, mapLocation: "41.01,28.97" });
for (const patch of [{ accuracy: 101 }, { accuracy: NaN }, { latitude: 91 }, { longitude: -181 }]) {
  assert.throws(() => captureAddressLocation({ ...coords, ...patch }));
}
assert.deepEqual(parseAddressMapLocation("41.01, 28.97"), {
  latitude: 41.01, longitude: 28.97, mapLocation: "41.01,28.97",
});
assert.equal(parseAddressMapLocation("https://maps.app.goo.gl/example").latitude, undefined);
assert.throws(() => parseAddressMapLocation("javascript:alert(1)"));
assert.throws(() => parseAddressMapLocation("180,41"));

const scope = { tenantId: "tenant", companyId: "company", branchId: "branch", accountingPeriodId: "period" };
const first = { ...scope, id: "addr-1", customerId: "customer", title: "Ev", address: "Yeni sokak" };
const second = { ...scope, id: "addr-2", customerId: "customer", title: "İş", address: "Başka sokak" };
assert.equal(validateCustomerAddressTitle([first], second).ok, true);
assert.equal(validateCustomerAddressTitle([first], { title: "EV" }).ok, false);
const customer = { ...scope, id: "customer", name: "Fixture", phone: "5550000001", address: "", mapLocation: "", notes: "", rooms: [], addresses: [first, second] } satisfies Customer & typeof scope;
const parent = { ...scope, customerId: "customer" };
const sale = {
  ...scope, customerId: "customer", customerAddressId: first.id,
  customerAddressSnapshot: { customerAddressId: first.id, address: "Satıştaki sokak", capturedAt: "2026-11-12" },
} as Sale;
assert.equal(resolveInstallationWorkAddress(parent, sale, [customer]), "Satıştaki sokak");
assert.equal(resolveInstallationWorkAddress(parent, { ...sale, customerAddressId: second.id }, [customer]), undefined);
assert.equal(resolveInstallationWorkAddress(parent, { ...sale, customerAddressId: undefined }, [customer]), undefined);
assert.equal(resolveInstallationWorkAddress(parent, sale, [{ ...customer, addresses: [second] }]), undefined);
for (const key of Object.keys(scope)) {
  assert.equal(resolveInstallationWorkAddress(parent, { ...sale, [key]: "other" }, [customer]), undefined);
  assert.equal(resolveInstallationWorkAddress(parent, sale, [{ ...customer, addresses: [{ ...first, [key]: "other" }] }]), undefined);
}
const read = (path: string) => readFileSync(path, "utf8");
const form = read("src/components/modals/CustomerAddressModal.tsx");
const location = form.slice(form.indexOf("const handleLocation"), form.indexOf("const handleSave"));
assert.doesNotMatch(location, /onSave|updateCustomer|syncNow/);
assert.match(form, /onClick=\{onClose\}/);
assert.match(read("src/app/cariler/yeni/page.tsx"), /!formData\.phone\.trim\(\) && !formData\.phone2\.trim\(\)/);
assert.match(read("src/store/useStore.ts"), /addresses: \[canonical\][\s\S]*?await saveLocalCustomer\(newCustomer\)/);
console.log("Customer address V1 location, identity, scope and source wiring: PAK");
