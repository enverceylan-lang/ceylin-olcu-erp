"use client";

import { Plus, Search, Package, Image as ImageIcon } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";

export default function StokPage() {
  const { products } = useStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-8 text-center">Yükleniyor...</div>;

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.stockCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stok Yönetimi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ürünlerinizi ve fiyatlarınızı yönetin.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          Yeni Ürün Ekle
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün adı veya stok kodu..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white outline-none">
              <option>Tüm Birimler</option>
              <option>Metre</option>
              <option>m²</option>
              <option>Adet</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                <th className="p-4 font-medium w-16">Görsel</th>
                <th className="p-4 font-medium">Stok Kodu</th>
                <th className="p-4 font-medium">Ürün Adı</th>
                <th className="p-4 font-medium">Kategori</th>
                <th className="p-4 font-medium">Birim</th>
                <th className="p-4 font-medium text-right">Peşin Fiyat</th>
                <th className="p-4 font-medium text-right">Taksitli Fiyat</th>
                <th className="p-4 font-medium text-right">Bayi Fiyat</th>
                <th className="p-4 font-medium text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4">
                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-200 dark:border-gray-700">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-900 dark:text-white">{product.stockCode}</td>
                  <td className="p-4 text-gray-900 dark:text-white">{product.name}</td>
                  <td className="p-4 text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                      {product.category || '-'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
                      {product.unit}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-gray-900 dark:text-white">₺{product.cashPrice}</td>
                  <td className="p-4 text-right text-gray-600 dark:text-gray-300">₺{product.installmentPrice}</td>
                  <td className="p-4 text-right text-blue-600 dark:text-blue-400 font-medium">₺{product.dealerPrice}</td>
                  <td className="p-4 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Düzenle</button>
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
