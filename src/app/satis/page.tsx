"use client";

import { Plus, Search, FileText } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useSalesStore } from "@/store/salesStore";
import { useEffect, useState } from "react";

export default function SatisPage() {
  const { customers } = useStore();
  const { sales, loadSales, isLoading } = useSalesStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setMounted(true);
    loadSales();
  }, [loadSales]);

  if (!mounted || isLoading) return <div className="p-8 text-center">Yükleniyor...</div>;

  const enrichedSales = sales.map(sale => ({
    ...sale,
    customerName: customers.find(c => c.id === sale.customerId)?.name || "Silinmiş Müşteri"
  })).filter(sale => 
    sale.saleNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sale.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold heading-title">Satışlar & Teklifler</h1>
          <p className="text-sm heading-subtitle">Müşterilere ait teklif, sipariş ve satış kayıtları</p>
        </div>
        <Link href="/satis/yeni" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          Merkezi Satış Taslağı
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Satış No veya Müşteri Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-4">Satış No</th>
                <th className="px-6 py-4">Tarih</th>
                <th className="px-6 py-4">Müşteri</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">Tutar</th>
                <th className="px-6 py-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {enrichedSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                enrichedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {sale.saleNo}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(sale.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      {sale.customerName}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                        ${sale.status === 'TASLAK' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' :
                        sale.status === 'TEKLİF' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        sale.status === 'ONAYLANDI' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
                        sale.status === 'TAMAMLANDI' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        sale.status === 'İPTAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'}`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(sale.remainingBalance || 0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href={`/satis/${sale.id}`}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
