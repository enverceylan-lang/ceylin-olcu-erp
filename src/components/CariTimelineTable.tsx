export interface CariTimelineEvent {
  date: string;
  action: string;
  description: string;
  personnel: string;
}

interface CariTimelineTableProps {
  events: readonly CariTimelineEvent[];
}

export function CariTimelineTable({ events }: CariTimelineTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-gray-200 dark:border-gray-800">
        <h4 className="font-bold text-gray-900 dark:text-white">Operasyonel Zaman Tüneli</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold">
              <th className="p-4 font-semibold">Tarih</th>
              <th className="p-4 font-semibold">İşlem</th>
              <th className="p-4 font-semibold">Açıklama</th>
              <th className="p-4 font-semibold">Personel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 dark:divide-gray-800">
            {events.map((e, index) => (
              <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <td className="p-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {new Date(e.date).toLocaleString('tr-TR')}
                </td>
                <td className="p-4 font-semibold text-gray-900 dark:text-white">
                  {e.action}
                </td>
                <td className="p-4 text-gray-600 dark:text-gray-300">
                  {e.description}
                </td>
                <td className="p-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {e.personnel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
