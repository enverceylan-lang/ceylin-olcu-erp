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
    productId: '',
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
  item: CentralSaleItem
): ProductionItem {
  return {
    id: `central-production-${sale.id}-${item.id}`,
    orderId: sale.id,
    saleLineId: item.id,
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
    pleatType: item.pleatDetails,
    wingQuantity: item.wingQuantity,     fonPlacement: item.fonPlacement,
    productionStatus: 'READY_FOR_CUTTING',
    cutCompleted: false,
    sewingCompleted: false,
    ironingCompleted: false,
    packagingCompleted: false,
    dueDate: formatDefaultDeliveryPromiseDate(),
    history: [
      {
        date: new Date().toISOString(),
        status: 'READY_FOR_CUTTING',
        employeeId: 'system',
        notes: `Merkezi satıştan terzi üretimine aktarıldı${
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
  if (sale.status !== 'ÜRETİME_GÖNDERİLDİ') {
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
    const existingKeys = new Set(
      state.productionItems.map(
        item => `${item.orderId}|${item.saleLineId}`
      )
    );

    const newProductionItems = tailorItems
      .filter(
        item => !existingKeys.has(`${sale.id}|${item.id}`)
      )
      .map(item => toProductionItem(sale, item));

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
              status: 'Kesim Bekliyor',
              deadline: formatDefaultDeliveryPromiseDate()
            },
            ...state.productionTasks
          ]
        : state.productionTasks;

    return {
      sales: nextSales,
      productionItems: [
        ...newProductionItems,
        ...state.productionItems
      ],
      productionTasks: nextProductionTasks
    };
  });
}
