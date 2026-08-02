"use client";

import {
  usePathname,
} from "next/navigation";

import {
  AuthGate,
} from "@/components/AuthGate";
import {
  FieldTaskNotifier,
} from "@/components/FieldTaskNotifier";
import {
  PWAController,
} from "@/components/PWAController";
import {
  SaleDueNotifier,
} from "@/components/SaleDueNotifier";
import {
  Sidebar,
} from "@/components/Sidebar";
import {
  Topbar,
} from "@/components/Topbar";

const RESERVED_ROOT_SEGMENTS =
  new Set([
    "",
    "ajanda",
    "api",
    "ayarlar",
    "bekleyen-hakedisler",
    "cariler",
    "finans",
    "gorevler",
    "hakedislerim",
    "montaj",
    "olculer",
    "operasyonlar",
    "platform",
    "raporlar",
    "satis",
    "stok",
    "super-admin",
    "uretim",
  ]);

function isCompanyLoginGateway(
  pathname: string,
): boolean {
  const segments =
    pathname
      .split("/")
      .filter(Boolean);

  if (segments.length !== 1) {
    return false;
  }

  const first =
    segments[0]
      .trim()
      .toLowerCase();

  if (
    !first ||
    RESERVED_ROOT_SEGMENTS.has(first)
  ) {
    return false;
  }

  return (
    /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
      .test(first)
  );
}

function isPlatformRoute(
  pathname: string,
): boolean {
  return (
    pathname === "/platform" ||
    pathname.startsWith(
      "/platform/",
    ) ||
    pathname === "/super-admin" ||
    pathname.startsWith(
      "/super-admin/",
    )
  );
}

export function AppRouteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname =
    usePathname();

  if (
    isCompanyLoginGateway(
      pathname,
    ) ||
    isPlatformRoute(
      pathname,
    )
  ) {
    return (
      <main className="min-h-screen w-full">
        {children}
      </main>
    );
  }

  return (
    <>
      <FieldTaskNotifier />

      <PWAController />

      <AuthGate>
        <Sidebar />

        <SaleDueNotifier />

        <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
          <Topbar />

          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </AuthGate>
    </>
  );
}