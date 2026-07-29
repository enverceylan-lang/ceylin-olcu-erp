export interface BindableMeasurement {
  id: string;
  customerId: string;

  roomId?: string;
  windowId?: string;
  openingId?: string;

  isDeleted?: boolean;
  isArchived?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface MeasurementLinkedSaleItem {
  measurementId?: string;
}

export interface MeasurementLinkedSale {
  id: string;
  customerId: string;
  status: string;

  items:
    MeasurementLinkedSaleItem[];

  isDeleted?: boolean;
  isArchived?: boolean;
}

export interface MeasurementBindingDecision {
  allowed: boolean;

  measurementId: string;
  customerId: string;

  reason:
    | "AVAILABLE"
    | "MEASUREMENT_NOT_FOUND"
    | "CUSTOMER_MISMATCH"
    | "MEASUREMENT_DELETED"
    | "MEASUREMENT_ARCHIVED"
    | "ALREADY_LINKED_TO_ACTIVE_SALE";
}

function splitMeasurementIds(
  value: string | undefined
): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export function isActiveSaleForMeasurementBinding(
  sale: MeasurementLinkedSale
): boolean {
  if (
    sale.isDeleted ||
    sale.isArchived
  ) {
    return false;
  }

  return (
    sale.status !== "IPTAL_EDILDI" &&
    sale.status !== "İPTAL" &&
    sale.status !== "IPTAL"
  );
}

export function collectActiveSaleMeasurementIds(
  sales: MeasurementLinkedSale[]
): Set<string> {
  const result =
    new Set<string>();

  sales
    .filter(
      isActiveSaleForMeasurementBinding
    )
    .forEach(sale => {
      sale.items.forEach(item => {
        splitMeasurementIds(
          item.measurementId
        ).forEach(measurementId => {
          result.add(measurementId);
        });
      });
    });

  return result;
}

export function getUnboundMeasurementsForCustomer(
  customerId: string,
  measurements: BindableMeasurement[],
  sales: MeasurementLinkedSale[]
): BindableMeasurement[] {
  const linkedMeasurementIds =
    collectActiveSaleMeasurementIds(
      sales
    );

  return measurements
    .filter(
      measurement =>
        measurement.customerId ===
          customerId &&
        !measurement.isDeleted &&
        !measurement.isArchived &&
        !linkedMeasurementIds.has(
          measurement.id
        )
    )
    .sort((left, right) =>
      String(
        right.updatedAt ??
        right.createdAt ??
        ""
      ).localeCompare(
        String(
          left.updatedAt ??
          left.createdAt ??
          ""
        )
      )
    );
}

export function decideMeasurementSaleBinding(
  customerId: string,
  measurementId: string,
  measurements: BindableMeasurement[],
  sales: MeasurementLinkedSale[]
): MeasurementBindingDecision {
  const measurement =
    measurements.find(
      item =>
        item.id === measurementId
    );

  if (!measurement) {
    return {
      allowed: false,
      measurementId,
      customerId,
      reason:
        "MEASUREMENT_NOT_FOUND"
    };
  }

  if (
    measurement.customerId !==
    customerId
  ) {
    return {
      allowed: false,
      measurementId,
      customerId,
      reason: "CUSTOMER_MISMATCH"
    };
  }

  if (measurement.isDeleted) {
    return {
      allowed: false,
      measurementId,
      customerId,
      reason:
        "MEASUREMENT_DELETED"
    };
  }

  if (measurement.isArchived) {
    return {
      allowed: false,
      measurementId,
      customerId,
      reason:
        "MEASUREMENT_ARCHIVED"
    };
  }

  const linkedIds =
    collectActiveSaleMeasurementIds(
      sales
    );

  if (
    linkedIds.has(measurementId)
  ) {
    return {
      allowed: false,
      measurementId,
      customerId,
      reason:
        "ALREADY_LINKED_TO_ACTIVE_SALE"
    };
  }

  return {
    allowed: true,
    measurementId,
    customerId,
    reason: "AVAILABLE"
  };
}

export function validateMeasurementSelection(
  customerId: string,
  selectedMeasurementIds: string[],
  measurements: BindableMeasurement[],
  sales: MeasurementLinkedSale[]
): MeasurementBindingDecision[] {
  const uniqueIds =
    Array.from(
      new Set(
        selectedMeasurementIds
          .map(item => item.trim())
          .filter(
            item =>
              item.length > 0
          )
      )
    );

  return uniqueIds.map(
    measurementId =>
      decideMeasurementSaleBinding(
        customerId,
        measurementId,
        measurements,
        sales
      )
  );
}