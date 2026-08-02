"use client";

import { Users, Ruler, Package, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { useEffect, useState } from "react";
import { localDraftDb } from "@/lib/localDraftDb";
import { useAuthStore } from "@/store/useAuthStore";
import { getVisibleSales } from "@/lib/salesVisibility";

export default function Home() {
  const { customers, products } = useStore();
  const { sales, loadSales } = useSalesStore();
  const currentUser = useAuthStore(state => state.currentUser);
  const [inboundCount, setInboundCount] = useState(0);

  useEffect(() => {
    loadSales();
    localDraftDb.inboundMeasurements.toArray().then(items => {
      const pending = items.filter(i => i.status === 'NEW' || i.status === 'MATCH_PENDING');
      setInboundCount(pending.length);
    }).catch(err => {
      console.error("Failed to load inbound measurements for dashboard", err);
    });
  }, [loadSales]);

  const activeCustomersCount = customers.filter(c => !c.isDeleted && !c.isArchived).length;
  const activeSalesCount = getVisibleSales(currentUser, sales)
    .filter(s => s.status !== 'İPTAL' && s.status !== 'TAMAMLANDI')
    .length;
  // Use products if it exists, otherwise 0
  const stockCount = products ? products.length : 0;

  const stats = [
    { name: "Toplam Cari", value: activeCustomersCount.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400" },
    { name: "Bekleyen Ölçüler", value: inboundCount.toString(), icon: Ruler, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400" },
    { name: "Aktif Siparişler", value: activeSalesCount.toString(), icon: ShoppingCart, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400" },
    { name: "Stok Kalemleri", value: stockCount.toString(), icon: Package, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:p-5">
        <Image src="/brand/enverp-icon.png" alt="ENVerp" width={56} height={56} className="h-14 w-14 rounded-2xl shadow-sm" />
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">Ana Sayfa</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold text-blue-700 dark:text-blue-300">ENVerp</span> · Entegre Net Veri</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 sm:ml-auto">V1.0 SAHA PİLOT</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-4">
            <div className={`shrink-0 rounded-xl p-2.5 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">{stat.name}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400"><span className="block font-semibold text-gray-700 dark:text-gray-300">Satış görünümü</span><span className="mt-1 block text-xs">Veri kaynağı hazır olduğunda burada gösterilecek.</span></p>
        </div>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400"><span className="block font-semibold text-gray-700 dark:text-gray-300">Son işlemler</span><span className="mt-1 block text-xs">Gerçek işlem kaynağı hazır olduğunda burada listelenecek.</span></p>
        </div>
      </div>
    </div>
  );
}
