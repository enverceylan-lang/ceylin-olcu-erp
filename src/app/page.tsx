"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Package,
  Ruler,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { useEffect, useMemo, useState } from "react";
import { localDraftDb } from "@/lib/localDraftDb";
import {
  canViewModule,
  normalizeRole,
  useAuthStore,
} from "@/store/useAuthStore";
import { getVisibleSales } from "@/lib/salesVisibility";
import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";

export default function Home() {
  const { scope } = useErpRuntimeContext();
  const { customers, products } = useStore();
  const { sales, loadSales } = useSalesStore();
  const currentUser = useAuthStore(state => state.currentUser);
  const [inboundCount, setInboundCount] = useState(0);

  useEffect(() => {
    if (scope) {
      void loadSales(scope);
    }

    localDraftDb.inboundMeasurements
      .toArray()
      .then(items => {
        const pending = items.filter(
          item =>
            item.status === "NEW" ||
            item.status === "MATCH_PENDING",
        );

        setInboundCount(pending.length);
      })
      .catch(error => {
        console.error(
          "Failed to load inbound measurements for dashboard",
          error,
        );
      });
  }, [loadSales, scope]);

  const role = currentUser
    ? normalizeRole(currentUser.role)
    : null;

  const visibleSales = useMemo(
    () => getVisibleSales(currentUser, sales),
    [currentUser, sales],
  );

  const activeCustomersCount = customers.filter(
    customer =>
      !customer.isDeleted &&
      !customer.isArchived,
  ).length;

  const activeSales = visibleSales.filter(
    sale =>
      sale.status !== "İPTAL" &&
      sale.status !== "TAMAMLANDI",
  );

  const stockCount = products?.length || 0;

  const draftSalesCount = visibleSales.filter(
    sale =>
      sale.status === "TASLAK" ||
      sale.status === "TEKLİF",
  ).length;

  const approvedSalesCount = visibleSales.filter(
    sale => sale.status === "ONAYLANDI",
  ).length;

  const orderSalesCount = visibleSales.filter(
    sale =>
      sale.status === "ÜRETİME_GÖNDERİLDİ" ||
      sale.status === "MONTAJA_GÖNDERİLDİ",
  ).length;

  const stats = [
    {
      name: "Toplam Cari",
      value: activeCustomersCount.toString(),
      icon: Users,
      href: "/cariler",
    },
    {
      name: "Bekleyen Ölçüler",
      value: inboundCount.toString(),
      icon: Ruler,
      href: "/olculer",
    },
    {
      name: "Aktif Satış / Sipariş",
      value: activeSales.length.toString(),
      icon: ShoppingCart,
      href: "/satis",
    },
    {
      name: "Stok Kalemleri",
      value: stockCount.toString(),
      icon: Package,
      href: "/stok",
    },
  ];

  const workflow = [
    {
      label: "Taslak / Teklif",
      value: draftSalesCount,
      detail: "Hazırlama veya müşteri onayı bekleyen satışlar",
    },
    {
      label: "Onaylandı",
      value: approvedSalesCount,
      detail: "Sipariş ve operasyon hazırlığı bekleyen satışlar",
    },
    {
      label: "Üretim / Montaj",
      value: orderSalesCount,
      detail: "Üretime veya montaja gönderilmiş aktif işler",
    },
  ];

  const quickLinks = [
    { label: "Cari", href: "/cariler", icon: Users },
    { label: "Ölçü", href: "/olculer", icon: Ruler },
    { label: "Görevler", href: "/gorevler", icon: ClipboardList },
    { label: "Satış", href: "/satis", icon: ShoppingCart },
    { label: "Stok", href: "/stok", icon: Package },
    { label: "Ajanda", href: "/ajanda", icon: CalendarDays },
  ].filter(item => {
    if(!currentUser) return false;

    if(item.href === "/ajanda") {
      return role !== "PLATFORM_SUPER_ADMIN";
    }

    return canViewModule(currentUser.role, item.href);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:p-5">
        <Image
          src="/brand/enverp-icon.png"
          alt="ENVerp"
          width={56}
          height={56}
          className="h-14 w-14 rounded-2xl shadow-sm"
        />

        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
            Ana Sayfa
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-blue-300">
              ENVerp
            </span>
            {" "}· Günlük operasyon kontrol merkezi
          </p>
        </div>

        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 sm:ml-auto">
          V1.0 SAHA PİLOT
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(stat => (
          <Link
            key={stat.name}
            href={stat.href}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 sm:p-4"
          >
            <div className="shrink-0 rounded-xl bg-slate-100 p-2.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <stat.icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-sm">
                {stat.name}
              </p>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white sm:text-2xl">
                {stat.value}
              </h3>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950 dark:text-white">
                Satış ve İş Akışı
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yalnız görüntüleme yetkiniz kapsamındaki satışlar.
              </p>
            </div>
            <ShoppingCart className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-3">
            {workflow.map(item => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-950/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-black text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">
                  {item.value}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            {inboundCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}

            <div>
              <h2 className="font-bold text-slate-950 dark:text-white">
                Ölçü Sağlığı
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gelen ölçüler havuzundaki işlem bekleyen kayıtlar.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
            <div className="text-3xl font-black text-slate-950 dark:text-white">
              {inboundCount}
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {inboundCount > 0
                ? "Kontrol / eşleştirme bekleyen ölçü var."
                : "Bekleyen problemli ölçü görünmüyor."}
            </div>
          </div>
        </section>
      </div>

      {quickLinks.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-bold text-slate-950 dark:text-white">
            Hızlı İşlemler
          </h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {quickLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/20"
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}