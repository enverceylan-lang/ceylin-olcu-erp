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

    const createdAt = "2026-11-12T08:00:00.000Z";
    const withTul = (id: string, width: number, kind: "SALIK" | "SABIT", explicit = false) => {
      const base = measurement(id, width);
      return {
        ...base, createdAt,
        selectedProducts: [
          { productType: "TUL", isActive: true, addedAt: createdAt,
            ...(explicit ? { userOverrides: { pleatFactor: 3.2 } } : {}),
            calculation: calculateSelectedProduct("TUL", width, 80, { pleatFactor: 3.2 }) },
          { productType: "BIRIZ", isActive: true, userOverrides: { birizType: kind },
            calculation: calculateSelectedProduct("BIRIZ", width, 80, { birizType: kind }) },
        ],
      };
    };
    const transferRoom = async (measurements: MeasurementRecord[]) => {
      draft = undefined;
      useMeasurementStore.setState({ measurements });
      await syncOrCreateDraftSale(customer, store, actor, scope);
      assert.ok(draft);
      return (draft as Sale).items;
    };
    const duplicateFixture = await transferRoom([withTul("salik", 75, "SALIK"), withTul("sabit", 65, "SABIT")]);
    assert.deepEqual(duplicateFixture.map(item => [item.metricSize, item.metricUnit]).sort(), [[2.05, "mt"], [2.4, "mt"], [6, "adet"]]);
    assert.equal(duplicateFixture.filter(item => item.birizCuttingGroups).length, 1);
    assert.ok(duplicateFixture.every(item => item.birizRuleVersion));

    const independent = await transferRoom([withTul("salik", 75, "SALIK", true), withTul("sabit", 65, "SABIT")]);
    assert.equal(independent.filter(item => !item.birizRuleVersion && item.productType === "TUL").length, 1);
    assert.equal(independent.find(item => item.birizCuttingGroups)?.metricSize, 2.4);

    const atHeight = (id: string, width: number, height: number) => ({
      ...measurement(id, width),
      rawValues: { windowWidth: width, windowHeight: height },
      selectedProducts: [{ productType: "BIRIZ", isActive: true,
        calculation: calculateSelectedProduct("BIRIZ", width, height, {}) }],
    });
    // The 280 cm rule applies after adding the existing 30 cm folding allowance.
    const mixed = await transferRoom([
      atHeight("short-a", 75, 80), atHeight("short-b", 65, 80),
      atHeight("exact-280", 60, 250), atHeight("above-280", 80, 251),
    ]);
    const fabric = mixed.filter(item => item.birizCuttingGroups);
    assert.equal(fabric.length, 1);
    assert.equal(fabric[0].metricSize, 7);
    assert.deepEqual(fabric[0].birizCuttingGroups?.map(group =>
      [group.measurementIds.join(","), group.occupiedFabricWidthCm, group.fabricMeters]), [
      ["above-280", 281, 2.6], ["exact-280", 280, 2], ["short-a,short-b", 220, 2.4],
    ]);
    console.log("BİRİZ V5 duplicate, independent TÜL and 280 cm boundary: PAK");
  } finally {
    useMeasurementStore.setState({ measurements: prior });
  }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
