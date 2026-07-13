"use client";

import { Plus, Search, MapPin, Phone, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import { getGoogleMapsUrl } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer, normalizeRole, canViewCariType, canViewCariList, canAddCustomer, canImportExportExcel } from "@/store/useAuthStore";

import { syncNow } from "@/lib/syncService";
import { RefreshCw, CheckCircle, AlertCircle, WifiOff, Upload, Download } from "lucide-react";
import { ExcelImportModal } from "@/components/modals/ExcelImportModal";
import { ExcelExportModal } from "@/components/modals/ExcelExportModal";
import { customerExcelProfile } from "@/lib/excelBridge";
import { normalizeCariName } from "@/lib/stringUtils";
import { saveLocalCustomer } from "@/lib/localCustomerDb";

export default function CarilerPage() {
  const { customers, deleteCustomer, syncStatus, addCustomer, updateCustomer } = useStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStandardizeModalOpen, setIsStandardizeModalOpen] = useState(false);
  const [standardizePreview, setStandardizePreview] = useState<{ total: number; changed: number; examples: string[] } | null>(null);
  const [isStandardizing, setIsStandardizing] = useState(false);

  const handlePreviewStandardization = () => {
    const changes: { oldName: string; newName: string }[] = [];
    customers.forEach(c => {
      if (c.name) {
        const norm = normalizeCariName(c.name);
        if (norm !== c.name) {
          changes.push({ oldName: c.name, newName: norm });
        }
      }
    });
    setStandardizePreview({
      total: customers.length,
      changed: changes.length,
      examples: changes.slice(0, 10).map(x => `${x.oldName} -> ${x.newName}`)
    });
    setIsStandardizeModalOpen(true);
  };

  const executeStandardization = async () => {
    if (!standardizePreview || standardizePreview.changed === 0) {
      setIsStandardizeModalOpen(false);
      return;
    }
    setIsStandardizing(true);
    let count = 0;
    try {
      for (const c of customers) {
        if (c.name) {
          const norm = normalizeCariName(c.name);
          if (norm !== c.name) {
            await saveLocalCustomer({ ...c, name: norm });
            count++;
          }
        }
      }
      alert(`${count} cari adı standartlaştırıldı.`);
      window.dispatchEvent(new Event('local-customers-updated'));
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setIsStandardizing(false);
      setIsStandardizeModalOpen(false);
    }
  };

  const handleImport = async (previewResult: any) => {
    for (const row of previewResult.rows) {
      if (row.status === 'NEW' || row.status === 'MANUAL_REVIEW') {
        await addCustomer(row.data);
      } else if (row.status === 'UPDATE' && row.matchedEntityId) {
        await updateCustomer(row.matchedEntityId, row.data);
      }
    }
  };

  const exportTemplates = [
    {
      name: "Opak Uyumlu Cari Export",
      columns: [
        { header: "Cari Kodu", dbField: "customerCode" },
        { header: "Cari Adı", dbField: "name" },
        { header: "Bakiye", dbField: "balance", formatter: (val: any) => val || 0 },
        { header: "Grup Kodu", dbField: "groupCode" },
        { header: "Grup Adı", dbField: "groupName" },
        { header: "Rapor Kodu 1", dbField: "reportCode1" },
        { header: "Adres", dbField: "address" },
        { header: "KONUM", dbField: "locationText" },
        { header: "Vergi No", dbField: "taxNumber" },
        { header: "Vergi Dairesi", dbField: "taxOffice" },
        { header: "Kimlik No", dbField: "identityNumber" },
        { header: "Tipi", dbField: "cariType" },
        { header: "Vade Günü", dbField: "dueDay" },
        { header: "Telefon", dbField: "phone" },
        { header: "Cep Tel 1", dbField: "mobile1" },
        { header: "Cep Tel 2", dbField: "mobile2" },
        { header: "EMail", dbField: "email" },
        { header: "Plasiyer Adı", dbField: "salespersonName" },
        { header: "Aktif", dbField: "isActive", formatter: (val: any) => val !== false ? "Evet" : "Hayır" },
        { header: "E-Fatura", dbField: "eInvoice", formatter: (val: any) => val ? "Evet" : "Hayır" },
        { header: "Cari Yetkili Adı", dbField: "authorizedPerson" },
        { header: "Risk Var Mı", dbField: "hasRisk", formatter: (val: any) => val ? "Evet" : "Hayır" },
        { header: "Risk", dbField: "riskLimit" },
        { header: "Tüm İşlemlerde Kilit", dbField: "isLockedForAllTransactions", formatter: (val: any) => val ? "Evet" : "Hayır" }
      ]
    },
    {
      name: "CEYLİN ERP Detaylı Cari Export",
      columns: [
        { header: "İç ID", dbField: "id" },
        { header: "Cari Kodu", dbField: "customerCode" },
        { header: "Cari Adı", dbField: "name" },
        { header: "Telefon", dbField: "phone" },
        { header: "Tipi", dbField: "cariType" },
        { header: "Bakiye", dbField: "balance" },
        { header: "Oluşturulma", dbField: "createdAt" },
        { header: "Güncellenme", dbField: "updatedAt" }
      ]
    }
  ];

  const handleDelete = async () => {
    if (!customerToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      deleteCustomer(customerToDelete.id);
      await syncNow();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
      setCustomerToDelete(null);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const allowedCariTypes = [
    { value: "CUSTOMER", label: "Müşteriler" },
    { value: "SUPPLIER", label: "Tedarikçiler" },
    { value: "TAILOR", label: "Terziler" },
    { value: "INSTALLER", label: "Montajcılar" },
    { value: "STAFF", label: "Personel" },
    { value: "OTHER", label: "Diğer" }
  ].filter(t => canViewCariType(currentUser, t.value));

  const filterTabs = allowedCariTypes.length > 1
    ? [{ value: "ALL", label: "Tüm Cariler" }, ...allowedCariTypes]
    : allowedCariTypes;

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncNow(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && mounted) {
      console.log('[Cariler UI Diagnostic] Current User:', currentUser ? {
        id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
        normRole: normalizeRole(currentUser.role)
      } : null);
      console.log('[Cariler UI Diagnostic] Store Customers Count:', customers.length);

      const targetNames = ['test tlf sync 01', 'TEST TELEFON SYNC'];
      targetNames.forEach(name => {
        const c = customers.find(x => x.name === name);
        if (c) {
          const isDel = !!c.isDeleted;
          const allowedRole = currentUser ? canViewCustomer(currentUser, c) : false;
          const cType = c.cariType || "CUSTOMER";
          const allowedType = allowedCariTypes.some(t => t.value === cType);
          const matchesFilter = selectedTypeFilter === "ALL" || cType === selectedTypeFilter;
          const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm));
          console.log(`[Cariler UI Target Debug] "${name}":`, {
            foundInStore: true,
            isDeleted: isDel,
            canViewCustomer: allowedRole,
            cariType: cType,
            allowedCariTypesContainsType: allowedType,
            selectedTypeFilterMatches: matchesFilter,
            searchQueryMatches: matchesSearch,
            visibleOnUI: !isDel && allowedRole && matchesFilter && matchesSearch
          });
        } else {
          console.log(`[Cariler UI Target Debug] "${name}": Not found in Zustand store`);
        }
      });
    }
  }, [customers, currentUser, searchTerm, selectedTypeFilter, mounted]);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const filteredCustomers = customers.filter(c => {
    if (c.isDeleted) return false;
    if (currentUser && !canViewCustomer(currentUser, c)) return false;
    
    const cType = c.cariType || "CUSTOMER";
    if (allowedCariTypes.length > 1 && selectedTypeFilter !== "ALL" && cType !== selectedTypeFilter) {
      return false;
    }

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

  const getCariTypeLabel = (type?: string) => {
    switch (type) {
      case 'SUPPLIER': return 'Tedarikçi';
      case 'TAILOR': return 'Terzi';
      case 'INSTALLER': return 'Montajcı';
      case 'STAFF': return 'Personel';
      case 'OTHER': return 'Diğer';
      default: return 'Müşteri';
    }
  };

  const getCariTypeColor = (type?: string) => {
    switch (type) {
      case 'SUPPLIER': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30';
      case 'TAILOR': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30';
      case 'INSTALLER': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/30';
      case 'STAFF': return 'bg-teal-100 text-teal-800 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-200 dark:border-teal-900/30';
      case 'OTHER': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700/50';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold heading-title">Cariler</h1>
          <p className="text-sm heading-subtitle">Müşterilerinizi yönetin ve yeni müşteri ekleyin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {canImportExportExcel(currentUser) && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Excel'den İçe Aktar
              </button>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                Excel'e Aktar
              </button>
            </>
          )}

          {canAddCustomer(currentUser) && (
            <Link href="/cariler/yeni" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm">
              <Plus className="w-4 h-4" />
              Yeni Cari Ekle
            </Link>
          )}
        </div>
      </div>

      {canViewCariList(currentUser) ? (
        <>
          {allowedCariTypes.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          {filterTabs.map(t => (
            <button
              key={t.value}
              onClick={() => setSelectedTypeFilter(t.value)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                selectedTypeFilter === t.value
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

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
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/cariler/${customer.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                          {customer.name}
                        </Link>
                        
                        {allowedCariTypes.length > 1 && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getCariTypeColor(customer.cariType)}`}>
                            {getCariTypeLabel(customer.cariType)}
                          </span>
                        )}

                        {customer.approvalStatus === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                            <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 text-amber-500" />
                            Onay Bekliyor
                          </span>
                        )}
                      </div>
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
                        {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'OFFICE' || currentUser.role === 'ACCOUNTING') && (
                          <button onClick={() => setCustomerToDelete(customer)} className="text-sm text-red-500 hover:text-red-700 transition-colors" title="Sil">
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

      {customerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-scale-in text-gray-950 dark:text-white">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-500 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold">Cariyi Sil</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bu cariyi silmek istediğinize emin misiniz?<br />
                <span className="font-semibold text-red-500">Bu işlem senkronize edilecek.</span>
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-250 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-750 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      ) : (
        <div className="p-8 text-center text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p>Müşteri listesini görüntüleme yetkiniz bulunmamaktadır.</p>
        </div>
      )}

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        profile={customerExcelProfile}
        existingData={customers}
        onImport={handleImport}
      />
      <ExcelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        profile={customerExcelProfile}
        data={customers}
        templates={exportTemplates}
      />

      {isStandardizeModalOpen && standardizePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Cari Adlarını Standartlaştır</h2>
            <div className="space-y-4 mb-6">
              <p className="text-gray-600 dark:text-gray-300">
                Sistemdeki cari adları büyük harf ve tek boşluk kuralına göre düzenlenecektir.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p><strong>Toplam Cari:</strong> {standardizePreview.total}</p>
                <p><strong>Düzeltilecek:</strong> {standardizePreview.changed}</p>
              </div>
              
              {standardizePreview.changed > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Örnekler:</h3>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                    {standardizePreview.examples.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg flex items-start gap-2 border border-yellow-200 dark:border-yellow-800/30">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                  Cari adları büyük harf standardına çevrilecek. Ölçü/satış/veri silinmeyecek. Devam edilsin mi?
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsStandardizeModalOpen(false)}
                disabled={isStandardizing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                İptal
              </button>
              <button
                onClick={executeStandardization}
                disabled={isStandardizing || standardizePreview.changed === 0}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {isStandardizing ? 'İşleniyor...' : 'Onayla ve Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
