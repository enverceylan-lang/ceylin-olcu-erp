"use client";

import { Users, Ruler, Package, ShoppingCart } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { useEffect, useState } from "react";
import { localDraftDb } from "@/lib/localDraftDb";

export default function Home() {
  const { customers, products } = useStore();
  const { sales, loadSales } = useSalesStore();
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
  const activeSalesCount = sales.filter(s => s.status !== 'İPTAL' && s.status !== 'TAMAMLANDI').length;
  // Use products if it exists, otherwise 0
  const stockCount = products ? products.length : 0;

  const stats = [
    { name: "Toplam Cari", value: activeCustomersCount.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400" },
    { name: "Bekleyen Ölçüler", value: inboundCount.toString(), icon: Ruler, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400" },
    { name: "Aktif Siparişler", value: activeSalesCount.toString(), icon: ShoppingCart, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400" },
    { name: "Stok Kalemleri", value: stockCount.toString(), icon: Package, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold heading-title">Dashboard</h1>
        <p className="text-sm heading-subtitle">Curtain ERP sistemine hoş geldiniz.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-4">
            <div className={`p-4 rounded-full ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-96 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Satış Grafiği (Çok Yakında)</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 h-96 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Son İşlemler (Çok Yakında)</p>
        </div>
      </div>
    </div>
  );
}
