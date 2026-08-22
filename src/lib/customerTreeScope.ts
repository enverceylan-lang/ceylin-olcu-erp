import type { ErpScope } from "./erpScope";
import { erpScopeMatches, validateErpScope } from "./erpScope";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object"
    ? value as UnknownRecord
    : null;
}

export function readErpScope(value: unknown): ErpScope | null {
  const source = asRecord(value);
  if (!source) return null;

  const candidate: Partial<ErpScope> = {
    tenantId: typeof source.tenantId === "string" ? source.tenantId.trim() : "",
    companyId: typeof source.companyId === "string" ? source.companyId.trim() : "",
    branchId: typeof source.branchId === "string" ? source.branchId.trim() : "",
    accountingPeriodId:
      typeof source.accountingPeriodId === "string"
        ? source.accountingPeriodId.trim()
        : "",
  };

  const validation = validateErpScope(candidate);
  if (!validation.valid) return null;
  return candidate as ErpScope;
}

export function applyErpScope<T extends object>(
  value: T,
  scope: ErpScope,
): T & ErpScope {
  return {
    ...value,
    tenantId: scope.tenantId,
    companyId: scope.companyId,
    branchId: scope.branchId,
    accountingPeriodId: scope.accountingPeriodId,
  };
}

export function inheritConsistentErpScope(
  ...values: unknown[]
): ErpScope | null {
  const scopes = values
    .map(readErpScope)
    .filter((scope): scope is ErpScope => scope !== null);

  if (scopes.length === 0) return null;

  const first = scopes[0];
  for (const scope of scopes.slice(1)) {
    if (!erpScopeMatches(first, scope)) {
      throw new Error("ERP_SCOPE_PARENT_MISMATCH");
    }
  }
  return first;
}

export function customerTreeScopeIssue(
  customer: unknown,
  expected: ErpScope,
): string | null {
  const customerRecord = asRecord(customer);
  const customerScope = readErpScope(customerRecord);
  if (!customerScope || !erpScopeMatches(customerScope, expected)) {
    return "CUSTOMER_SCOPE_MISMATCH";
  }

  const rooms = Array.isArray(customerRecord?.rooms)
    ? customerRecord.rooms
    : [];

  for (const room of rooms) {
    const roomRecord = asRecord(room);
    const roomScope = readErpScope(roomRecord);
    if (!roomScope || !erpScopeMatches(roomScope, expected)) {
      return "ROOM_SCOPE_MISMATCH";
    }

    const openings = Array.isArray(roomRecord?.windows)
      ? roomRecord.windows
      : [];

    for (const opening of openings) {
      const openingRecord = asRecord(opening);
      const openingScope = readErpScope(openingRecord);
      if (!openingScope || !erpScopeMatches(openingScope, expected)) {
        return "OPENING_SCOPE_MISMATCH";
      }

      const measurements = Array.isArray(openingRecord?.products)
        ? openingRecord.products
        : [];

      for (const measurement of measurements) {
        const measurementScope = readErpScope(measurement);
        if (
          !measurementScope ||
          !erpScopeMatches(measurementScope, expected)
        ) {
          return "MEASUREMENT_SCOPE_MISMATCH";
        }
      }
    }
  }

  return null;
}

export function stampCustomerTreeScope<T>(
  customer: T,
  scope: ErpScope,
): T {
  const customerRecord = asRecord(customer);
  if (!customerRecord) return customer;

  const rooms = Array.isArray(customerRecord.rooms)
    ? customerRecord.rooms.map((room) => {
        const roomRecord = asRecord(room) ?? {};
        const windows = Array.isArray(roomRecord.windows)
          ? roomRecord.windows.map((opening) => {
              const openingRecord = asRecord(opening) ?? {};
              const products = Array.isArray(openingRecord.products)
                ? openingRecord.products.map((measurement) =>
                    applyErpScope(asRecord(measurement) ?? {}, scope)
                  )
                : [];
              return applyErpScope(
                { ...openingRecord, products },
                scope,
              );
            })
          : [];
        return applyErpScope(
          { ...roomRecord, windows },
          scope,
        );
      })
    : [];

  return applyErpScope(
    { ...customerRecord, rooms },
    scope,
  ) as T;
}