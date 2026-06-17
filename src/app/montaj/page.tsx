"use client";

import { Wrench, Calendar, MapPin } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";

export default function MontajPage() {
  const { montageTasks, customers, updateMontageStatus } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-8 text-center">Yükleniyor...</div>;

  const enrichedTasks = montageTasks.map(task => ({
    ...task,
    customerName: customers.find(c => c.id === task.customerId)?.name || "Bilinmiyor"
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Montaj Programı</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Montaj randevularını ve durumlarını yönetin.</p>
      </div>

      {enrichedTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500">
          Planlanmış montaj bulunmuyor. Yeni bir satış oluşturduğunuzda buraya düşecektir.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {enrichedTasks.map((task) => (
          <div key={task.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${task.status === 'Tamamlandı' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {task.status}
                </span>
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500">#SIP-{task.saleId}</span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{task.customerName}</h3>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{task.date} - {task.time}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{task.address}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(task.address)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 text-center bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Haritada Aç
              </a>
              {task.status !== 'Tamamlandı' ? (
                <button 
                  onClick={() => updateMontageStatus(task.id, 'Tamamlandı')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Tamamlandı Yap
                </button>
              ) : (
                <button 
                  onClick={() => updateMontageStatus(task.id, 'Planlandı')}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Geri Al
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
