"use client";

import { Plus, Search, MapPin, Phone, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Customer, useStore } from "@/store/useStore";
import { useState, useSyncExternalStore } from "react";
import { getGoogleMapsUrl } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer, normalizeRole, canViewCariType, canViewCariList, canAddCustomer, canImportExportExcel } from "@/store/useAuthStore";

import { syncNow } from "@/lib/syncService";
import { RefreshCw, Upload, Download } from "lucide-react";
import { ExcelImportModal } from "@/components/modals/ExcelImportModal";
import { ExcelExportModal } from "@/components/modals/ExcelExportModal";
import { customerExcelProfile, PreviewResult } from "@/lib/excelBridge";
import { normalizeCariName } from "@/lib/stringUtils";
import { saveLocalCustomer } from "@/lib/localCustomerDb";

type CustomerWithLegacyState = Customer & {
  status?: string;
  active?: boolean;
};

function isArchivedOrDeletedCustomer(customer: CustomerWithLegacyState) {
  return Boolean(
    customer.isArchived ||
    customer.archivedAt ||
    customer.deletedAt ||
    customer.isDeleted ||
    customer.status === 'ARCHIVED' ||
    customer.status === 'DELETED' ||
    customer.active === false ||
    customer.isActive === false
  );
}

export default function CarilerPage() {
  const { customers, deleteCustomer, addCustomer, updateCustomer } = useStore();
  const { currentUser } = useAuthStore();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [searchTerm, setSearchTerm] = useState("");
  const viewMode: 'ACTIVE' | 'ARCHIVED' | 'TRASH' = 'ACTIVE';
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStandardizeModalOpen, setIsStandardizeModalOpen] = useState(false);
  const [standardizePreview, setStandardizePreview] = useState<{ totalActive: number; changedActive: number; excludedCount: number; examples: string[] } | null>(null);
  const [isStandardizing, setIsStandardizing] = useState(false);

  const handlePreviewStandardization = () => {
    const changes: { oldName: string; newName: string }[] = [];
    let totalActive = 0;
    let excludedCount = 0;

    customers.forEach(c => {
      if (isArchivedOrDeletedCustomer(c)) {
        excludedCount++;
        return;
      }
      totalActive++;
      if (c.name) {
        const norm = normalizeCariName(c.name);
        if (norm !== c.name) {
          changes.push({ oldName: c.name, newName: norm });
        }
      }
    });

    setStandardizePreview({
      totalActive,
      changedActive: changes.length,
      excludedCount,
      examples: changes.slice(0, 10).map(x => `${x.oldName} -> ${x.newName}`)
    });
    setIsStandardizeModalOpen(true);
  };

  const executeStandardization = async () => {
    if (!standardizePreview || standardizePreview.changedActive === 0) {
      setIsStandardizeModalOpen(false);
      return;
    }
    setIsStandardizing(true);
    let count = 0;
    try {
      for (const c of customers) {
        if (isArchivedOrDeletedCustomer(c)) continue;
        
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
    } catch (error: unknown) {
      alert("Hata: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsStandardizing(false);
      setIsStandardizeModalOpen(false);
    }
  };

  const handleImport = async (previewResult: PreviewResult<Customer>) => {
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
        { header: "Bakiye", dbField: "balance", formatter: (val: unknown) => val || 0 },
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
        { header: "Aktif", dbField: "isActive", formatter: (val: unknown) => val !== false ? "Evet" : "Hayır" },
        { header: "E-Fatura", dbField: "eInvoice", formatter: (val: unknown) => val ? "Evet" : "Hayır" },
        { header: "Cari Yetkili Adı", dbField: "authorizedPerson" },
        { header: "Risk Var Mı", dbField: "hasRisk", formatter: (val: unknown) => val ? "Evet" : "Hayır" },
        { header: "Risk", dbField: "riskLimit" },
        { header: "Tüm İşlemlerde Kilit", dbField: "isLockedForAllTransactions", formatter: (val: unknown) => val ? "Evet" : "Hayır" }
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

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const filteredCustomers = customers.filter(c => {
    if (viewMode === 'ACTIVE') {
      if (c.isDeleted || c.isArchived) return false;
    } else if (viewMode === 'ARCHIVED') {
      if (!c.isArchived || c.isDeleted) return false;
    } else if (viewMode === 'TRASH') {
      if (!c.isDeleted) return false;
    }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold heading-title sm:text-2xl">Cariler</h1>
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
                Excel&apos;den İçe Aktar
              </button>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm"
              >
                <Download className="w-4 h-4" />
                Excel&apos;e Aktar
                </button>
              </>
            )}
            {currentUser && normalizeRole(currentUser.role) === 'ADMIN' && (
              <button
                onClick={handlePreviewStandardization}
                className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Cari Adlarını Standartlaştır
              </button>
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
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Müşteri ara..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
              {sortedCustomers.length} cari gösteriliyor
            </span>
          </div>
        </div>
        
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[19%]" />
              <col className="w-[30%]" />
              <col className="w-[13%]" />
            </colgroup>
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
                    <td className="min-w-0 p-4">
                      <div className="min-w-0 space-y-1.5">
                        <Link
                          href={`/cariler/${customer.id}`}
                          title={customer.name}
                          className="block truncate font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {customer.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {customer.approvalStatus === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 text-amber-500" />
                              Onay Bekliyor
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <a
                        href={customer.phone ? `tel:${customer.phone}` : undefined}
                        className="flex items-center gap-2 truncate hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{customer.phone || '-'}</span>
                      </a>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">
                      <div className="flex min-w-0 items-start gap-2">
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
                        <span className="line-clamp-2 text-xs leading-5" title={customer.address || '-'}>
                          {customer.address || '-'}
                        </span>
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

        <div className="divide-y divide-gray-100 dark:divide-gray-800 md:hidden">
          {sortedCustomers.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Henüz kayıtlı müşteri bulunmuyor.
            </p>
          ) : (
            sortedCustomers.map((customer) => {
              const mapsUrl = getGoogleMapsUrl(customer);
              return (
                <article key={customer.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4">
                  <div className="min-w-0 space-y-2">
                    <div className="min-w-0">
                      <Link
                        href={`/cariler/${customer.id}`}
                        className="block truncate font-semibold text-blue-600 dark:text-blue-400"
                      >
                        {customer.name}
                      </Link>
                      {customer.approvalStatus === 'PENDING_APPROVAL' && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/40 dark:text-amber-400">
                            <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                            Onay Bekliyor
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                      <a href={customer.phone ? `tel:${customer.phone}` : undefined} className="flex min-w-0 items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">{customer.phone || '-'}</span>
                      </a>
                      <div className="flex min-w-0 items-start gap-2">
                        {mapsUrl ? (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Haritada Göster">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                          </a>
                        ) : (
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-700" />
                        )}
                        <span className="line-clamp-2 text-xs leading-5">{customer.address || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-24 shrink-0 flex-col items-stretch gap-1.5 self-stretch">
                    <Link
                      href={`/cariler/${customer.id}`}
                      className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-blue-600 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-white transition-colors hover:bg-blue-700"
                    >
                      Cari ve Ölçü<br />Detayı
                    </Link>
                    {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'OFFICE' || currentUser.role === 'ACCOUNTING') && (
                      <button
                        onClick={() => setCustomerToDelete(customer)}
                        className="flex h-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                        title="Sil"
                        aria-label={`${customer.name} carisini sil`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
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
                <p><strong>Toplam Aktif Cari:</strong> {standardizePreview.totalActive}</p>
                  <p><strong>Düzeltilecek Aktif Cari:</strong> {standardizePreview.changedActive}</p>
                  <p><strong>Hariç Tutulan Arşiv/Silinmiş Cari:</strong> {standardizePreview.excludedCount}</p>
              </div>
              
              {standardizePreview.changedActive > 0 && (
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
                disabled={isStandardizing || standardizePreview.changedActive === 0}
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
