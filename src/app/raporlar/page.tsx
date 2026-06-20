import { FileText, Download, TrendingUp, DollarSign } from "lucide-react";

export default function RaporlarPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold heading-title">Raporlar</h1>
          <p className="text-sm heading-subtitle">İşletmenizin finansal ve operasyonel raporları.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
          <Download className="w-4 h-4" />
          Raporu İndir (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex items-center gap-4 h-32">
          <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Aylık Satış Özeti</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">32 Sipariş</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex items-center gap-4 h-32">
          <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Aylık Ciro</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">₺125,400</p>
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
