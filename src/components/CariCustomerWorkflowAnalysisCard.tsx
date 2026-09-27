interface CariCustomerWorkflowAnalysisCardProps {
  jobDurationDays: number;
  workflowStatusLabel: string | undefined;
}

export function CariCustomerWorkflowAnalysisCard({
  jobDurationDays,
  workflowStatusLabel,
}: CariCustomerWorkflowAnalysisCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cari İş Akış Analizi</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block mb-1">TOPLAM İŞ SÜRESİ</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{jobDurationDays} Gün</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">Cari oluşturulma tarihi ile bugün arasındaki süre</span>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-800 rounded-xl">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">İŞ AKIŞ DURUMU</span>
          <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{workflowStatusLabel}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">Müşterinin güncel operasyonel aşaması</span>
        </div>
      </div>
    </div>
  );
}
