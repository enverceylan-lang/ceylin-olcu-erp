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
import {
  normalizeCompanyAppPath,
} from "@/lib/companyRouting";
import {
  isPilotFieldV1Override,
  isPilotFieldV1PlaceholderPath,
} from "@/lib/pilotFieldV1";
import {
  useErpRuntimeContext,
} from "@/lib/useErpRuntimeContext";

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

function CompanyAppShell({
  children,
  pathname,
}: Readonly<{
  children: React.ReactNode;
  pathname: string;
}>) {
  const {
    featureOverrides,
  } = useErpRuntimeContext();

  const pilotFieldV1 =
    isPilotFieldV1Override(
      featureOverrides
    );

  const appPathname =
    normalizeCompanyAppPath(
      pathname
    );

  const showPilotPlaceholder =
    pilotFieldV1 &&
    isPilotFieldV1PlaceholderPath(
      appPathname
    );

  return (
    <>
      <FieldTaskNotifier />

      <PWAController />

      <AuthGate>
        <Sidebar
          pilotFieldV1={pilotFieldV1}
        />

        <SaleDueNotifier />

        <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
          <Topbar />

          <main className="flex-1 p-4 lg:p-8 overflow-auto">
            {showPilotPlaceholder ? (
              <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center">
                <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    Çok kısa zamanda sizlerle :)
                  </p>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Bu bölüm ENVerp pilot geliştirme programında hazırlanıyor.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </AuthGate>
    </>
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
    <CompanyAppShell
      pathname={pathname}
    >
      {children}
    </CompanyAppShell>
  );
}