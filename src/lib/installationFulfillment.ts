import { erpScopeMatches } from "./erpScope";
import { optionalScopeConflicts, readErpScope } from "./customerTreeScope";
import { decideSaleItemOperationRoute } from "./saleOperationRoutingPlan";
import type { OperationRecord } from "./operationsWorkflow";
import type { SupplierOrder } from "./supplierSupplyFlow";
import type { Sale, SaleItem } from "../store/salesStore";
import type { ProductionItem } from "../store/useStore";

export function getSaleFulfillmentLines(sale: Sale): SaleItem[] {
  return sale.items.flatMap(item => item.productionBreakdown?.length ? item.productionBreakdown : [item])
    .filter(item => !item.isJumboComponent && decideSaleItemOperationRoute(item).route !== "SERVICE_ONLY");
}

export function isFulfillmentLineReady(
  sale: Sale, line: SaleItem, production: ProductionItem[], orders: SupplierOrder[], uniqueSaleId: boolean,
): boolean {
  return production.some(item => {
    if (item.orderId !== sale.id || item.customerId !== sale.customerId ||
        item.saleLineId !== line.id || item.productionStatus !== "READY") return false;
    const scope = readErpScope(item);
    return scope ? erpScopeMatches(scope, sale) :
      uniqueSaleId && !optionalScopeConflicts(item, sale) && item.id === `central-production-${sale.id}-${line.id}`;
  }) || orders.some(order =>
    order.saleId === sale.id && order.saleItemId === line.id && erpScopeMatches(order, sale) &&
    order.purpose === "MECHANICAL_PRODUCT" && order.status === "READY_FOR_OPERATION" &&
    order.receivedQuantity >= order.orderedQuantity && (!line.stockItemId || line.stockItemId === order.stockItemId)
  );
}

export function hasCompletedSaleFulfillment(
  sale: Sale | undefined, operations: OperationRecord[], parent: OperationRecord,
): boolean {
  if (!sale) return false;
  const lines = getSaleFulfillmentLines(sale);
  return lines.length > 0 && new Set(lines.map(line => line.id)).size === lines.length &&
    lines.every(line => operations.some(operation => operation.kind === "INSTALLATION" &&
      operation.status === "COMPLETED" && operation.saleId === sale.id &&
      operation.parentOperationId === parent.id && operation.fulfillmentLineId === line.id &&
      erpScopeMatches(operation, sale)));
}

export function fulfillmentLineLabel(line: SaleItem): string {
  const amount = line.wingQuantity || line.quantity;
  return `${line.productType} · ${amount} ${line.wingQuantity ? "kanat" : "adet"}`;
}
