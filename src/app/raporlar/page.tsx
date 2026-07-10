"use client";

import { FileText, Download, TrendingUp, DollarSign } from "lucide-react";
import { useSalesStore } from "@/store/salesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useState } from "react";

export default function RaporlarPage() {
  const { sales, loadSales, isLoading } = useSalesStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadSales();
  }, [loadSales]);

  if (!mounted || isLoading) return <div className="p-8 text-center">Yükleniyor...</div>;

  const isAdmin = currentUser?.role === "ADMIN";
  const isModerator = currentUser?.role === "MODERATOR" || currentUser?.role === "OFFICE" || currentUser?.role === "SALES";
  const isField = currentUser?.role === "FIELD" || currentUser?.role === "MEASUREMENT";
  const isTailor = currentUser?.role === "TAILOR" || currentUser?.role === "PRODUCTION";
  const isInstaller = currentUser?.role === "INSTALLER" || currentUser?.role === "INSTALLATION";

  // SAHA / TERZİ / MONTAJCI shouldn't see financial reports
  if (isField || isTailor || isInstaller || (!isAdmin && !isModerator)) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold heading-title">Raporlar</h1>
            <p className="text-sm heading-subtitle">Bu rol için finansal rapor görüntüleme yetkisi bulunmuyor.</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback check according to prompt instructions. No personal data in console!
  // currentUser.id varsa id üzerinden eşleştir. id yoksa username üzerinden güvenli fallback yap.
  // Fallback kullanılırsa yorum satırıyla belirt ama console'a kişisel veri basma.
  const visibleSales = isAdmin 
    ? sales 
    : sales.filter((sale: any) => {
        const sid = sale.createdByUserId || sale.createdById || sale.sellerId || sale.userId || sale.salesPersonId;
        const sname = sale.createdBy || sale.createdByUsername || sale.salesPersonName;
        
        if (sid && currentUser?.id && sid === currentUser.id) return true;
        
        // username üzerinden güvenli fallback yap
        if (!sid && sname && currentUser?.username && sname === currentUser.username) return true;
        
        return false;
      });

  const totalOrders = visibleSales.length;
  const totalRevenue = visibleSales.reduce((acc, sale) => acc + (sale.totalAmount || 0), 0);

  const title = isAdmin ? "Raporlar" : "Satış Raporlarım";
  const subtitle = isAdmin ? "İşletmenizin finansal ve operasyonel raporları." : "Kendi satış performansınızı ve işlem özetinizi görüntüleyin.";

  const orderCardTitle = isAdmin ? "Aylık Satış Özeti" : "Benim Aylık Satışlarım";
  const revenueCardTitle = isAdmin ? "Aylık Ciro" : "Benim Aylık Ciro";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold heading-title">{title}</h1>
          <p className="text-sm heading-subtitle">{subtitle}</p>
        </div>
        
        {isAdmin && (
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
            <Download className="w-4 h-4" />
            Raporu İndir (PDF)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex items-center gap-4 h-32">
          <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{orderCardTitle}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOrders} Sipariş</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex items-center gap-4 h-32">
          <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{revenueCardTitle}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalRevenue)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Detaylı Rapor Grafikleri</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Detaylı rapor grafikleri veritabanı bağlandıktan sonra aktif olacaktır.</p>
        </div>
      </div>
    </div>
  );
}
