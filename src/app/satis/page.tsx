"use client";

import { Plus, Search, FileText } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";

export default function SatisPage() {
  const { sales, customers } = useStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-8 text-center">Yükleniyor...</div>;

  const enrichedSales = sales.map(sale => ({
    ...sale,
    customerName: customers.find(c => c.id === sale.customerId)?.name || "Silinmiş Müşteri"
  })).filter(sale => 
    sale.id.includes(searchTerm) || 
    sale.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Satışlar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Siparişleri ve satışları takip edin.</p>
        </div>
        <Link href="/satis/yeni" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          Yeni Satış Oluştur
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sipariş veya müşteri ara..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                <th className="p-4 font-medium">Sipariş No</th>
                <th className="p-4 font-medium">Müşteri</th>
                <th className="p-4 font-medium">Tarih</th>
                <th className="p-4 font-medium">Durum</th>
                <th className="p-4 font-medium text-right">Tutar</th>
                <th className="p-4 font-medium text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {enrichedSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">Henüz satış bulunmuyor.</td>
                </tr>
              ) : null}
              {enrichedSales.map((sale) => (
                <tr key={sale.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900 dark:text-white">#SIP-{sale.id.padStart(4, '0')}</td>
                  <td className="p-4 text-blue-600 dark:text-blue-400 font-medium">
                    <Link href={`/cariler/${sale.customerId}`}>{sale.customerName}</Link>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">{sale.date}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded text-xs font-medium">
                      {sale.status}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">₺{sale.totalAmount.toFixed(2)}</td>
                  <td className="p-4 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Detay</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
