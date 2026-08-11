import { formatDefaultDeliveryPromiseDate } from "@/lib/deliveryPromise";
import type {
  Sale as CentralSale,
  SaleItem as CentralSaleItem
} from '@/store/salesStore';
import type {
  ProductionItem,
  Sale as LegacySale,
  SaleItem as LegacySaleItem
} from '@/store/useStore';
import { shouldCreateTailorProductionItem } from '@/lib/productionRouting';
import { shouldPublishTailorPlanning } from '@/lib/tailorPlanningEligibility';

function resolveProductionQuantity(item: CentralSaleItem): number {
  const fabricMeters = Number(item.fabricMeters || 0);

  if (fabricMeters > 0) {
    return fabricMeters;
  }

  if (item.metricUnit === 'mt') {
    return Number(item.metricSize || 0);
  }

  return Number(item.quantity || 1);
}

function resolveProductionQuantityUnit(
  item: CentralSaleItem
): 'mt' | 'm2' | 'adet' {
  if (Number(item.fabricMeters || 0) > 0) {
    return 'mt';
  }

  return item.metricUnit;
}

function toLegacySaleItem(item: CentralSaleItem): LegacySaleItem {
  return {
    id: item.id,
    customerId: undefined,
    roomId: undefined,
    roomName: item.roomName,
    openingId: undefined,
    windowName: item.windowName,
    measurementId: item.measurementId,
    originalWidth: item.width,
    originalHeight: item.height,
    productId: item.stockItemId || '',
    productGroup: item.productGroup,
    productType: item.productType,
    calculationType: item.metricUnit,
    width: Number(
      item.productionWidthCm ??
      item.calcWidth ??
      item.width ??
      0
    ),
    height: Number(
      item.productionHeightCm ??
      item.calcHeight ??
      item.height ??
      0
    ),
    quantity: resolveProductionQuantity(item),
    unitPrice: item.unitPrice,
    totalPrice: item.rowTotal,
    pleatType: item.pleatDetails,
    wingQuantity: item.wingQuantity,     fonPlacement: item.fonPlacement
  };
}

function toProductionItem(
  sale: CentralSale,
  item: CentralSaleItem,
  assignedEmployeeId?: string
): ProductionItem {
  return {
    id: `central-production-${sale.id}-${item.id}`,
    orderId: sale.id,
    saleLineId: item.id,
    stockItemId: item.stockItemId,
    customerId: sale.customerId,
    roomName: item.roomName,
    openingName: item.windowName,
    productName: item.productType || item.productGroup || 'Bilinmeyen Ürün',
    productType: item.productType || item.productGroup || 'Ürün',
    width: Number(
      item.productionWidthCm ??
      item.calcWidth ??
      item.width ??
      0
    ),
    height: Number(
      item.productionHeightCm ??
      item.calcHeight ??
      item.height ??
      0
    ),
    quantity: resolveProductionQuantity(item),
    quantityUnit: resolveProductionQuantityUnit(item),
    pleatType: item.pleatDetails,
    wingQuantity: item.wingQuantity,     fonPlacement: item.fonPlacement,
    productionStatus: 'WAITING_MATERIAL',
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    assignedEmployeeId,
    dueDate: formatDefaultDeliveryPromiseDate(),
    history: [
      {
        date: new Date().toISOString(),
        status: 'WAITING_MATERIAL',
        employeeId: 'system',
        notes: `Merkezi satıştan üretim havuzuna alındı; malzeme kaynağı hazır olana kadar kesime çıkamaz${
          item.calculationVersion
            ? ` (${item.calculationVersion})`
            : ''
        }.`
      }
    ],
    sewingFee: 150,
    approvedExtraWorkFee: 0
  };
}

export async function syncCentralSaleToTailorProduction(
  sale: CentralSale
): Promise<void> {
  /*
   * İş emri / kapasite planı satış ONAYLANDI olduğunda erkenden görünür.
   * Fiziksel kesim izni ayrı malzeme readiness kapısı tarafından yönetilir.
   */
  if (!shouldPublishTailorPlanning(sale.status)) {
    return;
  }

  /*
   * Satış satırları oda bazında gruplanmış olabilir.
   * Terzi üretimi açıklık ve ölçü bazındaki merkezi kaynakları kullanır.
   */
  const productionSourceItems =
    sale.items.flatMap(item =>
      Array.isArray(item.productionBreakdown) &&
      item.productionBreakdown.length > 0
        ? item.productionBreakdown
        : [item]
    );

  const tailorItems =
    productionSourceItems.filter(item =>
      !item.isJumboComponent &&
      shouldCreateTailorProductionItem(item)
    );

  if (tailorItems.length === 0) {
    return;
  }

  const { useStore, generateUUID } = await import('@/store/useStore');

  useStore.setState(state => {
    const assignedTailorId =
      state.customers.find(
        customer => customer.id === sale.customerId
      )?.assignedTailorId || undefined;

    const existingKeys = new Set(
      state.productionItems.map(
        item => `${item.orderId}|${item.saleLineId}`
      )
    );

    const newProductionItems = tailorItems
      .filter(
        item => !existingKeys.has(`${sale.id}|${item.id}`)
      )
      .map(item =>
        toProductionItem(
          sale,
          item,
          assignedTailorId
        )
      );

    const tailorItemsById = new Map(
      tailorItems.map(item => [item.id, item])
    );

    const existingProductionItems =
      state.productionItems.map(item => {
        const sourceItem =
          item.orderId === sale.id
            ? tailorItemsById.get(item.saleLineId)
            : undefined;

        if (!sourceItem) return item;

        let repairedItem = item;

        if (
          !repairedItem.stockItemId &&
          sourceItem.stockItemId
        ) {
          repairedItem = {
            ...repairedItem,
            stockItemId: sourceItem.stockItemId
          };
        }

        if (!repairedItem.quantityUnit) {
          repairedItem = {
            ...repairedItem,
            quantityUnit:
              resolveProductionQuantityUnit(sourceItem)
          };
        }

        if (
          !repairedItem.pleatType &&
          sourceItem.pleatDetails
        ) {
          repairedItem = {
            ...repairedItem,
            pleatType: sourceItem.pleatDetails
          };
        }

        if (
          repairedItem.wingQuantity === undefined &&
          sourceItem.wingQuantity !== undefined
        ) {
          repairedItem = {
            ...repairedItem,
            wingQuantity: sourceItem.wingQuantity
          };
        }

        if (
          repairedItem.fonPlacement === undefined &&
          sourceItem.fonPlacement !== undefined
        ) {
          repairedItem = {
            ...repairedItem,
            fonPlacement: sourceItem.fonPlacement
          };
        }

        if (
          !repairedItem.assignedEmployeeId &&
          assignedTailorId
        ) {
          return {
            ...repairedItem,
            assignedEmployeeId: assignedTailorId
          };
        }

        return repairedItem;
      });

    const legacyItems = productionSourceItems.map(toLegacySaleItem);

    const mirroredSale: LegacySale = {
      id: sale.id,
      customerId: sale.customerId,
      totalAmount: sale.totalAmount,
      status: 'Üretimde',
      date: new Date(sale.updatedAt || sale.createdAt).toLocaleDateString('tr-TR'),
      items: legacyItems
    };

    const hasMirroredSale = state.sales.some(
      existingSale => existingSale.id === sale.id
    );

    const nextSales = hasMirroredSale
      ? state.sales.map(existingSale =>
          existingSale.id === sale.id
            ? mirroredSale
            : existingSale
        )
      : [mirroredSale, ...state.sales];

    const hasProductionTask = state.productionTasks.some(
      task => task.saleId === sale.id
    );

    const taskText = tailorItems
      .map(
        item =>
          `${item.roomName} (${item.windowName}): ${item.productType}`
      )
      .join(', ');

    const nextProductionTasks =
      !hasProductionTask && newProductionItems.length > 0
        ? [
            {
              id: generateUUID(),
              saleId: sale.id,
              customerId: sale.customerId,
              items: taskText,
              status: 'Planlandı / Malzeme Bekliyor',
              deadline: formatDefaultDeliveryPromiseDate()
            },
            ...state.productionTasks
          ]
        : state.productionTasks;

    return {
      sales: nextSales,
      productionItems: [
        ...newProductionItems,
        ...existingProductionItems
      ],
      productionTasks: nextProductionTasks
    };
  });
}
