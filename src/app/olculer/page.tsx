"use client";

import {
  Search, Ruler, ArrowRight, ChevronDown, ChevronUp, User, Calendar, Layers,
  Image, Video as VideoIcon, CheckCircle2, AlertCircle, ClipboardList,
  Trash2, Edit3, X, Save, BadgeCheck, Filter, CloudDownload, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { useEffect, useState, useMemo } from "react";
import { getMeasurementDimensions, getTemplateLabel } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer } from "@/store/useAuthStore";
import {
  localDraftDb,
  FieldMeasurementDraft,
  updateMeasurementDraft,
  markDraftReadyToTransfer,
  deleteMeasurementDraft,
  listInboundMeasurements,
  type InboundMeasurement,
  updateInboundStatus
} from "@/lib/localDraftDb";
import { pullInboundMeasurements } from "@/lib/deltaSyncClient";
import { processAsNewCustomer, processAsMerge } from "@/lib/inboundProcessor";

// ─── Status helpers ────────────────────────────────────────────────────────────

type DraftStatus = FieldMeasurementDraft["syncStatus"];

const STATUS_LABELS: Record<DraftStatus, string> = {
  DRAFT: "Taslak",
  READY_TO_TRANSFER: "Aktarıma Hazır",
  TRANSFERRING: "Aktarılıyor",
  TRANSFERRED: "Aktarıldı",
  ERROR: "Hatalı",
};

const STATUS_COLORS: Record<DraftStatus, string> = {
  DRAFT:
    "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
  READY_TO_TRANSFER:
    "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
  TRANSFERRING:
    "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40",
  TRANSFERRED:
    "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/40",
  ERROR:
    "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/40",
};

type FilterKey = "ALL" | DraftStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "Tümü" },
  { key: "DRAFT", label: "Taslak" },
  { key: "READY_TO_TRANSFER", label: "Aktarıma Hazır" },
  { key: "TRANSFERRED", label: "Aktarıldı" },
  { key: "ERROR", label: "Hatalı" },
];

// ─── Edit modal state ──────────────────────────────────────────────────────────

interface EditForm {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OlculerPage() {
  const { customers } = useStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [localDrafts, setLocalDrafts] = useState<FieldMeasurementDraft[]>([]);
  const [draftFilter, setDraftFilter] = useState<FilterKey>("ALL");

  const [inboundMeasurements, setInboundMeasurements] = useState<InboundMeasurement[]>([]);
  const [isPulling, setIsPulling] = useState(false);
  const [inboundSelections, setInboundSelections] = useState<Record<string, string>>({});
  const [processingInboundId, setProcessingInboundId] = useState<string | null>(null);

  // Cari Rehberi modal state
  const [customerSearchInboundId, setCustomerSearchInboundId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  // Detail panel
  const [detailDraftId, setDetailDraftId] = useState<string | null>(null);

  // Edit modal
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const loadDrafts = async () => {
    try {
      const drafts = await localDraftDb.measurementDrafts.toArray();
      drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setLocalDrafts(drafts);
    } catch (err) {
      console.error("Yerel taslaklar yüklenemedi:", err);
    }
  };

  const loadInbound = async () => {
    try {
      const data = await listInboundMeasurements();
      setInboundMeasurements(data.filter(d => d.status === 'NEW' || d.status === 'MATCH_PENDING'));
    } catch (err) {}
  };

  const handlePullInbound = async () => {
    setIsPulling(true);
    try {
      const res = await pullInboundMeasurements(customers);
      if (res.success) {
        if (res.fetchedCount > 0) alert(`Havuz güncellendi. ${res.fetchedCount} yeni ölçü alındı.`);
        else alert('Havuza düşen yeni bir ölçü yok.');
      } else {
        alert('Çekerken hata: ' + res.errors.join(', '));
      }
      await loadInbound();
    } catch(e) {
       console.error(e);
    } finally {
      setIsPulling(false);
    }
  };

  const handleInboundCreateNew = async (inbound: InboundMeasurement) => {
    if (inbound.suggestedCustomerIds && inbound.suggestedCustomerIds.length > 0) {
      const confirm = window.confirm("Benzer cari bulundu, yine de yeni cari açılsın mı?");
      if (!confirm) return;
    }
    
    setProcessingInboundId(inbound.changeId);
    try {
      await processAsNewCustomer(inbound, currentUser?.id || 'admin', currentUser?.username || 'Admin');
      alert("Gelen ölçü yeni cari olarak açıldı.");
      await loadInbound();
      // Notify zustand components to refresh
      window.dispatchEvent(new Event('local-customers-updated'));
    } catch (e: any) {
      alert("İşlem tamamlanamadı. Veriler korunuyor. Hata: " + e.message);
    } finally {
      setProcessingInboundId(null);
    }
  };

  const handleInboundMerge = async (inbound: InboundMeasurement) => {
    // Determine the final selected customer
    // 1. the explicit selection from state
    // 2. OR the first suggestion if available
    const selectedCustomerId = inboundSelections[inbound.changeId] || (inbound.suggestedCustomerIds && inbound.suggestedCustomerIds.length > 0 ? inbound.suggestedCustomerIds[0] : null);
    
    if (!selectedCustomerId) {
      alert("Lütfen bağlamak için listeden bir cari seçin.");
      return;
    }

    setProcessingInboundId(inbound.changeId);
    try {
      await processAsMerge(inbound, selectedCustomerId);
      alert("Gelen ölçü mevcut cariye bağlandı.");
      await loadInbound();
      // Notify zustand components to refresh
      window.dispatchEvent(new Event('local-customers-updated'));
    } catch (e: any) {
      alert("İşlem tamamlanamadı. Veriler korunuyor. Hata: " + e.message);
    } finally {
      setProcessingInboundId(null);
    }
  };

  const searchedCustomers = useMemo(() => {
    if (customerSearchQuery.length < 2) return [];
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(c => !c.isDeleted && (
      (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.mapLocation && c.mapLocation.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    )).slice(0, 20);
  }, [customerSearchQuery, customers]);

  useEffect(() => {
    setMounted(true);
    loadDrafts();
    loadInbound();
  }, []);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  // ─── Derived data ────────────────────────────────────────────────────────────

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers((prev) => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  const customerStats = customers
    .filter((c) => !c.isDeleted && (!currentUser || canViewCustomer(currentUser, c)))
    .map((customer) => {
      const activeRooms = (customer.rooms || []).filter((r) => !r.isDeleted);
      let openingCount = 0;
      let measurementCount = 0;
      let photoCount = 0;
      let videoCount = 0;
      let latestDate: Date | null = null;
      let latestMeasuredBy = "";

      for (const room of activeRooms) {
        photoCount += (room.photos || []).length;
        videoCount += (room.videos || []).length;
        const activeWindows = (room.windows || []).filter((w) => !w.isDeleted);
        openingCount += activeWindows.length;
        for (const window of activeWindows) {
          photoCount += (window.photos || []).length;
          videoCount += (window.videos || []).length;
          const activeProducts = (window.products || []).filter((p) => !p.isDeleted);
          measurementCount += activeProducts.length;
          for (const p of activeProducts) {
            photoCount += (p.photos || []).length;
            videoCount += (p.videos || []).length;
            if (p.measuredDate) {
              const d = new Date(p.measuredDate);
              if (!latestDate || d.getTime() > latestDate.getTime()) {
                latestDate = d;
                latestMeasuredBy = p.measuredBy || "";
              }
            }
          }
        }
      }

      return {
        customer,
        roomCount: activeRooms.length,
        openingCount,
        measurementCount,
        photoCount,
        videoCount,
        latestDateStr: latestDate ? latestDate.toLocaleDateString("tr-TR") : "-",
        latestMeasuredBy: latestMeasuredBy || "-",
      };
    })
    .filter(
      (item) =>
        item.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customer.phone && item.customer.phone.includes(searchTerm))
    );

  const handleSelectCustomerFromModal = (customerId: string) => {
    if (!customerSearchInboundId) return;
    setInboundSelections(prev => ({ ...prev, [customerSearchInboundId]: customerId }));
    setCustomerSearchInboundId(null);
    setCustomerSearchQuery("");
  };

  const filteredDrafts = localDrafts
    .filter((d) =>
      d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.customerPhone && d.customerPhone.includes(searchTerm))
    )
    .filter((d) => draftFilter === "ALL" || d.syncStatus === draftFilter);

  const detailDraft = detailDraftId ? localDrafts.find((d) => d.id === detailDraftId) ?? null : null;
  const editDraft = editDraftId ? localDrafts.find((d) => d.id === editDraftId) ?? null : null;

  // ─── Draft actions ───────────────────────────────────────────────────────────

  const openEdit = (draft: FieldMeasurementDraft) => {
    setEditDraftId(draft.id);
    setEditForm({
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerAddress: draft.customerAddress || "",
      notes: draft.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editDraftId) return;
    setEditSaving(true);
    try {
      await updateMeasurementDraft(editDraftId, {
        customerName: editForm.customerName.trim(),
        customerPhone: editForm.customerPhone.trim(),
        customerAddress: editForm.customerAddress.trim(),
        notes: editForm.notes.trim(),
      });
      await loadDrafts();
      setEditDraftId(null);
    } catch (err) {
      console.error("[DraftEdit] Kayıt başarısız:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleMarkReady = async (draft: FieldMeasurementDraft) => {
    try {
      await markDraftReadyToTransfer(draft.id, "MEASUREMENT");
      await loadDrafts();
    } catch (err) {
      console.error("[DraftReady] Durum değiştirilemedi:", err);
    }
  };

  const handleDelete = async (draft: FieldMeasurementDraft) => {
    const confirmed = window.confirm(
      `"${draft.customerName}" müşterisine ait yerel saha taslağı silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
    );
    if (!confirmed) return;
    try {
      await deleteMeasurementDraft(draft.id);
      if (detailDraftId === draft.id) setDetailDraftId(null);
      if (editDraftId === draft.id) setEditDraftId(null);
      await loadDrafts();
    } catch (err) {
      console.error("[DraftDelete] Silme başarısız:", err);
    }
  };

  // ─── Draft count chips per filter ────────────────────────────────────────────

  const countByStatus = (status: FilterKey) =>
    status === "ALL"
      ? localDrafts.length
      : localDrafts.filter((d) => d.syncStatus === status).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold heading-title flex items-center gap-2">
          <Ruler className="w-6 h-6 text-blue-500" />
          Ölçüler ve Projeler
        </h1>
        <p className="text-sm heading-subtitle">
          Müşteri bazında alınan saha ölçüleri ve durum takibi.
        </p>
      </div>

      {/* V1D Inbound Pool Section */}
      {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CloudDownload className="w-5 h-5 text-indigo-500" />
              Gelen Ölçüler Havuzu
              <span className="text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
                {inboundMeasurements.length} bekleyen
              </span>
            </h2>
            <button
              onClick={handlePullInbound}
              disabled={isPulling}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isPulling ? 'animate-spin' : ''}`} />
              {isPulling ? 'Alınıyor...' : 'Gelen Ölçüleri Al'}
            </button>
          </div>

          {inboundMeasurements.length === 0 ? (
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
              <p className="text-gray-500 dark:text-gray-400">Bekleyen gelen ölçü bulunmamaktadır.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inboundMeasurements.map(inbound => (
                <div key={inbound.changeId} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                     <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{inbound.customerName || 'İsimsiz Müşteri'}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1"><User className="w-3 h-3"/> {inbound.customerPhone || 'Telefon Yok'}</p>
                        {inbound.customerAddress && <p className="text-xs text-gray-400 truncate max-w-[200px] mt-1">{inbound.customerAddress}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(inbound.createdAt).toLocaleString('tr-TR')}</p>
                     </div>
                     <div className="flex flex-col gap-1 items-end">
                       <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{inbound.entityType}</span>
                       <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">YENİ</span>
                     </div>
                  </div>
                  
                  {inbound.suggestedCustomerIds && inbound.suggestedCustomerIds.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md p-2">
                       <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Önerilen Eşleşmeler:</p>
                       <div className="space-y-1">
                          {inbound.suggestedCustomerIds.map(id => {
                            const c = customers.find(x => x.id === id);
                            if (!c) return null;
                            const isSelected = (inboundSelections[inbound.changeId] || inbound.suggestedCustomerIds![0]) === id;
                            return (
                              <label key={id} className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 cursor-pointer p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40">
                                <input 
                                  type="radio" 
                                  name={`match-${inbound.changeId}`} 
                                  value={id}
                                  checked={isSelected}
                                  onChange={() => setInboundSelections(prev => ({ ...prev, [inbound.changeId]: id }))}
                                  className="w-3 h-3 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold">{c.name} {c.customerCode ? `(${c.customerCode})` : ''}</span>
                                  <span className="text-[10px] truncate max-w-[200px]">{c.phone || 'Telefon yok'} - {c.address || 'Adres yok'}</span>
                                </div>
                              </label>
                            );
                          })}
                       </div>
                    </div>
                  )}

                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md p-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Manuel Cari Seçimi:</p>
                    {inboundSelections[inbound.changeId] && (!inbound.suggestedCustomerIds || !inbound.suggestedCustomerIds.includes(inboundSelections[inbound.changeId])) ? (
                        (() => {
                          const c = customers.find(x => x.id === inboundSelections[inbound.changeId]);
                          return c ? (
                            <div className="text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 p-1.5 rounded border border-gray-200 dark:border-gray-600">
                              <span className="font-bold">Seçili Cari:</span> {c.name} - {c.phone || 'Telefon yok'}
                              <div className="truncate text-gray-500 dark:text-gray-400 mt-0.5">{c.address || 'Adres yok'}</div>
                              <button onClick={() => setCustomerSearchInboundId(inbound.changeId)} className="mt-1 text-indigo-600 hover:underline text-[10px] font-semibold w-full text-center py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded">Cari Rehberinden Değiştir</button>
                            </div>
                          ) : <span className="text-xs text-gray-500">Bilinmeyen Cari</span>;
                        })()
                    ) : (
                        <button 
                          onClick={() => setCustomerSearchInboundId(inbound.changeId)}
                          className="w-full text-xs py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded font-medium hover:bg-gray-50 dark:hover:bg-gray-600 flex justify-center items-center gap-1"
                        >
                          <Search className="w-3 h-3" />
                          Cari Seç / Rehberi Aç
                        </button>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
                     <button 
                       onClick={() => handleInboundMerge(inbound)}
                       disabled={processingInboundId === inbound.changeId || (!inboundSelections[inbound.changeId] && (!inbound.suggestedCustomerIds || inbound.suggestedCustomerIds.length === 0))}
                       className="flex-1 px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-semibold hover:bg-green-100 disabled:opacity-50" 
                     >
                       {processingInboundId === inbound.changeId ? 'İşleniyor...' : 'Mevcut Cariye Bağla'}
                     </button>
                     <button 
                       onClick={() => handleInboundCreateNew(inbound)}
                       disabled={processingInboundId === inbound.changeId}
                       className="flex-1 px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold hover:bg-blue-100 disabled:opacity-50" 
                     >
                       Yeni Cari Aç
                     </button>
                     <button 
                       onClick={async () => {
                         const confirmed = window.confirm('Bu kaydı atlamak istediğinize emin misiniz? (Havuza bir daha düşmez)');
                         if(confirmed) {
                           await updateInboundStatus(inbound.changeId, 'SKIPPED');
                           await loadInbound();
                         }
                       }}
                       disabled={processingInboundId === inbound.changeId}
                       className="px-2 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded text-xs font-semibold hover:bg-gray-100 disabled:opacity-50"
                     >Atla</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="olculer-search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Müşteri veya telefon ara..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm"
        />
      </div>

      {/* ──────────────────── LOCAL DRAFTS SECTION ──────────────────── */}
      <section className="space-y-4">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            Yerel Saha Taslakları
            <span className="text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
              {localDrafts.length} taslak
            </span>
          </h2>

          {/* Status filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {FILTER_OPTIONS.map((opt) => {
              const count = countByStatus(opt.key);
              const active = draftFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  id={`draft-filter-${opt.key.toLowerCase()}`}
                  onClick={() => setDraftFilter(opt.key)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-colors ${
                    active
                      ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                  }`}
                >
                  {opt.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {localDrafts.length === 0 && (
          <div className="bg-white dark:bg-gray-900 border border-dashed border-amber-300 dark:border-amber-800/40 rounded-xl p-10 text-center text-gray-500 dark:text-gray-400">
            <ClipboardList className="w-10 h-10 text-amber-300 dark:text-amber-700 mx-auto mb-3" />
            <p className="font-medium">Bu cihazda kayıtlı yerel saha taslağı yok.</p>
            <p className="text-xs mt-1">Cari detayında "Telefona Taslak Kaydet" ile taslak oluşturabilirsiniz.</p>
          </div>
        )}

        {localDrafts.length > 0 && filteredDrafts.length === 0 && (
          <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="font-medium">Filtreye uyan taslak bulunamadı.</p>
          </div>
        )}

        {/* Draft cards grid */}
        {filteredDrafts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDrafts.map((draft) => {
              const openingCount = (draft.rooms || []).reduce(
                (acc, r) => acc + ((r.windows || []).filter((w: any) => !w.isDeleted).length),
                0
              );
              const measurementCount = (draft.rooms || []).reduce(
                (acc, r) =>
                  acc +
                  (r.windows || []).reduce(
                    (wacc: number, w: any) =>
                      wacc + ((w.products || []).filter((p: any) => !p.isDeleted).length),
                    0
                  ),
                0
              );
              const isDetail = detailDraftId === draft.id;

              return (
                <div
                  key={draft.id}
                  className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900/30 rounded-xl shadow-sm overflow-hidden flex flex-col"
                >
                  {/* Card header row */}
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                        {draft.customerName}
                      </p>
                      {draft.customerPhone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {draft.customerPhone}
                        </p>
                      )}
                      {draft.customerAddress && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {draft.customerAddress}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        STATUS_COLORS[draft.syncStatus]
                      }`}
                    >
                      {STATUS_LABELS[draft.syncStatus]}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="px-4 pb-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {(draft.rooms || []).length}
                      </span>{" "}
                      Oda
                    </span>
                    <span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {openingCount}
                      </span>{" "}
                      Açıklık
                    </span>
                    <span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {measurementCount}
                      </span>{" "}
                      Ölçü
                    </span>
                    <span className="ml-auto">
                      {new Date(draft.updatedAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800 pt-3 mt-auto">
                    {/* Detail toggle */}
                    <button
                      id={`draft-detail-${draft.id}`}
                      onClick={() => setDetailDraftId(isDetail ? null : draft.id)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                    >
                      {isDetail ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Kapat
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Detay
                        </>
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      id={`draft-edit-${draft.id}`}
                      onClick={() => openEdit(draft)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors border border-blue-200 dark:border-blue-800/40"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Düzenle
                    </button>

                    {/* Mark ready */}
                    {draft.syncStatus !== "READY_TO_TRANSFER" &&
                      draft.syncStatus !== "TRANSFERRED" &&
                      draft.syncStatus !== "TRANSFERRING" && (
                        <button
                          id={`draft-ready-${draft.id}`}
                          onClick={() => handleMarkReady(draft)}
                          className="text-xs bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors border border-green-200 dark:border-green-800/40"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" /> Aktarıma Hazır
                        </button>
                      )}

                    {draft.syncStatus === "READY_TO_TRANSFER" && (
                      <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 border border-blue-200 dark:border-blue-800/40">
                        <BadgeCheck className="w-3.5 h-3.5" /> Hazır
                      </span>
                    )}

                    {/* Delete */}
                    <button
                      id={`draft-delete-${draft.id}`}
                      onClick={() => handleDelete(draft)}
                      className="text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors border border-red-200 dark:border-red-800/40 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Sil
                    </button>
                  </div>

                  {/* Inline detail panel */}
                  {isDetail && (
                    <div className="border-t border-amber-100 dark:border-amber-900/20 bg-amber-50/40 dark:bg-amber-950/10 px-4 pb-4 pt-3 space-y-3 text-xs">
                      {draft.notes && (
                        <p className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">Not: </span>
                          {draft.notes}
                        </p>
                      )}
                      <p className="text-gray-500 dark:text-gray-400">
                        Oluşturulma: {new Date(draft.createdAt).toLocaleString("tr-TR")}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        Son Güncelleme: {new Date(draft.updatedAt).toLocaleString("tr-TR")}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        Tip: {draft.draftType}
                      </p>

                      {/* Rooms summary */}
                      {(draft.rooms || []).length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-amber-200/60 dark:border-amber-800/20">
                          <p className="font-semibold text-slate-700 dark:slate-300">Odalar</p>
                          {(draft.rooms || []).map((room: any, idx: number) => {
                            const wCount = (room.windows || []).filter((w: any) => !w.isDeleted).length;
                            const mCount = (room.windows || []).reduce(
                              (a: number, w: any) =>
                                a + ((w.products || []).filter((p: any) => !p.isDeleted).length),
                              0
                            );
                            return (
                              <div key={room.id || idx} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {room.name || `Oda ${idx + 1}`}
                                </span>
                                <span className="text-gray-400">—</span>
                                <span>{wCount} açıklık, {mCount} ölçü</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ──────────────────── EDIT MODAL ──────────────────── */}
      {editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md space-y-5 p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-500" />
                Taslak Düzenle
              </h3>
              <button
                id="draft-edit-close"
                onClick={() => setEditDraftId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Müşteri Adı
                </label>
                <input
                  id="draft-edit-name"
                  type="text"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Telefon
                </label>
                <input
                  id="draft-edit-phone"
                  type="text"
                  value={editForm.customerPhone}
                  onChange={(e) => setEditForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Adres
                </label>
                <input
                  id="draft-edit-address"
                  type="text"
                  value={editForm.customerAddress}
                  onChange={(e) => setEditForm((f) => ({ ...f, customerAddress: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Not
                </label>
                <textarea
                  id="draft-edit-notes"
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                id="draft-edit-cancel"
                onClick={() => setEditDraftId(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                İptal
              </button>
              <button
                id="draft-edit-save"
                onClick={saveEdit}
                disabled={editSaving || !editForm.customerName.trim()}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cari Rehberi Modal */}
      {customerSearchInboundId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-500" />
                Cari Rehberi
              </h3>
              <button
                onClick={() => {
                  setCustomerSearchInboundId(null);
                  setCustomerSearchQuery("");
                }}
                className="text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <input 
                type="text" 
                value={customerSearchQuery}
                onChange={e => setCustomerSearchQuery(e.target.value)}
                placeholder="Cari kodu, adı, telefon, adres ara... (En az 2 karakter)"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>

            <div className="p-0 overflow-y-auto flex-1 bg-gray-50 dark:bg-slate-900">
              {customerSearchQuery.length < 2 ? (
                <div className="p-8 text-center text-gray-500">Aramak için en az 2 karakter yazın.</div>
              ) : searchedCustomers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Sonuç bulunamadı.</div>
              ) : (
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-gray-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Cari Kodu</th>
                      <th className="px-4 py-3">Cari Adı</th>
                      <th className="px-4 py-3">Telefon</th>
                      <th className="px-4 py-3">Adres</th>
                      <th className="px-4 py-3">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedCustomers.map(c => (
                      <tr 
                        key={c.id} 
                        onClick={() => handleSelectCustomerFromModal(c.id)}
                        className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.customerCode || '-'}</td>
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3">{c.phone}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{c.address || '-'}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-400">{c.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {searchedCustomers.length === 20 && (
              <div className="p-2 text-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-t border-amber-200 dark:border-amber-800/50">
                İlk 20 sonuç gösteriliyor. Daha spesifik arama yapın.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────── MAIN CUSTOMERS LIST ──────────────────── */}
      <div className="space-y-4">
        {customerStats.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400">
            <Ruler className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4 mx-auto" />
            <p>Aradığınız kriterlere uygun ölçü kaydı bulunamadı.</p>
          </div>
        ) : null}

        {customerStats.map(
          ({
            customer,
            roomCount,
            openingCount,
            measurementCount,
            photoCount,
            videoCount,
            latestDateStr,
            latestMeasuredBy,
          }) => {
            const isExpanded = !!expandedCustomers[customer.id];

            return (
              <div
                key={customer.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors overflow-hidden"
              >
                {/* Card header */}
                <div
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                  onClick={() => toggleCustomer(customer.id)}
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white hover:underline">
                      <Link href={`/cariler/${customer.id}`} onClick={(e) => e.stopPropagation()}>
                        {customer.name}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Son Ölçüm: {latestDateStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> Ölçen: {latestMeasuredBy}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {roomCount} Oda
                    </span>
                    <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {openingCount} Açıklık
                    </span>
                    <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {measurementCount} Ölçü Profili
                    </span>
                    {photoCount > 0 && (
                      <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <Image className="w-3.5 h-3.5" /> {photoCount} Foto
                      </span>
                    )}
                    {videoCount > 0 && (
                      <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                        <VideoIcon className="w-3.5 h-3.5" /> {videoCount} Video
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                    <button className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">
                      {isExpanded ? "Ölçüleri Gizle" : "Ölçüleri Gör"}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/cariler/${customer.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      Detaya Git <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Expanded hierarchy */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 p-5 space-y-6">
                    {customer.rooms.filter((r) => !r.isDeleted).length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Oda bulunamadı.</p>
                    ) : null}

                    {customer.rooms
                      .filter((r) => !r.isDeleted)
                      .map((room) => (
                        <div key={room.id} className="space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
                          <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {room.name}
                            {(room.photos?.length > 0 || room.videos?.length > 0) && (
                              <span className="text-[10px] text-gray-400 font-normal">
                                ({(room.photos || []).length} Foto, {(room.videos || []).length} Video)
                              </span>
                            )}
                          </h4>

                          <div className="space-y-4 pl-4">
                            {room.windows.filter((w) => !w.isDeleted).length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Açıklık bulunmuyor.</p>
                            ) : null}

                            {room.windows
                              .filter((w) => !w.isDeleted)
                              .map((window) => (
                                <div key={window.id} className="space-y-2">
                                  <h5 className="font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                                    {window.name}
                                  </h5>

                                  <div className="space-y-2 pl-5">
                                    {window.products.filter((p) => !p.isDeleted).length === 0 ? (
                                      <p className="text-[11px] text-gray-400 italic">Alınmış ölçü kaydı yok.</p>
                                    ) : null}

                                    {window.products
                                      .filter((p) => !p.isDeleted)
                                      .map((p) => {
                                        const dims = getMeasurementDimensions(p);
                                        const isAssigned = !!(p.productId || p.productType);

                                        return (
                                          <div
                                            key={p.id}
                                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm"
                                          >
                                            <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                                  {getTemplateLabel(dims.templateType)}
                                                </span>
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                  {dims.summaryLabel}
                                                </span>
                                              </div>
                                              <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <span>Ölçen: {p.measuredBy}</span>
                                                {p.measuredDate && (
                                                  <span>• {new Date(p.measuredDate).toLocaleDateString("tr-TR")}</span>
                                                )}
                                                {p.notes && (
                                                  <span className="text-yellow-600 dark:text-yellow-500 font-medium">
                                                    • Saha Notu: {p.notes}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {isAssigned ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                  <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                    Ürün Atandı
                                                  </span>
                                                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                                    {p.productGroup} / {p.productType}
                                                  </span>
                                                </div>
                                              ) : (
                                                <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                                  <AlertCircle className="w-3 h-3 text-orange-500" />
                                                  Ürün Atanmadı
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
