import type {
  Sale,
  SaleItem
} from "@/store/salesStore";
import type {
  OperationKind,
  OperationParty,
  OperationRecord
} from "./operationsWorkflow";
import type {
  ErpScope
} from "./erpScope";

export interface OperationCustomer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface BuildOperationFromSaleInput {
  scope: ErpScope;
  sale: Sale;
  customer: OperationCustomer;
  kind: OperationKind;
  party?: OperationParty;
  supplierName?: string;
  supplierPhone?: string;
  scheduledAt: string;
  dueAt: string;
  notes?: string;
  createdByUserId: string;
  now: string;
  id: string;
}

function numberText(
  value: number | undefined
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return new Intl.NumberFormat(
    "tr-TR",
    {
      maximumFractionDigits: 2
    }
  ).format(value);
}

function unitLabel(
  unit: SaleItem["metricUnit"]
): string {
  if (unit === "m2") {
    return "m²";
  }

  if (unit === "mt") {
    return "mt";
  }

  return "adet";
}

export function buildOperationDetailFromSaleItem(
  item: SaleItem
): string {
  const room =
    item.roomName.trim() ||
    "Oda belirtilmedi";

  const opening =
    item.windowName.trim() ||
    "Açıklık belirtilmedi";

  const product =
    item.productType.trim() ||
    item.productGroup.trim() ||
    "Ürün";

  const productionWidth =
    item.productionWidthCm ??
    item.calcWidth ??
    item.width;

  const productionHeight =
    item.productionHeightCm ??
    item.calcHeight ??
    item.height;

  const metric =
    `${numberText(item.metricSize)} ${unitLabel(item.metricUnit)}`;

  const quantity =
    item.quantity > 1
      ? ` — ${numberText(item.quantity)} adet`
      : "";

  const note =
    item.note?.trim()
      ? ` — Not: ${item.note.trim()}`
      : "";

  return (
    `${room} / ${opening} — ${product}` +
    ` — ${numberText(productionWidth)} × ` +
    `${numberText(productionHeight)} cm` +
    ` — ${metric}${quantity}${note}`
  );
}

function kindTitle(
  kind: OperationKind,
  saleNo: string
): string {
  if (kind === "GENERAL") {
    return `Genel İş Takibi — ${saleNo}`;
  }

  if (kind === "TAILOR") {
    return `Terzi İş Emri — ${saleNo}`;
  }

  if (kind === "SUPPLIER") {
    return `Tedarikçi Siparişi — ${saleNo}`;
  }

  return `Montaj İş Emri — ${saleNo}`;
}

export function buildOperationFromSale(
  input: BuildOperationFromSaleInput
): OperationRecord {
  const details =
    input.sale.items.map(
      buildOperationDetailFromSaleItem
    );

  if (details.length === 0) {
    throw new Error(
      "OPERATION_SALE_ITEMS_REQUIRED"
    );
  }

  let party = input.party;

  if (input.kind === "SUPPLIER") {
    const supplierName =
      input.supplierName?.trim() ?? "";

    if (supplierName.length === 0) {
      throw new Error(
        "OPERATION_SUPPLIER_REQUIRED"
      );
    }

    party = {
      id:
        `supplier:${supplierName.toLocaleLowerCase("tr-TR")}`,
      name: supplierName,
      phone:
        input.supplierPhone?.trim() ||
        undefined
    };
  }

  if (!party) {
    throw new Error(
      "OPERATION_PARTY_REQUIRED"
    );
  }

  const scheduledTime =
    new Date(input.scheduledAt).getTime();

  const dueTime =
    new Date(input.dueAt).getTime();

  if (
    Number.isNaN(scheduledTime) ||
    Number.isNaN(dueTime) ||
    dueTime < scheduledTime
  ) {
    throw new Error(
      "OPERATION_DATE_RANGE_INVALID"
    );
  }

  return {
    ...input.scope,

    id: input.id,
    idempotencyKey: [
      input.kind,
      input.sale.id,
      party.id
    ].join(":"),

    kind: input.kind,
    sourceId: input.sale.id,
    saleId: input.sale.id,

    customerId: input.customer.id,
    customerName: input.customer.name,
    address: input.customer.address,

    title: kindTitle(
      input.kind,
      input.sale.saleNo
    ),

    details,
    party,

    scheduledAt:
      new Date(
        input.scheduledAt
      ).toISOString(),

    dueAt:
      new Date(
        input.dueAt
      ).toISOString(),

    status: "ASSIGNED",
    notes:
      input.notes?.trim() ||
      undefined,

    createdByUserId:
      input.createdByUserId,

    createdAt: input.now,
    updatedAt: input.now
  };
}