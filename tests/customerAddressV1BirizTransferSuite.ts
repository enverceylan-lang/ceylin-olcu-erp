import assert from "node:assert/strict";
import { calculateSelectedProduct } from "../src/lib/calculationEngine";
import { syncOrCreateDraftSale } from "../src/lib/salesAdapter";
import { useMeasurementStore, type MeasurementRecord } from "../src/store/measurementStore";
import type { Sale } from "../src/store/salesStore";

async function run() {
  const customer: Parameters<typeof syncOrCreateDraftSale>[0] = {
    id: "fixture-customer", name: "Fixture", phone: "5550000001",
    address: "", mapLocation: "", notes: "", addresses: [],
    rooms: [{ id: "fixture-room", name: "Salon", photos: [], videos: [], windows: [] }],
  };
  const scope = { tenantId: "tenant", companyId: "company", branchId: "branch", accountingPeriodId: "period" };
  const actor = { id: "fixture-user", username: "fixture", name: "Fixture" };
  const measurement = (id: string, width: number, customerAddressId?: string) => ({
    ...scope, id, customerId: customer.id, roomId: "fixture-room", customerAddressId,
    templateType: "CURTAIN", rawValues: { windowWidth: width, windowHeight: 80 },
    selectedProducts: [{ productType: "BIRIZ", isActive: true, calculation: calculateSelectedProduct("BIRIZ", width, 80, {}) }],
  }) as unknown as MeasurementRecord;
  const prior = useMeasurementStore.getState().measurements;
  let draft: Sale | undefined;
  const store = {
    get sales() { return draft ? [draft] : []; },
    addSale: async (sale: Sale) => { draft = sale; },
    updateSale: async (sale: Sale) => { draft = sale; },
  };
  const transfer = (addressId?: string) => syncOrCreateDraftSale(
    customer, store, actor, scope, undefined, addressId,
    ["one", "two"].map(measurementId => ({ measurementId, productType: "BIRIZ" })),
  );
  try {
    useMeasurementStore.setState({ measurements: [measurement("one", 60, "address-a"), measurement("two", 80, "address-b")] });
    await assert.rejects(transfer(), { message: "SALE_MIXED_CUSTOMER_ADDRESSES_UNSUPPORTED" });
    await assert.rejects(transfer("address-a"), { message: "SALE_CUSTOMER_ADDRESS_NOT_FOUND" });
    assert.equal(draft, undefined);
    console.log("BİRİZ address identity negative guards: PAK");
    useMeasurementStore.setState({ measurements: [measurement("one", 60), measurement("two", 80)] });
    const id = await transfer();
    assert.ok(draft);
    const saved = draft as Sale;
    assert.equal(saved.id, id);
    assert.equal(saved.status, "TASLAK");
    assert.equal(saved.customerAddressId, undefined);
    assert.ok(saved.items.some(line => line.metricUnit === "mt" && line.metricSize === 2.6));
    console.log("Addressless BİRİZ real sale adapter: PAK");
  } finally {
    useMeasurementStore.setState({ measurements: prior });
  }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
