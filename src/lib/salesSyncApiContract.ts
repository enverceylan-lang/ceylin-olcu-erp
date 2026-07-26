import type { SalePayment } from "@/store/salesStore";
import type { SaleSyncEnvelope } from "@/lib/salesSyncPolicy";
import { validateSaleSyncEnvelope } from "@/lib/salesSyncPolicy";
import {
  normalizeRole,
  type UserRole
} from "@/store/useAuthStore";

export const MAX_SALES_SYNC_CHANGES = 50;

export type SalesSyncOperation =
  | "UPSERT"
  | "SOFT_DELETE"
  | "RESTORE"
  | "APPEND_PAYMENT";

export interface SalesSyncActor {
  id: string;
  role: UserRole;
  isActive: boolean;
}

export interface SalesSyncMutation {
  changeId: string;
  deviceId: string;
  saleId: string;
  ownerUserId: string;
  operation: SalesSyncOperation;
  baseVersion: number;
  envelope?: SaleSyncEnvelope;
  payment?: SalePayment;
}

export interface SalesSyncValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedMutation?: SalesSyncMutation;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "hash",
  "salt",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "jwt",
  "secret",
  "servicerolekey"
]);

const MEDIA_KEYS = new Set([
  "photos",
  "videos",
  "addressphotos"
]);

const ALLOWED_OPERATIONS = new Set<SalesSyncOperation>([
  "UPSERT",
  "SOFT_DELETE",
  "RESTORE",
  "APPEND_PAYMENT"
]);

const ALLOWED_PAYMENT_METHODS = new Set([
  "NAKIT",
  "KART",
  "HAVALE",
  "EFT",
  "DIGER"
]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (
      value.startsWith("data:image") ||
      value.startsWith("data:video") ||
      value.includes(";base64,") ||
      value.length > 10000
    ) {
      return "[REDACTED_LARGE_CONTENT]";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (
      const [key, nestedValue] of
        Object.entries(value as Record<string, unknown>)
    ) {
      const normalizedKey = key.toLocaleLowerCase("tr-TR");

      if (
        SENSITIVE_KEYS.has(normalizedKey) ||
        MEDIA_KEYS.has(normalizedKey)
      ) {
        continue;
      }

      result[key] = sanitizeValue(nestedValue);
    }

    return result;
  }

  return value;
}

export function sanitizeSalesSyncMutation(
  mutation: SalesSyncMutation
): SalesSyncMutation {
  return sanitizeValue(mutation) as SalesSyncMutation;
}

export function canActorUseSalesSync(
  actor: SalesSyncActor | null | undefined
): boolean {
  if (!actor?.isActive || !actor.id?.trim() || !actor.role) {
    return false;
  }

  return new Set([
    "ADMIN",
    "MODERATOR",
    "OFFICE"
  ]).has(normalizeRole(actor.role));
}

export function canActorMutateSale(
  actor: SalesSyncActor | null | undefined,
  ownerUserId: string,
  operation: SalesSyncOperation
): boolean {
  if (!canActorUseSalesSync(actor) || !actor) return false;

  const role = normalizeRole(actor.role);

  if (role === "ADMIN") return true;
  if (operation === "RESTORE") return false;

  return (
    !!ownerUserId.trim() &&
    actor.id === ownerUserId
  );
}

export function validateSalesSyncBatch(
  actor: SalesSyncActor | null | undefined,
  mutations: SalesSyncMutation[]
): SalesSyncValidationResult[] {
  if (
    !Array.isArray(mutations) ||
    mutations.length === 0 ||
    mutations.length > MAX_SALES_SYNC_CHANGES
  ) {
    return [{
      valid: false,
      errors: ["BATCH_SIZE_INVALID"]
    }];
  }

  const changeIds = new Set<string>();

  return mutations.map(rawMutation => {
    const mutation = sanitizeSalesSyncMutation(rawMutation);
    const errors: string[] = [];

    if (!mutation.changeId?.trim()) {
      errors.push("CHANGE_ID_REQUIRED");
    } else if (changeIds.has(mutation.changeId)) {
      errors.push("CHANGE_ID_DUPLICATE");
    }
    changeIds.add(mutation.changeId);

    if (!mutation.deviceId?.trim()) {
      errors.push("DEVICE_ID_REQUIRED");
    }
    if (!mutation.saleId?.trim()) {
      errors.push("SALE_ID_REQUIRED");
    }
    if (!mutation.ownerUserId?.trim()) {
      errors.push("OWNER_USER_ID_REQUIRED");
    }
    if (
      !Number.isSafeInteger(mutation.baseVersion) ||
      mutation.baseVersion < 0
    ) {
      errors.push("BASE_VERSION_INVALID");
    }
    if (!ALLOWED_OPERATIONS.has(mutation.operation)) {
      errors.push("OPERATION_INVALID");
    }
    if (
      !canActorMutateSale(
        actor,
        mutation.ownerUserId,
        mutation.operation
      )
    ) {
      errors.push("FORBIDDEN");
    }

    if (mutation.operation === "APPEND_PAYMENT") {
      if (!mutation.payment?.id?.trim()) {
        errors.push("PAYMENT_ID_REQUIRED");
      }
      if (
        !Number.isFinite(mutation.payment?.amount) ||
        Number(mutation.payment?.amount) <= 0
      ) {
        errors.push("PAYMENT_AMOUNT_INVALID");
      }
      if (
        !mutation.payment?.paidAt ||
        !Number.isFinite(
          Date.parse(mutation.payment.paidAt)
        )
      ) {
        errors.push("PAYMENT_DATE_INVALID");
      }
      if (
        !mutation.payment?.method ||
        !ALLOWED_PAYMENT_METHODS.has(
          mutation.payment.method
        )
      ) {
        errors.push("PAYMENT_METHOD_INVALID");
      }
    } else {
      if (!mutation.envelope) {
        errors.push("SALE_ENVELOPE_REQUIRED");
      } else {
        errors.push(
          ...validateSaleSyncEnvelope(mutation.envelope)
        );

        if (
          mutation.envelope.sale.id !== mutation.saleId
        ) {
          errors.push("SALE_ID_MISMATCH");
        }
        if (
          mutation.envelope.sale.createdByUserId !==
          mutation.ownerUserId
        ) {
          errors.push("OWNER_MISMATCH");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      sanitizedMutation: mutation
    };
  });
}
