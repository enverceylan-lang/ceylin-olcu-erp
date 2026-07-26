import type { Sale } from "@/store/salesStore";
import type { MockUser } from "@/store/useAuthStore";
import { normalizeRole } from "@/store/useAuthStore";

type SaleViewer = Pick<MockUser, "id" | "username" | "role">;

function normalizeIdentity(value?: string): string {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

export function canViewSale(
  user: SaleViewer | null | undefined,
  sale: Sale
): boolean {
  if (!user?.role) return false;

  if (normalizeRole(user.role) === "ADMIN") {
    return true;
  }

  if (
    sale.createdByUserId &&
    user.id &&
    sale.createdByUserId === user.id
  ) {
    return true;
  }

  if (
    !sale.createdByUserId &&
    sale.createdByUsername &&
    user.username
  ) {
    return (
      normalizeIdentity(sale.createdByUsername) ===
      normalizeIdentity(user.username)
    );
  }

  return false;
}

export function getVisibleSales(
  user: SaleViewer | null | undefined,
  sales: Sale[]
): Sale[] {
  return sales.filter(sale => canViewSale(user, sale));
}
