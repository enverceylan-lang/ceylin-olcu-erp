"use client";

import { Plus, Search, MapPin, Phone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { getGoogleMapsUrl } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer, normalizeRole } from "@/store/useAuthStore";

export default function CarilerPage() {
  const { customers, deleteCustomer } = useStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const filteredCustomers = customers.filter(c => {
    if (currentUser && !canViewCustomer(currentUser, c)) return false;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone && c.phone.includes(searchTerm))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cariler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Müşterilerinizi yönetin ve yeni müşteri ekleyin.</p>
        </div>
        <Link href="/cariler/yeni" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
          <Plus className="w-4 h-4" />
          Yeni Cari Ekle
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
              placeholder="Müşteri ara..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
                <th className="p-4 font-medium">Müşteri Adı</th>
                <th className="p-4 font-medium">Telefon</th>
                <th className="p-4 font-medium">Adres</th>
                <th className="p-4 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Henüz kayıtlı müşteri bulunmuyor.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <Link href={`/cariler/${customer.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {customer.phone || '-'}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2 max-w-xs truncate">
                        {(() => {
                          const mapsUrl = getGoogleMapsUrl(customer);
                          if (mapsUrl) {
                            return (
                              <a 
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex-shrink-0"
                                title="Haritada Göster"
                              >
                                <MapPin className="w-4 h-4" />
                              </a>
                            );
                          }
                          return (
                            <span 
                              title="Konum eklenmemiş"
                              className="cursor-not-allowed flex-shrink-0"
                            >
                              <MapPin className="w-4 h-4 text-gray-300 dark:text-gray-700" />
                            </span>
                          );
                        })()}
                        <span className="truncate">{customer.address || '-'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/cariler/${customer.id}`} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                          Ölçüler
                        </Link>
                        {currentUser && normalizeRole(currentUser.role) === 'ADMIN' && (
                          <button onClick={() => deleteCustomer(customer.id)} className="text-sm text-red-500 hover:text-red-700 transition-colors" title="Sil">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
