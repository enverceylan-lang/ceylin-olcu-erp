import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { useStore } from "../src/store/useStore";
import { useAuthStore } from "../src/store/useAuthStore";
import { localCustomerDb } from "../src/lib/localCustomerDb";
import { normalizeCariRegion } from "../src/lib/stringUtils";

async function run() {
  const scope = { tenantId: "tenant", companyId: "company", branchId: "branch", accountingPeriodId: "period" };
  globalThis.fetch = async (input) => {
    assert.equal(input, "/api/erp-context");
    return Response.json({ success: true, configured: true, context: { scope } });
  };
  useAuthStore.setState({ sessionToken: "fixture-session" });

  const store = useStore.getState();
  const base = { id: "addressless", name: "Adres Olmadan", phone: "5550000001", address: "", mapLocation: "", notes: "" };
  await store.addCustomer(base);
  const addressless = await localCustomerDb.customers.get(base.id);
  assert.equal(addressless?.phone, base.phone);
  assert.equal(addressless?.addresses?.length ?? 0, 0);

  await store.addCustomer({ ...base, id: "with-address", name: "Adres Ile" }, {
    title: "Ev", province: "Ankara", district: "Çankaya", address: "Sokak 1",
    mapLocation: "39.93,32.85", latitude: 39.93, longitude: 32.85,
  });
  const created = await localCustomerDb.customers.get("with-address");
  assert.ok(created);
  const first = created.addresses?.[0];
  assert.ok(first?.id && first.legacyPrimary);
  assert.equal(first.province, normalizeCariRegion("Ankara"));
  assert.equal(first.district, normalizeCariRegion("Çankaya"));
  for (const [key, value] of Object.entries(scope)) assert.equal(Reflect.get(first, key), value);

  await store.updateCustomerAddress(created.id, first.id, { district: "Keçiören", address: "Sokak 2" });
  const edited = await localCustomerDb.customers.get(created.id);
  assert.equal(edited?.addresses?.[0].id, first.id);
  assert.equal(edited?.addresses?.[0].province, normalizeCariRegion("Ankara"));
  assert.equal(edited?.addresses?.[0].district, normalizeCariRegion("Keçiören"));
  assert.equal(edited?.district, normalizeCariRegion("Keçiören"));
  await store.addCustomerAddress(created.id, { title: "İş", address: "Sokak 3" });
  const reopened = await localCustomerDb.customers.get(created.id);
  assert.equal(reopened?.addresses?.length, 2);
  assert.deepEqual(reopened?.addresses?.find(address => address.id === first.id), edited?.addresses?.[0]);
  assert.equal(reopened?.address, edited?.address);
  const firstLater = await store.addCustomerAddress(base.id, { address: "Sonradan eklenen adres" });
  const later = await localCustomerDb.customers.get(base.id);
  assert.equal(later?.addresses?.[0].id, firstLater);
  assert.equal(later?.addresses?.[0].legacyPrimary, true);
  assert.equal(later?.address, later?.addresses?.[0].address);
  localCustomerDb.close();
  console.log("Customer address V1 fake IndexedDB integration: PAK");
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
