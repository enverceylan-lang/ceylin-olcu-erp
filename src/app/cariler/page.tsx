"use client";

import { Plus, Search, MapPin, Phone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { getGoogleMapsUrl } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer, normalizeRole } from "@/store/useAuthStore";

import { syncNow } from "@/lib/syncService";
import { RefreshCw, CheckCircle, AlertCircle, WifiOff } from "lucide-react";

export default function CarilerPage() {
  const { customers, deleteCustomer, syncStatus } = useStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncNow();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const filteredCustomers = customers.filter(c => {
    if (currentUser && !canViewCustomer(currentUser, c)) return false;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone && c.phone.includes(searchTerm))
    );
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cariler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Müşterilerinizi yönetin ve yeni müşteri ekleyin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700/50">
            Zustand Store: <span className="font-bold">{customers.length}</span> | Listelenen: <span className="font-bold">{sortedCustomers.length}</span>
          </div>

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              syncStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' :
              syncStatus === 'pending' || syncing ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse' :
              syncStatus === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20' :
              'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
            }`}
            title="Senkronizasyonu Tetikle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing || syncStatus === 'pending' ? 'animate-spin' : ''}`} />
            {syncStatus === 'synced' ? 'Eşitlendi' :
             syncStatus === 'pending' || syncing ? 'Eşitleniyor...' :
             syncStatus === 'error' ? 'Senkronizasyon Hatası' : 'Çevrimdışı'}
          </button>

          <Link href="/cariler/yeni" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
            <Plus className="w-4 h-4" />
            Yeni Cari Ekle
          </Link>
        </div>
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
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Henüz kayıtlı müşteri bulunmuyor.
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => (
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
