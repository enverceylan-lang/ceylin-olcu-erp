import {
  normalizeRole,
  type MockUser
} from "@/store/useAuthStore";

export const SALE_APPROVE_PERMISSION =
  "SALE_APPROVE";

type ApprovalUser = Pick<
  MockUser,
  "id" | "role" | "isActive" | "permissions"
>;

type ApprovalSale = {
  createdByUserId?: string;
};

export function canApproveSale(
  user: ApprovalUser | null | undefined,
): boolean {
  if (!user || user.isActive === false) {
    return false;
  }

  if (normalizeRole(user.role) === "ADMIN") {
    return true;
  }

  return (
    Array.isArray(user.permissions) &&
    user.permissions.includes(
      SALE_APPROVE_PERMISSION,
    )
  );
}

/**
 * Maker-checker / four-eyes:
 * Oluşturan kullanıcı biliniyorsa aynı kullanıcı onaylayamaz.
 * Eski kayıtta createdByUserId yoksa yetkili onayı bloklanmaz;
 * onay aktörü status audit'e yine yazılır.
 */
export function canApproveSpecificSale(
  user: ApprovalUser | null | undefined,
  sale: ApprovalSale,
): boolean {
  if (!canApproveSale(user)) {
    return false;
  }

  const creatorId =
    sale.createdByUserId?.trim();

  if (
    creatorId &&
    user?.id?.trim() &&
    creatorId === user.id.trim()
  ) {
    return false;
  }

  return true;
}