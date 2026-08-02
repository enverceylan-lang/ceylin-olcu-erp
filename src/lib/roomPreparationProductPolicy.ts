import type { MeasurementRecord } from "@/store/measurementStore";
import { resolveMeasurementProductType } from "@/lib/measurementAdapter";

/**
 * Satışa Hazırlık ürün kilidi.
 *
 * - Plicell kendi ürününe kilitlidir.
 * - mechanical_curtain ölçüsü, sahada ölçülen canonical mekanik ürüne kilitlidir.
 * - CURTAIN_DETAIL / diğer normal şablonlar kilitli değildir.
 */
export function getRoomPreparationLockedProductType(
  measurement: MeasurementRecord,
): string | null {
  if (measurement.templateType === "PLICELL") {
    return "PLICELL";
  }

  if (measurement.templateType === "mechanical_curtain") {
    return resolveMeasurementProductType(measurement) || null;
  }

  return null;
}

export function isRoomPreparationProductLocked(
  measurement: MeasurementRecord,
): boolean {
  return getRoomPreparationLockedProductType(measurement) !== null;
}

export function isRoomPreparationProductAllowed(
  measurement: MeasurementRecord,
  productType: string,
): boolean {
  const lockedType = getRoomPreparationLockedProductType(measurement);

  if (lockedType) {
    return productType === lockedType;
  }

  return productType !== "PLICELL";
}