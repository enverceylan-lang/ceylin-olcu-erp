"use client";

import Link from "next/link";
import {
  isPlatformSuperAdmin
} from "@/lib/platformAdminContracts";
import {
  useAuthStore
} from "@/store/useAuthStore";

export default function PlatformSuperAdminLink() {
  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const allowed =
    isPlatformSuperAdmin(
      currentUser
        ? {
            userId: currentUser.id,
            role: String(
              currentUser.role
            )
          }
        : null
    );

  if (!allowed) {
    return null;
  }

  return (
    <Link
      href="/super-admin"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      <span aria-hidden="true">
        🛡️
      </span>

      <span>
        Süper Admin
      </span>
    </Link>
  );
}