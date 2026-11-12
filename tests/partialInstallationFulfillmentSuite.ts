import assert from "node:assert/strict";
import { useOperationsStore } from "../src/store/useOperationsStore";
import { useSalesStore, type Sale, type SaleItem } from "../src/store/salesStore";
import { useStore, type Customer, type ProductionItem, type Product } from "../src/store/useStore";
import { useSupplyChainStore } from "../src/store/useSupplyChainStore";
import { useAuthStore } from "../src/store/useAuthStore";
import { routeInstallationAfterTailorCompletion, routeReadyInstallationsInScope } from "../src/lib/tailorCompletionInstallationCoordinator";
import type { SupplierOrder } from "../src/lib/supplierSupplyFlow";
import type { OperationRecord } from "../src/lib/operationsWorkflow";

const scope = { tenantId: "t", companyId: "c", branchId: "b", accountingPeriodId: "p" };
const manager = { userId: "office", role: "OFFICE" };
const today = "2026-11-12T10:00:00Z";
const tomorrow = "2026-11-13T10:00:00Z";
const finalDay = "2026-11-19T10:00:00Z";
const line = (id: string, productType: string, quantity: number, mechanical = false, wingQuantity?: number) => ({
  id, productType, quantity, wingQuantity, metricUnit: "adet", metricSize: quantity,
  productGroup: mechanical ? "0002 Mekanik" : "0001 Perde", stockItemId: `stock-${id}`,
}) as SaleItem;
const fon = line("fon", "Fon", 4, false, 4);
const stor = line("stor", "Stor", 8, true);
const tul = line("tul", "Tül", 2);
const zebra = line("zebra", "Zebra", 3, true);
const wood = line("wood", "Ahşap jaluzi", 1, true);
const makeSale = (id: string, items: SaleItem[]) => ({
  ...scope, id, customerId: "customer", status: "ONAYLANDI", items,
}) as Sale;
const makeParent = (sale: Sale): OperationRecord => ({
  ...scope, kind: "GENERAL", status: "DRAFT", id: `general-operation:${sale.id}`,
  saleId: sale.id, sourceId: sale.id, idempotencyKey: `GENERAL:${sale.id}`,
  customerId: sale.customerId, customerName: "Fixture", title: "Fixture", details: [],
  scheduledAt: today, dueAt: finalDay, createdAt: today, updatedAt: today, createdByUserId: "office",
});
const production = (sale: Sale, item: SaleItem, status: string) => ({
  ...scope, id: `central-production-${sale.id}-${item.id}`, orderId: sale.id,
  customerId: sale.customerId, saleLineId: item.id, productionStatus: status,
  roomName: "Salon", openingName: "Pencere", productName: item.productType, productType: item.productType,
  width: 100, height: 200, quantity: item.quantity, cutCompleted: status === "READY",
  sewingCompleted: status === "READY", ironingCompleted: status === "READY",
  packagingCompleted: status === "READY", dueDate: finalDay, history: [],
}) satisfies ProductionItem & typeof scope;
const order = (sale: Sale, item: SaleItem, ready: boolean) => ({
  ...scope, saleId: sale.id, id: `order-${item.id}`, saleItemId: item.id, stockItemId: item.stockItemId,
  purpose: "MECHANICAL_PRODUCT", status: ready ? "READY_FOR_OPERATION" : "ORDERED",
  orderedQuantity: item.quantity, receivedQuantity: ready ? item.quantity : 0,
}) as SupplierOrder;
const operations = () => useOperationsStore.getState().operations;
const installations = () => operations().filter(item => item.kind === "INSTALLATION");
const find = (id: string) => {
  const result = installations().find(item => item.fulfillmentLineId === id);
  assert.ok(result, `Missing installation for ${id}`);
  return result;
};
const finish = (item: OperationRecord, when: string, fulfillmentMethod: "STORE_HANDOFF" | "ON_SITE" = "STORE_HANDOFF") =>
  useOperationsStore.getState().updateStatus(item.id, "COMPLETED", manager, when, { scope, fulfillmentMethod });
const sale = makeSale("partial", [fon, stor, tul, zebra, wood]);
const parent = makeParent(sale);
const customer = { ...scope, id: "customer", name: "Fixture", phone: "5550000001", address: "", mapLocation: "", notes: "", rooms: [], addresses: [] } satisfies Customer & typeof scope;
useStore.setState({ customers: [customer], productionItems: [production(sale, fon, "SEWING"), production(sale, tul, "READY")] });
useSupplyChainStore.setState({ supplierOrders: [order(sale, stor, true), order(sale, zebra, true), order(sale, wood, false)] });
useSalesStore.setState({ sales: [sale] });
const tailor: OperationRecord = { ...parent, kind: "TAILOR", status: "COMPLETED", id: "tailor-tul", parentOperationId: parent.id };
useOperationsStore.setState({ operations: [parent, tailor], agendaEvents: [] });

assert.equal(routeInstallationAfterTailorCompletion({ operation: tailor, actorUserId: manager.userId, now: today }).outcome, "ROUTED");
assert.deepEqual(installations().map(item => item.fulfillmentLineId).sort(), ["stor", "tul", "zebra"]);
assert.equal(sale.items.filter(item => installations().some(op => op.fulfillmentLineId === item.id))
  .reduce((sum, item) => sum + item.quantity, 0), 13);
assert.equal(sale.items.filter(item => !installations().some(op => op.fulfillmentLineId === item.id))
  .reduce((sum, item) => sum + item.quantity, 0), 5);
assert.equal(installations().every(item => item.status === "ASSIGNED" && !item.party), true);
assert.equal(finish(find("tul"), today, "ON_SITE").outcome, "REJECTED");
for (const key of Object.keys(scope)) {
  assert.equal(useOperationsStore.getState().updateStatus(find("stor").id, "COMPLETED", manager, today, {
    scope: { ...scope, [key]: "foreign" }, fulfillmentMethod: "STORE_HANDOFF",
  }).outcome, "REJECTED");
}
assert.equal(useOperationsStore.getState().updateStatus(find("stor").id, "COMPLETED", { userId: "external", role: "INSTALLER" }, today,
  { scope, fulfillmentMethod: "STORE_HANDOFF" }).outcome, "REJECTED");
for (const id of ["stor", "tul", "zebra"]) assert.equal(finish(find(id), today).outcome, "UPDATED");
assert.equal(find("stor").completedByUserId, manager.userId);
assert.equal(find("stor").completedAt, today);
assert.equal(find("stor").fulfillmentMethod, "STORE_HANDOFF");
assert.equal(finish(find("stor"), tomorrow).outcome, "REJECTED");
routeReadyInstallationsInScope(scope, manager.userId, tomorrow);
assert.equal(installations().length, 3);
assert.equal(operations().find(item => item.id === parent.id)?.status, "IN_PROGRESS");
assert.equal(finish(parent, tomorrow).outcome, "REJECTED");

useStore.setState({ productionItems: [production(sale, fon, "READY"), production(sale, tul, "READY")] });
routeReadyInstallationsInScope(scope, manager.userId, tomorrow);
assert.equal(finish(find("fon"), tomorrow).outcome, "UPDATED");
assert.equal(find("fon").completedAt, tomorrow);
assert.equal(operations().find(item => item.id === parent.id)?.status, "IN_PROGRESS");
useSupplyChainStore.setState({ supplierOrders: [order(sale, stor, true), order(sale, zebra, true), order(sale, wood, true)] });
routeReadyInstallationsInScope(scope, manager.userId, finalDay);
assert.equal(operations().find(item => item.id === parent.id)?.status, "IN_PROGRESS");
assert.equal(finish(find("wood"), finalDay).outcome, "UPDATED");
assert.equal(installations().length, 5);
assert.equal(operations().find(item => item.id === parent.id)?.status, "COMPLETED");
assert.equal(operations().find(item => item.id === parent.id)?.completedAt, finalDay);
assert.equal(useSalesStore.getState().sales[0].status, "ONAYLANDI");

const address = { ...scope, id: "work-address", customerId: "customer", address: "Fixture Sokak" };
const addressed = { ...makeSale("addressed", [stor, zebra]), customerAddressId: address.id,
  customerAddressSnapshot: { customerAddressId: address.id, address: address.address, capturedAt: today } };
const addressedParent = makeParent(addressed);
useStore.setState({
  customers: [{ ...customer, addresses: [address], assignedInstallerId: "installer" }],
  products: [{ id: stor.stockItemId, requiresInstallation: true } as Product],
});
useAuthStore.setState({ users: [{
  id: "installer", role: "INSTALLER", providerCustomerId: "installer-cari", providerType: "INSTALLER",
  name: "Installer", isActive: true,
} as ReturnType<typeof useAuthStore.getState>["users"][number]] });
useSalesStore.setState({ sales: [addressed] });
useSupplyChainStore.setState({ supplierOrders: [order(addressed, stor, true), order(addressed, zebra, true)] });
useOperationsStore.setState({ operations: [addressedParent], agendaEvents: [] });
routeReadyInstallationsInScope(scope, manager.userId, today);
const storeUnit = find("zebra");
assert.equal(finish(storeUnit, today, "ON_SITE").outcome, "UPDATED");
assert.equal(find("zebra").id, storeUnit.id);
assert.equal(find("zebra").fulfillmentMethod, "ON_SITE");
assert.equal(find("zebra").address, address.address);
const externalUnit = find("stor");
assert.equal(externalUnit.party?.userId, "installer");
assert.equal(externalUnit.address, address.address);
const setExternal = (userId: string, activeScope = scope) => useOperationsStore.getState().updateStatus(
  externalUnit.id, "COMPLETED", { userId, role: "INSTALLER" }, tomorrow, { scope: activeScope });
assert.equal(setExternal("other-installer").outcome, "REJECTED");
assert.equal(setExternal("installer", { ...scope, branchId: "wrong" }).outcome, "REJECTED");
assert.equal(setExternal("installer").outcome, "UPDATED");
assert.equal(find("stor").completedByUserId, "installer");
assert.equal(operations().find(item => item.id === addressedParent.id)?.status, "COMPLETED");
console.log("Partial installation / delivery: 13 ready, 5 pending, scoped completion and final closure: PAK");
