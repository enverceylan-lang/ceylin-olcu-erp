"use client";

import { useState } from "react";
import { X, Download, FileSpreadsheet } from "lucide-react";
import { ExportTemplate, exportToExcel, ExcelProfile } from "@/lib/excelBridge";

interface ExcelExportModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  profile: ExcelProfile<T>;
  data: T[];
  templates: ExportTemplate[];
  onFilterData?: (data: T[], filter: string) => T[];
}

export function ExcelExportModal<T>({ 
  isOpen, 
  onClose, 
  profile, 
  data, 
  templates,
  onFilterData 
}: ExcelExportModalProps<T>) {
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [filter, setFilter] = useState("ALL"); // ALL, ACTIVE, PASSIVE, WITH_RISK
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsProcessing(true);
    try {
      let exportData = data;
      if (onFilterData) {
        exportData = onFilterData(data, filter);
      } else {
        // Fallback simple filters if onFilterData not provided
        if (filter === "ACTIVE") {
          exportData = data.filter((item: any) => item.isActive !== false && !item.isDeleted);
        } else if (filter === "PASSIVE") {
          exportData = data.filter((item: any) => item.isActive === false || item.isDeleted);
        } else if (filter === "WITH_RISK") {
          exportData = data.filter((item: any) => item.hasRisk === true);
        }
      }

      if (exportData.length === 0) {
        alert("Dışa aktarılacak (filtrelenmiş) veri bulunamadı.");
        setIsProcessing(false);
        return;
      }

      const template = templates[selectedTemplateIndex];
      const fileName = `${profile.moduleName}_DisaAktarim_${new Date().toISOString().split('T')[0]}`;
      
      exportToExcel(exportData, profile, template, fileName);
      onClose();
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Excel'e Aktar
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Dışa aktarım için şablon ve filtre seçin
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50 space-y-6">
          
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Şablon Seçimi
            </label>
            <div className="grid gap-2">
              {templates.map((template, idx) => (
                <label 
                  key={idx}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    selectedTemplateIndex === idx 
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" 
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="template" 
                    checked={selectedTemplateIndex === idx}
                    onChange={() => setSelectedTemplateIndex(idx)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded-full"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">{template.name}</span>
                    <span className="block text-xs text-gray-500">{template.columns.length} Kolon</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Filtreler
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 outline-none focus:border-indigo-500 text-sm"
            >
              <option value="ALL">Tüm Kayıtlar (Silinmişler Hariç)</option>
              <option value="ACTIVE">Sadece Aktif Kayıtlar</option>
              <option value="PASSIVE">Sadece Pasif Kayıtlar</option>
              <option value="WITH_RISK">Riskli Kayıtlar</option>
            </select>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-2xl flex justify-end items-center gap-3">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
          >
            İptal
          </button>
          
          <button 
            onClick={handleExport}
            disabled={isProcessing}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? "Hazırlanıyor..." : "Excel'i İndir"}
            {!isProcessing && <Download className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
