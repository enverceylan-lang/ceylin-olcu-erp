export const DEFAULT_DELIVERY_PROMISE_DAYS = 7;

export function addCalendarDays(
  baseDate: Date,
  numberOfDays: number,
): Date {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + numberOfDays);
  return result;
}

export function getDefaultDeliveryPromiseDate(
  baseDate: Date = new Date(),
): Date {
  return addCalendarDays(
    baseDate,
    DEFAULT_DELIVERY_PROMISE_DAYS,
  );
}

export function formatDefaultDeliveryPromiseDate(
  baseDate: Date = new Date(),
  locale: string = "tr-TR",
): string {
  return getDefaultDeliveryPromiseDate(
    baseDate,
  ).toLocaleDateString(locale);
}
