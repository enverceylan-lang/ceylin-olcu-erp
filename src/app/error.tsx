"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Beklenmeyen Bir Hata Oluştu</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
        Veriler yüklenirken veya işlenirken bir sorun meydana geldi. Bu durum genellikle veritabanı bağlantısının henüz yapılmamış olmasından kaynaklanır.
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white px-6 py-3 rounded-lg font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Tekrar Dene
      </button>
    </div>
  );
}
