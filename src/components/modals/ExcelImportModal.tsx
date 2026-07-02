"use client";

import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { readExcelHeaders, autoMapHeaders, generatePreview, ExcelProfile, ExcelColumnMapping, PreviewResult } from "@/lib/excelBridge";

interface ExcelImportModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  profile: ExcelProfile<T>;
  existingData: T[];
  onImport: (previewResult: PreviewResult) => Promise<void>;
}

export function ExcelImportModal<T>({ isOpen, onClose, profile, existingData, onImport }: ExcelImportModalProps<T>) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Select File, 2: Select Sheet, 3: Mapping, 4: Preview
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ExcelColumnMapping[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsProcessing(true);
    try {
      const { sheets: fileSheets, headers: sheetHeaders } = await readExcelHeaders(selectedFile);
      setSheets(fileSheets);
      
      if (fileSheets.length === 1) {
        setSelectedSheet(fileSheets[0]);
        setHeaders(sheetHeaders);
        setMappings(autoMapHeaders(sheetHeaders, profile));
        setStep(3); // Skip sheet selection if only 1 sheet
      } else {
        setStep(2);
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSheetSelect = async (sheetName: string) => {
    if (!file) return;
    setSelectedSheet(sheetName);
    setIsProcessing(true);
    try {
      const { headers: sheetHeaders } = await readExcelHeaders(file, sheetName);
      setHeaders(sheetHeaders);
      setMappings(autoMapHeaders(sheetHeaders, profile));
      setStep(3);
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (excelColumn: string, dbField: string, isCustomField: boolean) => {
    setMappings(prev => prev.map(m => 
      m.excelColumn === excelColumn ? { ...m, dbField, isCustomField } : m
    ));
  };

  const handleGeneratePreview = async () => {
    if (!file || !selectedSheet) return;
    setIsProcessing(true);
    try {
      const result = await generatePreview(file, selectedSheet, mappings, profile, existingData);
      setPreview(result);
      setStep(4);
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setIsProcessing(true);
    try {
      await onImport(preview);
      onClose();
    } catch (err: any) {
      alert("İçe aktarma hatası: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setSheets([]);
    setSelectedSheet("");
    setHeaders([]);
    setMappings([]);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Excel'den İçe Aktar
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1 ? "Yüklenecek dosyayı seçin" :
               step === 2 ? "Çalışma sayfasını seçin" :
               step === 3 ? "Kolon eşleştirmelerini yapın" :
               "Ön izleme ve onay"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
          
          {step === 1 && (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileSelect} 
                className="hidden" 
                ref={fileInputRef} 
              />
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Excel dosyanızı seçin (.xlsx, .xls)</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isProcessing ? "İşleniyor..." : "Dosya Seç"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Çalışma Sayfaları ({sheets.length})</h3>
              <div className="grid gap-3">
                {sheets.map(sheet => (
                  <button
                    key={sheet}
                    onClick={() => handleSheetSelect(sheet)}
                    disabled={isProcessing}
                    className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 transition-colors text-left"
                  >
                    <span className="font-medium">{sheet}</span>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p><strong>Önemli:</strong> Eşleştirilmeyen (boş bırakılan) kolonlar <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">Özel Alan (rawImportData)</span> olarak saklanacaktır.</p>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3 font-medium text-gray-600 dark:text-gray-300">Excel Kolonu</th>
                      <th className="p-3 font-medium text-gray-600 dark:text-gray-300 w-1/2">Sistem Alanı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-3 font-medium">{mapping.excelColumn}</td>
                        <td className="p-3">
                          <select 
                            value={mapping.isCustomField ? "CUSTOM" : mapping.dbField}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "CUSTOM") handleMappingChange(mapping.excelColumn, "", true);
                              else handleMappingChange(mapping.excelColumn, val, false);
                            }}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 outline-none focus:border-blue-500"
                          >
                            <option value="CUSTOM">-- Özel Alan Olarak Ekle --</option>
                            <optgroup label="Zorunlu Alanlar">
                              {profile.knownColumns.filter(c => c.required).map(c => (
                                <option key={c.dbField as string} value={c.dbField as string}>{c.aliases[0]}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Standart Alanlar">
                              {profile.knownColumns.filter(c => !c.required).map(c => (
                                <option key={c.dbField as string} value={c.dbField as string}>{c.aliases[0]}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && preview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                  <div className="text-3xl font-bold text-gray-800 dark:text-white">{preview.totalRows}</div>
                  <div className="text-sm text-gray-500 font-medium">Toplam Satır</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{preview.newCount}</div>
                  <div className="text-sm text-emerald-700 font-medium">Yeni Kayıt</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{preview.updateCount}</div>
                  <div className="text-sm text-blue-700 font-medium">Güncellenecek</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{preview.manualReviewCount}</div>
                  <div className="text-sm text-amber-700 font-medium">Manuel Onay</div>
                </div>
              </div>

              {preview.errorCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-300">
                    <p className="font-bold">Hatalı Satırlar Bulundu ({preview.errorCount})</p>
                    <p>Zorunlu alan eksikliği veya format hatası olan satırlar içeri aktarılmayacaktır.</p>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-2 font-medium">Satır</th>
                      <th className="p-2 font-medium">Durum</th>
                      <th className="p-2 font-medium">Birincil Veri</th>
                      <th className="p-2 font-medium">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="p-2 text-gray-500">{r.index + 2}</td>
                        <td className="p-2">
                          {r.status === 'NEW' && <span className="text-emerald-600 font-medium">YENİ</span>}
                          {r.status === 'UPDATE' && <span className="text-blue-600 font-medium">GÜNCELLE</span>}
                          {r.status === 'ERROR' && <span className="text-red-600 font-medium">HATA</span>}
                          {r.status === 'MANUAL_REVIEW' && <span className="text-amber-600 font-medium">UYARI (YENİ)</span>}
                        </td>
                        <td className="p-2 font-medium">
                          {r.data.customerCode || r.data.stockCode || r.data.name || "-"}
                        </td>
                        <td className="p-2 text-gray-600 dark:text-gray-400">
                          {r.errors.length > 0 ? r.errors.join(", ") : r.warnings.length > 0 ? r.warnings.join(", ") : "OK"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-2xl flex justify-between items-center">
          <div>
            {step > 1 && (
              <button 
                onClick={resetState}
                disabled={isProcessing}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                İptal Et ve Başa Dön
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
            >
              Kapat
            </button>
            
            {step === 3 && (
              <button 
                onClick={handleGeneratePreview}
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? "İşleniyor..." : "Ön İzleme Oluştur"}
                {!isProcessing && <ArrowRight className="w-4 h-4" />}
              </button>
            )}

            {step === 4 && (
              <button 
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? "Aktarılıyor..." : "Onayla ve Aktar"}
                {!isProcessing && <Check className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
