"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, X, LayoutPanelTop as WindowIcon, ChevronDown, ChevronRight, Layers, Camera, Video, FileText, CheckCircle, Shield, AlertTriangle, MapPin, MessageCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useStore, WindowItem, MEASUREMENT_TEMPLATES, ProductMeasurement } from "@/store/useStore";
import { useAuthStore, ROLE_PERMISSIONS, normalizeRole, canViewCustomer, canViewCustomerWorkflowReport, canViewCustomerFinancialReport, canViewCustomerContactFields, canViewFinancialAreas, canEditCustomerLocation, canViewCariCard } from "@/store/useAuthStore";
import { getMeasurementDimensions, getTemplateLabel, getGoogleMapsUrl, getWorkflowStatusLabel, getWorkflowStatusColorClass, WORKFLOW_STATUS_LABELS } from "@/lib/measurementAdapter";
import { fileToDataUrl } from "@/lib/fileStorage";
import { MediaPreviewModal } from "@/components/MediaPreviewModal";
import { syncNow } from "@/lib/syncService";
import { buildWhatsAppShortReport, calculateMechanicalCurtainM2 } from "@/lib/reportFormatters";
import { MeasurementVisualReport } from "@/components/reports/MeasurementVisualReport";

export default function CariDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;
  
  const store = useStore();
  const { customers, updateCustomer, addRoom, deleteRoom, addWindow, deleteWindow, updateRoomAttachments, updateWindowItem, addProductMeasurement, updateProductMeasurement, deleteProductMeasurement } = store;
  const { currentUser, addAuditEntry, users } = useAuthStore();
  const user = currentUser!;
  const customer = customers.find(c => c.id === id);

  const normRole = user ? normalizeRole(user.role) : 'FIELD';
  const canViewAddressPhoto = !!user && !!customer && (
    normRole === 'ADMIN' ||
    normRole === 'OFFICE' ||
    user.role === 'ACCOUNTING' ||
    (normRole === 'FIELD' && canViewCariCard(user, customer)) ||
    (normRole === 'INSTALLER' && canViewCariCard(user, customer))
  );

  const canAddAddressPhoto = canViewAddressPhoto;

  const canDeleteAddressPhoto = !!user && (
    user.role === 'ADMIN' ||
    user.role === 'OFFICE' ||
    user.role === 'ACCOUNTING'
  );

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
  
  const [mounted, setMounted] = useState(false);
  const permissions = ROLE_PERMISSIONS[currentUser?.role || "FIELD"] || { label: "Kullanıcı", canAccessOfficeMode: false, canOverrideMeasuredBy: false };
  const [mode, setMode] = useState<"MEASUREMENT" | "OFFICE">("MEASUREMENT");
  const [activeTab, setActiveTab] = useState<"rooms" | "timeline" | "financial">("rooms");

  const CUSTOMER_WORKFLOW_LABELS: Record<string, string> = {
    YENI: "Yeni",
    OLCU_BEKLIYOR: "Ölçü Bekleniyor",
    OLCU_ALINDI: "Ölçü Alındı",
    SATISTA: "Satışta",
    DIKIMDE: "Dikimde/Üretimde",
    MONTAJ_BEKLIYOR: "Montaj Bekleniyor",
    MONTAJDA: "Montajda",
    TAMAMLANDI: "Tamamlandı",
    IPTAL: "İptal"
  };

  const measurementEmployees = users.filter(u => normalizeRole(u.role) === 'FIELD' || normalizeRole(u.role) === 'ADMIN');


  const [activeRoomIdForWindow, setActiveRoomIdForWindow] = useState<string | null>(null);
  const [activeWindowIdForProduct, setActiveWindowIdForProduct] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");

  // Media Upload Choice Modal State
  const [mediaUploadType, setMediaUploadType] = useState<'photo' | 'video' | null>(null);
  const [mediaUploadCallback, setMediaUploadCallback] = useState<((url: string) => void) | null>(null);

  // Media Preview Modal State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'photo' | 'video' | null>(null);

  const [windowName, setWindowName] = useState("");

  // Measurement Template Form State
  const [selectedTemplate, setSelectedTemplate] = useState("CURTAIN_DETAIL");
  const [rawValues, setRawValues] = useState<Record<string, any>>({});
  // For ADMIN/SALES entering on behalf of someone else
  const [overrideMeasuredById, setOverrideMeasuredById] = useState(currentUser?.id || "");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);

  // Office Config Form State
  const [activeMeasurementIdForConfig, setActiveMeasurementIdForConfig] = useState<string | null>(null);
  const [officeProductGroup, setOfficeProductGroup] = useState("Tül / Güneşlik");
  const [officeProductType, setOfficeProductType] = useState("Tül");
  const [newNote, setNewNote] = useState("");

  // Admin correction state
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionNewUserId, setCorrectionNewUserId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVisualReportOpen, setIsVisualReportOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'room' | 'window' | 'measurement' | 'photo';
    data: any;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, data } = deleteConfirm;
    
    if (type === 'room') {
      deleteRoom(data.customerId, data.roomId);
    } else if (type === 'window') {
      deleteWindow(data.customerId, data.roomId, data.windowId);
    } else if (type === 'measurement') {
      deleteProductMeasurement(data.customerId, data.roomId, data.windowId, data.measurementId);
    } else if (type === 'photo') {
      if (data.type === 'measurement') {
        const roomObj = customer?.rooms.find(r => r.id === data.roomId);
        const winObj = roomObj?.windows.find(w => w.id === data.windowId);
        const measObj = winObj?.products.find(p => p.id === data.measurementId);
        if (measObj) {
          const updatedPhotos = (measObj.photos || []).filter(u => u !== data.url);
          const updatedVideos = (measObj.videos || []).filter(u => u !== data.url);
          updateProductMeasurement(data.customerId, data.roomId, data.windowId, data.measurementId, {
            photos: updatedPhotos,
            videos: updatedVideos
          });
        }
      } else {
        const addressPhotos = customer?.addressPhotos || [];
        const updated = addressPhotos.filter((_, idx) => idx !== data.index);
        updateCustomer(data.customerId, { addressPhotos: updated });
      }
    }
    
    setDeleteConfirm(null);
    try {
      await syncNow();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (activeTab === "timeline" && customer && currentUser && !canViewCustomerWorkflowReport(currentUser, customer)) {
      setActiveTab("rooms");
    }
    if (activeTab === "financial" && currentUser && !canViewCustomerFinancialReport(currentUser)) {
      setActiveTab("rooms");
    }
  }, [activeTab, customer, currentUser]);

  if (!mounted) return <div className="p-8 text-center">Yükleniyor...</div>;

  if (customer && currentUser && !canViewCustomer(currentUser, customer)) {
    return (
      <div className="p-8 text-center space-y-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12">
        <p className="text-red-500 font-bold text-lg">Erişim Engellendi</p>
        <p className="text-slate-350 text-sm">Bu müşterinin bilgilerini görüntüleme yetkiniz yok.</p>
        <Link href="/cariler" className="inline-block bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">Listeye Dön</Link>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-500 font-medium">Müşteri bulunamadı.</p>
        <Link href="/cariler" className="text-blue-600 hover:underline">Listeye Dön</Link>
      </div>
    );
  }

  if (customer.isDeleted) {
    return (
      <div className="p-8 text-center space-y-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12 animate-fade-in">
        <p className="text-red-500 font-bold text-lg">Cari Silinmiş</p>
        <p className="text-slate-350 text-sm">Bu cari kartı silinmiştir ve işlem yapılamaz.</p>
        <Link href="/cariler" className="inline-block bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">Listeye Dön</Link>
      </div>
    );
  }

  const getJobDurationDays = () => {
    if (!customer.createdAt) return 0;
    const start = new Date(customer.createdAt).getTime();
    const isFinished = customer.workflowStatus === "TAMAMLANDI" || customer.workflowStatus === "IPTAL";
    const end = isFinished && customer.updatedAt ? new Date(customer.updatedAt).getTime() : Date.now();
    const diffTime = Math.max(0, end - start);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getTimelineEvents = () => {
    const events: { date: string; action: string; description: string; personnel: string }[] = [];

    // 1. Customer Created
    if (customer.createdAt) {
      events.push({
        date: customer.createdAt,
        action: "Cari Açıldı",
        description: "Müşteri kaydı oluşturuldu ve ERP sistemine kaydedildi.",
        personnel: customer.createdByName || "Bilinmiyor"
      });
    }

    // 2. Measurements
    customer.rooms.forEach(room => {
      room.windows?.forEach(win => {
        win.products?.forEach(p => {
          const date = p.measuredDate || p.createdAt || customer.createdAt || "";
          if (date) {
            events.push({
              date,
              action: `Ölçü Eklendi (${room.name} - ${win.name})`,
              description: `Şablon: ${getTemplateLabel(p.templateType)}. Notlar: ${p.notes || 'Yok'}`,
              personnel: p.measuredBy || "Bilinmiyor"
            });
          }
        });
      });
    });

    // 3. Last update (if different from createdAt)
    if (customer.updatedAt && customer.createdAt && customer.updatedAt !== customer.createdAt) {
      events.push({
        date: customer.updatedAt,
        action: "Son Güncelleme",
        description: `Cari kartı veya ERP verileri güncellendi. (Mevcut Durum: ${CUSTOMER_WORKFLOW_LABELS[customer.workflowStatus || 'YENI'] || customer.workflowStatus})`,
        personnel: "-"
      });
    }

    // Sort events by date descending (newest first)
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const buildWhatsAppReport = () => {
    const lines: string[] = [
      `*ÖLÇÜ ERP V1 - SAHA ÖLÇÜ RAPORU*`,
      `Müşteri: ${customer.name}`,
      `Telefon: ${customer.phone || '-'}`,
      `Adres: ${customer.address || customer.mapLocation || '-'}`,
      `Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}`,
      ''
    ];

    if (customer.rooms.length === 0) {
      lines.push('Henüz oda ve ölçü kaydı bulunmuyor.');
    }

    customer.rooms.forEach((room, roomIndex) => {
      lines.push(`*${roomIndex + 1}. ODA: ${room.name}*`);

      if (room.windows.length === 0) {
        lines.push('- Açıklık kaydı yok');
      }

      room.windows.forEach((opening, openingIndex) => {
        lines.push(`${openingIndex + 1}.${roomIndex + 1} Açıklık: ${opening.name}`);

        if (opening.products.length === 0) {
          lines.push('  - Ölçü alınmamış');
        }

        opening.products.forEach((measurement, measurementIndex) => {
          const template = MEASUREMENT_TEMPLATES[measurement.templateType];
          const dims = getMeasurementDimensions(measurement);
          lines.push(`  Ölçü ${measurementIndex + 1}: ${getTemplateLabel(measurement.templateType)}`);

          (template?.fields || []).forEach((field) => {
            const value = measurement.rawValues?.[field.key];
            lines.push(`  - ${field.label}: ${value ?? '-'}${field.type === 'number' ? '' : ''}`);
          });

          if (dims.structuralWidth || dims.structuralHeight) {
            lines.push(`  - Toplam Ölçü: ${dims.structuralWidth || '-'} × ${dims.structuralHeight || '-'} cm`);
          }

          lines.push(`  - Ölçüyü Alan: ${measurement.measuredBy || '-'}`);
          lines.push(`  - Tarih: ${measurement.measuredDate ? new Date(measurement.measuredDate).toLocaleString('tr-TR') : '-'}`);
          if (measurement.notes) lines.push(`  - Not: ${measurement.notes}`);
          if (measurement.photos?.length) lines.push(`  - Fotoğraf: ${measurement.photos.length} adet`);
          if (measurement.videos?.length) lines.push(`  - Video: ${measurement.videos.length} adet`);
        });
      });

      lines.push('');
    });

    const mapsUrl = getGoogleMapsUrl(customer);
    if (mapsUrl) lines.push(`Konum: ${mapsUrl}`);
    lines.push('Ölçü ERP V1.0 - Saha Pilot');

    return lines.join('\n');
  };

  const handleShareWhatsAppReport = async () => {
    const report = buildWhatsAppShortReport(customer, users);

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${customer.name} Ölçü Raporu`,
          text: report,
        });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank', 'noopener,noreferrer');
  };

  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const handleSaveRoom = async () => {
    if (isSaving) return;
    if (newRoomName.trim()) {
      setIsSaving(true);
      try {
        addRoom(customer.id, newRoomName.trim());
        await syncNow();
        setIsAddingRoom(false);
        setNewRoomName("");
      } catch (err) {
        console.error(err);
        showToast("Oda kaydedilirken senkronizasyon hatası oluştu.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAddWindow = async (roomId: string) => {
    if (isSaving) return;
    if (!windowName) {
      showToast("Pencere adı zorunludur.");
      return;
    }
    setIsSaving(true);
    try {
      addWindow(customer.id, roomId, windowName);
      await syncNow();
      setActiveRoomIdForWindow(null);
      setWindowName("");
    } catch (err) {
      console.error(err);
      showToast("Pencere kaydedilirken senkronizasyon hatası oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const triggerFileSelector = (useCamera: boolean) => {
    if (!mediaUploadType || !mediaUploadCallback) return;
    
    const type = mediaUploadType;
    const callback = mediaUploadCallback;
    
    // Close the modal
    setMediaUploadType(null);
    setMediaUploadCallback(null);
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'photo' ? 'image/*' : 'video/*';
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }
    
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const dataUrl = await fileToDataUrl(file, type);
        callback(dataUrl);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Dosya kaydedilemedi.');
      }
    };
    
    input.click();
  };

  const handleFileUpload = (type: 'photo' | 'video', callback: (url: string) => void) => {
    setMediaUploadType(type);
    setMediaUploadCallback(() => callback);
  };

  const openMeasurementForm = (w: WindowItem) => {
    setActiveWindowIdForProduct(w.id);
    setEditingMeasurementId(null);
    setSelectedTemplate("CURTAIN_DETAIL");
    setRawValues({});
    setMeasurementNotes("");
    setOverrideMeasuredById(user.id);
  };

  const handleSaveMeasurement = async (roomId: string, windowId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const isOfficeEntry = permissions.canAccessOfficeMode && overrideMeasuredById !== user.id;
      const measuredByUser = users.find(u => u.id === overrideMeasuredById) || user;
      const now = new Date().toISOString();

      const parsedRawValues: Record<string, any> = {};
      const templateFields = MEASUREMENT_TEMPLATES[selectedTemplate]?.fields || [];
      templateFields.forEach(f => {
        const val = rawValues[f.key];
        if (f.type === 'number') {
          const defVal = f.defaultValue !== undefined ? f.defaultValue : 0;
          parsedRawValues[f.key] = val !== undefined && val !== '' ? Number(val) : defVal;
        } else if (f.type === 'select') {
          const firstOpt = f.options && f.options.length > 0 ? f.options[0] : '';
          parsedRawValues[f.key] = val !== undefined && val !== '' ? String(val) : firstOpt;
        } else {
          parsedRawValues[f.key] = val !== undefined && val !== null ? String(val) : '';
        }
      });

      if (editingMeasurementId) {
        updateProductMeasurement(customer.id, roomId, windowId, editingMeasurementId, {
          templateType: selectedTemplate,
          rawValues: parsedRawValues,
          notes: measurementNotes,
          measuredBy: measuredByUser.name,
          measuredById: measuredByUser.id,
          updatedAt: now,
        });
      } else {
        addProductMeasurement(customer.id, roomId, windowId, {
          templateType: selectedTemplate,
          rawValues: parsedRawValues,
          notes: measurementNotes,
          status: "MEASURED",
          measuredBy: measuredByUser.name,
          measuredById: measuredByUser.id,
          createdById: user.id,
          measuredDate: now,
          createdAt: now,
          updatedAt: now,
          notesHistory: [],
          photos: [],
          videos: [],
        });
      }
      await syncNow();
      setActiveWindowIdForProduct(null);
      setEditingMeasurementId(null);
    } catch (err) {
      console.error(err);
      showToast("Ölçü kaydedilirken senkronizasyon hatası oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = (roomId: string, windowId: string, m: ProductMeasurement) => {
    if (!newNote.trim()) return;
    const note = { date: new Date().toISOString(), note: newNote, author: user.name };
    updateProductMeasurement(customer.id, roomId, windowId, m.id, {
      notesHistory: [...(m.notesHistory || []), note],
      updatedAt: new Date().toISOString(),
    });
    setNewNote("");
  };

  const handleCorrectionSave = (roomId: string, windowId: string, m: ProductMeasurement) => {
    if (!correctionNewUserId || !correctionReason.trim()) return;
    const newUser = users.find(u => u.id === correctionNewUserId);
    if (!newUser) return;

    addAuditEntry({
      entityType: 'ProductMeasurement',
      entityId: m.id,
      field: 'measuredById',
      previousValue: `${m.measuredBy} (${m.measuredById || 'N/A'})`,
      newValue: `${newUser.name} (${newUser.id})`,
      changedBy: user.name,
      changedAt: new Date().toISOString(),
      reason: correctionReason,
    });

    updateProductMeasurement(customer.id, roomId, windowId, m.id, {
      measuredBy: newUser.name,
      measuredById: newUser.id,
      updatedAt: new Date().toISOString(),
    });

    setCorrectionTarget(null);
    setCorrectionNewUserId("");
    setCorrectionReason("");
  };

  const handleOfficeSave = (roomId: string, windowId: string, m: ProductMeasurement) => {
    const dims = getMeasurementDimensions(m);
    updateProductMeasurement(customer.id, roomId, windowId, m.id, {
      productGroup: officeProductGroup,
      productType: officeProductType,
      calculatedWidth: dims.structuralWidth,
      calculatedHeight: dims.structuralHeight,
    });
    setActiveMeasurementIdForConfig(null);
  };

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      showToast("Tarayıcınız konum bilgisini desteklemiyor.");
      return;
    }
    setUpdatingLocation(true);
    setLocationAccuracy(null);
    setLocationWarning(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newCoords = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        
        setLocationAccuracy(accuracy);
        if (accuracy > 100) {
          setLocationWarning("Konum doğruluğu düşük. GPS açıkken tekrar deneyin veya haritadan kontrol edin.");
        }

        updateCustomer(customer.id, { mapLocation: newCoords });

        try {
          await syncNow();
        } catch (err) {
          console.error("Otomatik senkronizasyon başarısız oldu:", err);
        }
        setUpdatingLocation(false);
      },
      (error) => {
        console.error(error);
        showToast("Konum bilgisi alınamadı. İzinleri kontrol edin.");
        setUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/cariler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold heading-title">{customer.name}</h1>
            <p className="text-sm heading-subtitle">Ölçü & Proje Yönetimi (V2)</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={handleShareWhatsAppReport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-650 hover:bg-green-700 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
            title="Müşteri ölçü raporunu WhatsApp ile paylaş"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Kısa Rapor
          </button>

          <button
            onClick={() => setIsVisualReportOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
            title="Görsel Ölçü Raporunu Görüntüle"
          >
            <FileText className="w-4 h-4" />
            Görsel Ölçü Raporu
          </button>

          {/* MODE TOGGLE */}
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-xl p-1 shadow-inner">
          <button 
            onClick={() => setMode("MEASUREMENT")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'MEASUREMENT' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Sahadan Ölçü Modu
          </button>
          {permissions.canAccessOfficeMode ? (
            <button 
              onClick={() => setMode("OFFICE")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'OFFICE' ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              Ofis / Satış Modu
            </button>
          ) : (
            <button 
              disabled
              className="px-6 py-2 text-sm font-bold rounded-lg text-gray-400 dark:text-gray-600 cursor-not-allowed"
              title="Bu mod için yetkiniz yok"
            >
              Ofis / Satış Modu
            </button>
          )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Müşteri Kartı</h2>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Cari Tipi</span>
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${getCariTypeColor(customer.cariType)}`}>
                  {getCariTypeLabel(customer.cariType)}
                </span>
              </div>

              {customer.approvalStatus === 'PENDING_APPROVAL' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Yönetici Onayı Bekliyor
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Saha ekibi tarafından oluşturuldu. Onaylanmadan diğer modüller ve çalışanlar tarafından görüntülenemez.
                  </p>
                  {currentUser && (normalizeRole(currentUser.role) === 'ADMIN' || normalizeRole(currentUser.role) === 'OFFICE' || currentUser.role === 'ACCOUNTING') && (
                    <button
                      onClick={() => {
                        updateCustomer(customer.id, { approvalStatus: 'APPROVED' });
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Cariyi Onayla
                    </button>
                  )}
                </div>
              )}

              {customer.customerCode && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Cari Kodu</span>
                  <span className="font-medium text-gray-900 dark:text-white">{customer.customerCode}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && customer.taxNumber && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">TC / Vergi No</span>
                  <span className="font-medium text-gray-900 dark:text-white">{customer.taxNumber}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Telefon</span>
                  <span className="font-medium text-gray-900 dark:text-white">{customer.phone || '-'}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && customer.phone2 && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Telefon 2</span>
                  <span className="font-medium text-gray-900 dark:text-white">{customer.phone2}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Adres</span>
                  {(() => {
                    const mapsUrl = getGoogleMapsUrl(customer);
                    if (mapsUrl) {
                      return (
                        <a 
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium group"
                          title="Haritada Göster"
                        >
                          <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span className="group-hover:underline break-words">{customer.address || customer.mapLocation || '-'}</span>
                        </a>
                      );
                    }
                    return (
                      <div 
                        className="flex items-start gap-1.5 text-gray-400 dark:text-gray-600 cursor-not-allowed" 
                        title="Konum eklenmemiş"
                      >
                        <MapPin className="w-4 h-4 text-gray-300 dark:text-gray-700 flex-shrink-0 mt-0.5" />
                        <span className="break-words">{customer.address || '-'}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1">Cari Konum</span>
                  <div className="font-medium text-gray-900 dark:text-white mb-2 break-all">
                    {customer.mapLocation || "Konum Belirlenmemiş"}
                  </div>
                  
                  {locationAccuracy !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Doğruluk: {Math.round(locationAccuracy)} metre
                    </div>
                  )}
                  {locationWarning && (
                    <div className="text-xs text-amber-500 dark:text-amber-400 font-medium mb-2 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{locationWarning}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-2">
                    {(() => {
                      const mapsUrl = getGoogleMapsUrl(customer);
                      return (
                        <a
                          href={mapsUrl || "#"}
                          target={mapsUrl ? "_blank" : undefined}
                          rel={mapsUrl ? "noopener noreferrer" : undefined}
                          onClick={(e) => {
                            if (!mapsUrl) {
                              e.preventDefault();
                              showToast("Konum veya adres bilgisi bulunmuyor.");
                            }
                          }}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors border ${
                            mapsUrl
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-250 dark:border-gray-700 cursor-not-allowed"
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Haritada Aç
                        </a>
                      );
                    })()}

                    <button
                      onClick={handleUpdateLocation}
                      disabled={updatingLocation}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors border bg-emerald-600 hover:bg-emerald-700 text-white border-transparent disabled:bg-emerald-700/50 disabled:cursor-not-allowed"
                    >
                      {updatingLocation ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Konum Alınıyor...
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5" />
                          Konumu Güncelle
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {canViewAddressPhoto && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-1.5">Bina / Adres Fotoğrafları</span>
                  
                  {(() => {
                    const addressPhotos = customer.addressPhotos || [];
                    if (addressPhotos.length > 0) {
                      return (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {addressPhotos.map((url, i) => (
                            <div
                              key={i}
                              className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-250 dark:border-gray-850"
                            >
                              <img
                                src={url}
                                onClick={() => { setPreviewUrl(url); setPreviewType('photo'); }}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition-opacity"
                                alt={`Adres Fotoğrafı ${i + 1}`}
                              />
                              {canDeleteAddressPhoto && (
                                <button
                                  onClick={() => setDeleteConfirm({
                                    type: 'photo',
                                    data: { customerId: customer.id, index: i }
                                  })}
                                  className="absolute top-0.5 right-0.5 bg-red-650 hover:bg-red-700 text-white rounded-full p-0.5 shadow transition-colors cursor-pointer"
                                  title="Fotoğrafı Sil"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div className="text-xs text-gray-450 dark:text-gray-550 italic mb-2">
                        Henüz bina/adres fotoğrafı eklenmemiş.
                      </div>
                    );
                  })()}

                  {canAddAddressPhoto && (
                    <button
                      onClick={() => {
                        handleFileUpload('photo', (url) => {
                          const currentPhotos = customer.addressPhotos || [];
                          updateCustomer(customer.id, {
                            addressPhotos: [...currentPhotos, url]
                          });
                        });
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 w-full cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Bina Fotoğrafı Ekle
                    </button>
                  )}
                </div>
              )}

              {customer.extraDescription && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Ek Açıklama</span>
                  <span className="font-medium text-gray-900 dark:text-white">{customer.extraDescription}</span>
                </div>
              )}
              {customer.generalNote && (
                <div>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Genel Açıklama</span>
                  <span className="font-medium text-gray-900 dark:text-white break-words">{customer.generalNote}</span>
                </div>
              )}
            </div>
          </div>
          
          {isAddingRoom ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Oda Adı</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Örn: Salon, Yatak Odası, Mutfak"
                  className="w-full px-3 py-2 rounded-lg border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveRoom();
                    } else if (e.key === 'Escape') {
                      setIsAddingRoom(false);
                      setNewRoomName("");
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingRoom(false);
                    setNewRoomName("");
                  }}
                  className="flex-1 px-3 py-2 border border-gray-250 dark:border-gray-750 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:bg-blue-600/50 disabled:cursor-not-allowed"
                >
                  Kaydet
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingRoom(true)} 
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-sm transition-colors cursor-pointer ${mode === 'MEASUREMENT' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-800 dark:text-white'}`}
            >
              <Plus className="w-5 h-5" />
              Yeni Oda Ekle
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 mb-4 gap-6">
            <button
              onClick={() => setActiveTab("rooms")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "rooms"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              Odalar & Ölçüler
            </button>
            {canViewCustomerWorkflowReport(currentUser, customer) && (
              <button
                onClick={() => setActiveTab("timeline")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "timeline"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                Cari İş Akış Raporu
              </button>
            )}
            {canViewCustomerFinancialReport(currentUser) && (
              <button
                onClick={() => setActiveTab("financial")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === "financial"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                Cari Rapor / Ekstre
              </button>
            )}
          </div>

          {activeTab === "rooms" && (
            <>
              {customer.rooms.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500">
                  <Layers className="w-12 h-12 text-gray-300 mb-4 mx-auto" />
                  <p>Oda bulunamadı. Lütfen yeni oda ekleyin.</p>
                </div>
              ) : null}

          {customer.rooms.map((room) => {
            const isExpanded = expandedRooms[room.id] !== false;

            return (
              <div key={room.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                
                {/* ROOM HEADER */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleRoom(room.id)}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2 h-6 rounded-full inline-block ${mode === 'MEASUREMENT' ? 'bg-blue-600' : 'bg-orange-500'}`}></span>
                        {room.name}
                      </h3>
                    </div>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setDeleteConfirm({ 
                          type: 'room', 
                          data: { customerId: customer.id, roomId: room.id, roomName: room.name } 
                        }); 
                      }} 
                      className="text-red-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Room Attachments */}
                  {isExpanded && (
                    <div className="mt-4 flex flex-wrap gap-2 items-center">
                      {room.photos?.map((url, i) => (
                        <div 
                          key={i} 
                          onClick={() => { setPreviewUrl(url); setPreviewType('photo'); }}
                          className="relative w-16 h-16 rounded overflow-hidden border cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <img src={url} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {room.videos?.map((url, i) => (
                        <div 
                          key={i} 
                          onClick={() => { setPreviewUrl(url); setPreviewType('video'); }}
                          className="relative w-16 h-16 rounded overflow-hidden border bg-black flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <video src={url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">▶</div>
                        </div>
                      ))}
                      {mode === 'MEASUREMENT' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleFileUpload('photo', (url) => updateRoomAttachments(customer.id, room.id, [...(room.photos||[]), url], room.videos||[]))}
                            className="w-16 h-16 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                            <span className="text-[10px] mt-1">Foto Ekle</span>
                          </button>
                          <button 
                            onClick={() => handleFileUpload('video', (url) => updateRoomAttachments(customer.id, room.id, room.photos||[], [...(room.videos||[]), url]))}
                            className="w-16 h-16 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <Video className="w-4 h-4" />
                            <span className="text-[10px] mt-1">Video Ekle</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* WINDOWS / OPENINGS */}
                {isExpanded && (
                  <div className="p-4 space-y-6">
                    {room.windows.length === 0 && (
                      <div className="p-4 text-center">
                        <button
                          onClick={async () => {
                            if (isSaving) return;
                            setIsSaving(true);
                            try {
                              addWindow(customer.id, room.id, "Pencere 1");
                              await syncNow();
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-4 py-2 rounded-lg flex items-center gap-2 w-full justify-center border border-transparent dark:border-blue-800/50 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> Yeni Şablonla Ölçü Al
                        </button>
                      </div>
                    )}
                    {room.windows.map(window => {
                      const isSingleDefault = room.windows.length === 1 && window.name === "Pencere 1";
                      return (
                        <div key={window.id} className={isSingleDefault ? "space-y-4" : "border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-4 ml-2"}>
                          
                          {!isSingleDefault && (
                            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-4">
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-md">
                                  <WindowIcon className="w-4 h-4 text-blue-500" />
                                  {window.name}
                                </h4>
                                
                                {/* Window Attachments Button */}
                                {mode === 'MEASUREMENT' && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleFileUpload('photo', (url) => updateWindowItem(customer.id, room.id, window.id, { photos: [...(window.photos||[]), url] }))}
                                      className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-400 flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Camera className="w-3 h-3" /> Foto Ekle
                                    </button>
                                    <button 
                                      onClick={() => handleFileUpload('video', (url) => updateWindowItem(customer.id, room.id, window.id, { videos: [...(window.videos||[]), url] }))}
                                      className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-400 flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Video className="w-3 h-3" /> Video Ekle
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button 
                                onClick={() => setDeleteConfirm({
                                  type: 'window',
                                  data: { customerId: customer.id, roomId: room.id, windowId: window.id, windowName: window.name }
                                })} 
                                className="text-red-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        
                        {/* Display Window Attachments */}
                        {((window.photos && window.photos.length > 0) || (window.videos && window.videos.length > 0)) && (
                          <div className="flex gap-2 flex-wrap">
                            {window.photos?.map((url, i) => (
                              <div
                                key={i}
                                onClick={() => { setPreviewUrl(url); setPreviewType('photo'); }}
                                className="relative w-12 h-12 rounded overflow-hidden border cursor-pointer hover:opacity-85 transition-opacity"
                              >
                                <img src={url} className="w-full h-full object-cover" />
                              </div>
                            ))}
                            {window.videos?.map((url, i) => (
                              <div
                                key={i}
                                onClick={() => { setPreviewUrl(url); setPreviewType('video'); }}
                                className="relative w-12 h-12 rounded overflow-hidden border bg-black flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                              >
                                <video src={url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">▶</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* MEASUREMENTS LIST */}
                        <div className="space-y-3">
                          {window.products.map(p => (
                            <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm ml-6 relative">
                              
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-1 rounded text-xs font-bold border ${getWorkflowStatusColorClass(p.status)}`}>
                                      {getWorkflowStatusLabel(p.status)}
                                    </span>
                                    <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">{getTemplateLabel(p.templateType)} Şablonu</span>
                                  </div>
                                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                                    <span>Ölçen: <span className="font-medium text-gray-700 dark:text-gray-300">{p.measuredBy}</span></span>
                                    {p.measuredDate && <span>Tarih: {new Date(p.measuredDate).toLocaleDateString()}</span>}
                                    {p.createdById && p.createdById !== p.measuredById && (
                                      <span className="text-orange-500">Kaydeden: {users.find(u => u.id === p.createdById)?.name || p.createdById}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                   {mode === 'MEASUREMENT' && (
                                      (normRole === 'ADMIN' || normRole === 'OFFICE') ? (
                                        <button 
                                          onClick={() => {
                                            const resolvedTemplate = p.templateType === 'CURTAIN' ? 'CURTAIN_DETAIL' : p.templateType;
                                            setEditingMeasurementId(p.id);
                                            setActiveWindowIdForProduct(window.id);
                                            setSelectedTemplate(resolvedTemplate);
                                            setRawValues(p.rawValues || {});
                                            setMeasurementNotes(p.notes || "");
                                            setOverrideMeasuredById(p.measuredById || currentUser?.id || "");
                                          }}
                                          className="text-blue-500 hover:text-blue-700 p-1 cursor-pointer font-bold text-xs flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                                          title="Ölçüyü Düzenle"
                                        >
                                          Düzenle
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 italic block mt-1">
                                          Kaydedilen ölçüler sadece yönetici tarafından düzenlenebilir.
                                        </span>
                                      )
                                   )}
                                   <button 
                                      onClick={() => setDeleteConfirm({
                                        type: 'measurement',
                                        data: { customerId: customer.id, roomId: room.id, windowId: window.id, measurementId: p.id }
                                      })} 
                                      className="text-red-400 hover:text-red-600 p-1 cursor-pointer font-bold animate-fade-in"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                 </div>
                              </div>

                              {/* Raw Values Grid */}
                              {p.templateType === 'mechanical_curtain' ? (
                                <div className="bg-blue-50/50 dark:bg-blue-950/10 p-3.5 rounded-lg mb-3 border border-blue-100 dark:border-blue-900/30">
                                  <div className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2.5 flex items-center justify-between">
                                    <span>{p.rawValues?.productType || 'Diğer Mekanik Perde'}</span>
                                    {Number(p.rawValues?.quantity || 1) > 1 && (
                                      <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full">
                                        {p.rawValues?.quantity} Adet
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div className="bg-white dark:bg-gray-900/60 p-2 rounded border border-gray-100 dark:border-gray-800">
                                      <span className="text-[9px] text-gray-500 uppercase block font-medium">Gerçek Ölçü</span>
                                      <span className="font-semibold text-gray-900 dark:text-white text-[13px]">
                                        {p.rawValues?.width} × {p.rawValues?.height} cm
                                      </span>
                                    </div>
                                    <div className="bg-white dark:bg-gray-900/60 p-2 rounded border border-gray-100 dark:border-gray-800">
                                      <span className="text-[9px] text-gray-500 uppercase block font-medium">Hesap Ölçüsü</span>
                                      <span className="font-semibold text-gray-900 dark:text-white text-[13px]">
                                        {(() => {
                                          const w = Number(p.rawValues?.width || 0);
                                          const h = Number(p.rawValues?.height || 0);
                                          const calc = calculateMechanicalCurtainM2(w, h, 1);
                                          return `${calc.billingWidth} × ${calc.billingHeight} cm`;
                                        })()}
                                      </span>
                                    </div>
                                    <div className="bg-green-50/40 dark:bg-green-950/10 p-2 rounded border border-green-100/50 dark:border-green-900/20">
                                      <span className="text-[9px] text-green-600 dark:text-green-400 uppercase block font-medium">
                                        {Number(p.rawValues?.quantity || 1) > 1 ? 'Toplam m²' : 'm²'}
                                      </span>
                                      <span className="font-bold text-green-700 dark:text-green-400 text-[13px]">
                                        {(() => {
                                          const w = Number(p.rawValues?.width || 0);
                                          const h = Number(p.rawValues?.height || 0);
                                          const q = Number(p.rawValues?.quantity || 1);
                                          const calc = calculateMechanicalCurtainM2(w, h, q);
                                          return `${calc.totalM2.toFixed(2)} m²`;
                                        })()}
                                      </span>
                                    </div>
                                  </div>
                                  {p.rawValues?.notes && p.rawValues?.notes.trim() && (
                                    <div className="mt-2.5 pt-2 border-t border-dashed border-blue-100 dark:border-blue-900/30 text-xs">
                                      <span className="text-[9px] text-gray-500 uppercase block font-medium">Not:</span>
                                      <span className="text-gray-700 dark:text-gray-300">{p.rawValues?.notes}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3 border border-gray-200 dark:border-gray-700">
                                  {Object.entries(p.rawValues || {}).map(([key, val]) => {
                                    const template = MEASUREMENT_TEMPLATES[p.templateType] || (p.templateType === 'CURTAIN' ? MEASUREMENT_TEMPLATES['CURTAIN_DETAIL'] : undefined);
                                    const label = template?.fields.find(f => f.key === key)?.label || key;
                                    return (
                                      <div key={key} className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase">{label}</span>
                                        <span className="font-semibold text-gray-900 dark:text-white text-sm">{String(val)}</span>
                                      </div>
                                    );
                                  })}
                                  {p.notes && (
                                    <div className="col-span-full mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Saha Notu:</span>
                                      <span className="text-sm text-gray-800 dark:text-gray-200 block">{p.notes}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Display Measurement Attachments */}
                              {((p.photos && p.photos.length > 0) || (p.videos && p.videos.length > 0)) && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                  {p.photos?.map((url, i) => (
                                    <div
                                      key={i}
                                      onClick={() => { setPreviewUrl(url); setPreviewType('photo'); }}
                                      className="relative w-12 h-12 rounded overflow-hidden border cursor-pointer hover:opacity-85 transition-opacity"
                                    >
                                      <img src={url} className="w-full h-full object-cover" />
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'photo', data: { url, type: 'measurement', customerId: customer.id, roomId: room.id, windowId: window.id, measurementId: p.id } }); }}
                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </div>
                                  ))}
                                  {p.videos?.map((url, i) => (
                                    <div
                                      key={i}
                                      onClick={() => { setPreviewUrl(url); setPreviewType('video'); }}
                                      className="relative w-12 h-12 rounded overflow-hidden border bg-black flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                                    >
                                      <video src={url} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">▶</div>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'photo', data: { url, type: 'measurement', customerId: customer.id, roomId: room.id, windowId: window.id, measurementId: p.id } }); }}
                                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Measurement Media Upload Buttons */}
                              {mode === 'MEASUREMENT' && (
                                <div className="flex gap-2 mb-3">
                                  <button
                                    onClick={() => handleFileUpload('photo', (url) => {
                                      updateProductMeasurement(customer.id, room.id, window.id, p.id, {
                                        photos: [...(p.photos || []), url]
                                      });
                                    })}
                                    className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-2.5 py-1.5 rounded text-gray-700 dark:text-gray-300 flex items-center gap-1 transition-colors border border-gray-200 dark:border-gray-700"
                                  >
                                    <Camera className="w-3.5 h-3.5" /> Foto Ekle
                                  </button>
                                  <button
                                    onClick={() => handleFileUpload('video', (url) => {
                                      updateProductMeasurement(customer.id, room.id, window.id, p.id, {
                                        videos: [...(p.videos || []), url]
                                      });
                                    })}
                                    className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-2.5 py-1.5 rounded text-gray-700 dark:text-gray-300 flex items-center gap-1 transition-colors border border-gray-200 dark:border-gray-700"
                                  >
                                    <Video className="w-3.5 h-3.5" /> Video Ekle
                                  </button>
                                </div>
                              )}

                              {/* Office Assignment Info */}
                              {p.productId || p.productType ? (
                                <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
                                  <span className="text-[10px] text-orange-600 font-bold uppercase block mb-1">Ofis Ürün Ataması</span>
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.productGroup} - {p.productType}</div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">Üretim Ölçüsü: {p.calculatedWidth}x{p.calculatedHeight}</div>
                                </div>
                              ) : null}

                              {/* OFFICE MODE ACTION PANEL */}
                              {mode === 'OFFICE' && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">

                                  {/* ADMIN CORRECTION PANEL */}
                                  {permissions.canOverrideMeasuredBy && (
                                    <div className="mb-4">
                                      {correctionTarget === p.id ? (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-lg space-y-2">
                                          <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span className="text-xs font-bold text-red-700 dark:text-red-400">Ölçüm Sorumluluğu Düzeltmesi</span>
                                          </div>
                                          <div className="text-[10px] text-gray-500 dark:text-gray-400">Mevcut: <span className="font-bold text-gray-800 dark:text-gray-200">{p.measuredBy}</span></div>
                                          <select 
                                            value={correctionNewUserId}
                                            onChange={e => setCorrectionNewUserId(e.target.value)}
                                            className="w-full p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none"
                                          >
                                            <option value="">Yeni sorumlu seç...</option>
                                            {measurementEmployees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                          </select>
                                          <input 
                                            type="text"
                                            placeholder="Düzeltme sebebi (zorunlu)"
                                            value={correctionReason}
                                            onChange={e => setCorrectionReason(e.target.value)}
                                            className="w-full p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:placeholder-gray-500 focus:ring-2 focus:ring-red-500 outline-none"
                                          />
                                          <div className="flex gap-2">
                                            <button 
                                              onClick={() => handleCorrectionSave(room.id, window.id, p)}
                                              disabled={!correctionNewUserId || !correctionReason.trim()}
                                              className="flex-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded font-bold transition-colors"
                                            >
                                              Düzeltmeyi Kaydet
                                            </button>
                                            <button 
                                              onClick={() => { setCorrectionTarget(null); setCorrectionReason(''); setCorrectionNewUserId(''); }}
                                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 px-3 py-1.5"
                                            >
                                              İptal
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button 
                                          onClick={() => { setCorrectionTarget(p.id); setCorrectionNewUserId(''); setCorrectionReason(''); }}
                                          className="text-[10px] text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-1 mb-2"
                                        >
                                          <Shield className="w-3 h-3" /> Ölçüm Sorumluluğunu Düzelt (Admin)
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex gap-2 mb-4">
                                    <select 
                                      className="text-xs p-1.5 border border-gray-300 dark:border-gray-600 rounded font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                      value={p.status || 'MEASURED'}
                                      onChange={(e) => updateProductMeasurement(customer.id, room.id, window.id, p.id, { status: e.target.value })}
                                    >
                                      {Object.entries(WORKFLOW_STATUS_LABELS).map(([val, label]) => (
                                        <option key={val} value={val} className="bg-gray-900 text-white">
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                    <button 
                                      onClick={() => {
                                        setActiveMeasurementIdForConfig(activeMeasurementIdForConfig === p.id ? null : p.id);
                                      }}
                                      className="text-xs bg-gray-900 dark:bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-gray-800 dark:hover:bg-blue-700 transition-colors"
                                    >
                                      Ürün Bağla / Fiyatlandır
                                    </button>
                                  </div>

                                  {activeMeasurementIdForConfig === p.id && (
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800/80 rounded mb-4 border border-gray-200 dark:border-gray-700">
                                      <h6 className="text-xs font-bold mb-2 text-gray-800 dark:text-gray-200">Ürün Seçimi</h6>
                                      <div className="flex gap-2">
                                        <select value={officeProductGroup} onChange={e=>setOfficeProductGroup(e.target.value)} className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                          <option>Tül / Güneşlik</option>
                                          <option>Mekanik Sistemler</option>
                                        </select>
                                        <input type="text" placeholder="Alt Tip (örn: Keten)" value={officeProductType} onChange={e=>setOfficeProductType(e.target.value)} className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" />
                                        <button onClick={() => handleOfficeSave(room.id, window.id, p)} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">Kaydet</button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Notes History */}
                                  <div className="mt-2">
                                    <h6 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Ofis Not Geçmişi</h6>
                                    <div className="space-y-2 mb-2 max-h-32 overflow-y-auto">
                                      {p.notesHistory?.map((n, i) => (
                                        <div key={i} className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800/40">
                                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                            <span>{n.author}</span>
                                            <span>{new Date(n.date).toLocaleString()}</span>
                                          </div>
                                          <p className="text-gray-800 dark:text-gray-200">{n.note}</p>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        placeholder="Yeni not ekle..." 
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        className="flex-1 p-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                      <button onClick={() => handleAddNote(room.id, window.id, p)} className="bg-gray-200 dark:bg-gray-700 px-3 rounded text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Ekle</button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* MEASUREMENT MODE: Add new Raw Measurement */}
                        {mode === 'MEASUREMENT' && (
                          activeWindowIdForProduct === window.id ? (
                            <div className="mt-4 border-2 border-blue-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg ml-6">
                              <div className="bg-blue-50 dark:bg-gray-900 p-3 border-b border-blue-100 dark:border-gray-700 flex justify-between items-center">
                                <h5 className="font-bold text-blue-900 dark:text-gray-100">
                                  {editingMeasurementId ? "Saha Ölçüsü Düzenleme Formu" : "Saha Ölçü Formu"}
                                </h5>
                                <button onClick={() => { setActiveWindowIdForProduct(null); setEditingMeasurementId(null); }}><X className="w-5 h-5 text-blue-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-200" /></button>
                              </div>
                              
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ölçüm Şablonu</label>
                                    <select 
                                      value={selectedTemplate} 
                                      onChange={(e) => { setSelectedTemplate(e.target.value); setRawValues({}); }}
                                      className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                      {Object.values(MEASUREMENT_TEMPLATES).map(t => (
                                        <option key={t.type} value={t.type}>{getTemplateLabel(t.type)}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ölçüyü Alan</label>
                                    {permissions.canOverrideMeasuredBy ? (
                                      /* ADMIN/SALES can select who measured */
                                      <select 
                                        value={overrideMeasuredById} 
                                        onChange={(e) => setOverrideMeasuredById(e.target.value)}
                                        className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                      >
                                        {measurementEmployees.map(u => <option key={u.id} value={u.id}>{u.name} ({(ROLE_PERMISSIONS[u.role] || { label: u.role }).label})</option>)}
                                      </select>
                                    ) : (
                                      /* Normal users see their own name, read-only */
                                      <div className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-900/50 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium flex items-center gap-2">
                                        <Shield className="w-3.5 h-3.5 text-blue-500" />
                                        {currentUser?.name || "Bilinmiyor"}
                                        <span className="text-[10px] text-gray-500 dark:text-gray-500 ml-auto">Otomatik</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className={`grid gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded border dark:border-gray-700 ${selectedTemplate === 'CURTAIN_DETAIL' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                  {MEASUREMENT_TEMPLATES[selectedTemplate]?.fields.map(f => (
                                    <div key={f.key} className={selectedTemplate === 'mechanical_curtain' && f.key === 'notes' ? 'col-span-2' : ''}>
                                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                                      {f.type === 'select' ? (
                                        <select
                                          value={rawValues[f.key] !== undefined ? rawValues[f.key] : (f.options && f.options.length > 0 ? f.options[0] : '')}
                                          onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                          className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                                        >
                                          {f.options?.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input 
                                          type={f.type} 
                                          step={f.type === 'number' ? 'any' : undefined}
                                          placeholder={f.label}
                                          value={rawValues[f.key] !== undefined ? rawValues[f.key] : (f.defaultValue !== undefined ? f.defaultValue : '')}
                                          onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                          className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Saha Notları (İsteğe Bağlı, Engeller vb.)</label>
                                  <textarea 
                                    value={measurementNotes} 
                                    placeholder="Herhangi bir engel veya not var mı?"
                                    onChange={(e) => setMeasurementNotes(e.target.value)}
                                    className="w-full p-2 border dark:border-gray-700 rounded bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                                    rows={2}
                                  />
                                </div>

                                <button onClick={() => handleSaveMeasurement(room.id, window.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors text-sm">
                                  {editingMeasurementId ? "Değişiklikleri Kaydet" : "Ölçüyü Kaydet"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="ml-6 mt-3">
                              <button onClick={() => openMeasurementForm(window)} className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-4 py-2 rounded-lg flex items-center gap-2 w-full justify-center border border-transparent dark:border-blue-800/50 transition-colors">
                                <Plus className="w-4 h-4" /> Yeni Şablonla Ölçü Al
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}

                    {/* Add Window Area */}
                    {activeRoomIdForWindow === room.id ? (
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 ml-2">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm dark:text-white">Yeni Açıklık (Pencere/Kapı) Tanımla</h4>
                          <button onClick={() => setActiveRoomIdForWindow(null)}><X className="w-5 h-5 dark:text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            placeholder="örn: Fransız Balkon" 
                            value={windowName} 
                            onChange={e=>setWindowName(e.target.value)} 
                            className="flex-1 p-2.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow" 
                          />
                          <button onClick={() => handleAddWindow(room.id)} className="bg-gray-900 dark:bg-blue-600 text-white px-6 font-bold rounded hover:bg-gray-800 dark:hover:bg-blue-700 transition-colors">Kaydet</button>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-2">
                        <button onClick={() => setActiveRoomIdForWindow(room.id)} className={`w-full py-3 border-2 border-dashed rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${mode === 'MEASUREMENT' ? 'border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <Plus className="w-5 h-5" />
                          Bu Odaya Açıklık Ekle
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
            </>
          )}

          {activeTab === "timeline" && canViewCustomerWorkflowReport(currentUser, customer) && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cari İş Akış Analizi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block mb-1">TOPLAM İŞ SÜRESİ</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{getJobDurationDays()} Gün</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">Cari oluşturulma tarihi ile bugün arasındaki süre</span>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-800 rounded-xl">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">İŞ AKIŞ DURUMU</span>
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{CUSTOMER_WORKFLOW_LABELS[customer.workflowStatus || 'YENI'] || customer.workflowStatus}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">Müşterinin güncel operasyonel aşaması</span>
                  </div>
                </div>
              </div>

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
                      {getTimelineEvents().map((e, index) => (
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
            </div>
          )}

          {activeTab === "financial" && canViewCustomerFinancialReport(currentUser) && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800">
                  <h4 className="font-bold text-gray-900 dark:text-white">Cari Hesap Ekstresi (Finansal Hareketler)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold">
                        <th className="p-4 font-semibold">Tarih</th>
                        <th className="p-4 font-semibold">Belge Türü</th>
                        <th className="p-4 font-semibold">Belge No</th>
                        <th className="p-4 font-semibold">Açıklama</th>
                        <th className="p-4 font-semibold text-right">Borç (Tutar)</th>
                        <th className="p-4 font-semibold text-right">Alacak (Ödeme)</th>
                        <th className="p-4 font-semibold text-right">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-gray-500 dark:text-gray-400">
                          <div className="max-w-md mx-auto space-y-2">
                            <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                            <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">Kayıt Bulunamadı</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Henüz satış, fatura veya tahsilat kaydı bulunmuyor. Satış modülü aktif olduğunda cari hareketleri burada görünecek.
                            </p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Media Upload Modal */}
        {mediaUploadType && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-fade-in"
            onClick={() => { setMediaUploadType(null); setMediaUploadCallback(null); }}
          >
            <div 
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-1">
                <h4 className="text-md font-bold text-white">
                  {mediaUploadType === 'photo' ? 'Fotoğraf Yükle' : 'Video Yükle'}
                </h4>
                <p className="text-xs text-slate-400">
                  Lütfen medya kaynağını seçin.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => triggerFileSelector(true)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Kameradan Çek
                </button>
                <button
                  onClick={() => triggerFileSelector(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-sm transition-colors border border-slate-750 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Galeriden Seç
                </button>
                <button
                  onClick={() => { setMediaUploadType(null); setMediaUploadCallback(null); }}
                  className="w-full py-3 bg-transparent text-slate-400 hover:text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Media Preview Modal */}
        <MediaPreviewModal 
          url={previewUrl} 
          type={previewType} 
          onClose={() => { setPreviewUrl(null); setPreviewType(null); }} 
        />

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-scale-in text-gray-950 dark:text-white">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-500 mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold">Silme İşlemini Onayla</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {deleteConfirm.type === 'photo' && "Bu fotoğrafı silmek istediğinize emin misiniz?"}
                  {deleteConfirm.type === 'room' && `"${deleteConfirm.data.roomName}" odasını ve içindeki tüm açıklık ve ölçüleri silmek istediğinize emin misiniz?`}
                  {deleteConfirm.type === 'window' && `"${deleteConfirm.data.windowName}" açıklığını ve içindeki tüm ölçüleri silmek istediğinize emin misiniz?`}
                  {deleteConfirm.type === 'measurement' && "Bu ölçü kaydını silmek istediğinize emin misiniz?"}
                  <br />
                  <span className="font-semibold text-red-500">Bu işlem senkronize edilecek.</span>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-750 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        )}

        {toastMessage && (
          <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm flex items-center gap-2 border border-gray-850 animate-slide-up">
            <span>{toastMessage}</span>
          </div>
        )}

        <MeasurementVisualReport
          isOpen={isVisualReportOpen}
          onClose={() => setIsVisualReportOpen(false)}
          customer={customer}
          users={users}
        />
      </div>
    </div>
  );
}
