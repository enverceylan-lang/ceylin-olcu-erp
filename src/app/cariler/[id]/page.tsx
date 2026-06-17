"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, X, LayoutPanelTop as WindowIcon, ChevronDown, ChevronRight, Layers, Camera, Video, FileText, CheckCircle, Shield, AlertTriangle, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useStore, WindowItem, MEASUREMENT_TEMPLATES, ProductMeasurement } from "@/store/useStore";
import { useAuthStore, ROLE_PERMISSIONS, MOCK_USERS } from "@/store/useAuthStore";
import { getMeasurementDimensions, getTemplateLabel, getGoogleMapsUrl, getWorkflowStatusLabel, getWorkflowStatusColorClass, WORKFLOW_STATUS_LABELS } from "@/lib/measurementAdapter";
import { fileToDataUrl } from "@/lib/fileStorage";

const MEASUREMENT_EMPLOYEES = MOCK_USERS.filter(u => u.role === 'MEASUREMENT' || u.role === 'ADMIN');

export default function CariDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;
  
  const store = useStore();
  const { customers, addRoom, deleteRoom, addWindow, deleteWindow, updateRoomAttachments, updateWindowItem, addProductMeasurement, updateProductMeasurement, deleteProductMeasurement } = store;
  const { currentUser, addAuditEntry } = useAuthStore();
  
  const [mounted, setMounted] = useState(false);
  const permissions = ROLE_PERMISSIONS[currentUser.role];
  const [mode, setMode] = useState<"MEASUREMENT" | "OFFICE">(permissions.canAccessOfficeMode ? "MEASUREMENT" : "MEASUREMENT");

  const [activeRoomIdForWindow, setActiveRoomIdForWindow] = useState<string | null>(null);
  const [activeWindowIdForProduct, setActiveWindowIdForProduct] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  const [windowName, setWindowName] = useState("");

  // Measurement Template Form State
  const [selectedTemplate, setSelectedTemplate] = useState("CURTAIN_DETAIL");
  const [rawValues, setRawValues] = useState<Record<string, any>>({});
  // For ADMIN/SALES entering on behalf of someone else
  const [overrideMeasuredById, setOverrideMeasuredById] = useState(currentUser.id);
  const [measurementNotes, setMeasurementNotes] = useState("");

  // Office Config Form State
  const [activeMeasurementIdForConfig, setActiveMeasurementIdForConfig] = useState<string | null>(null);
  const [officeProductGroup, setOfficeProductGroup] = useState("Tül / Güneşlik");
  const [officeProductType, setOfficeProductType] = useState("Tül");
  const [newNote, setNewNote] = useState("");

  // Admin correction state
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [correctionNewUserId, setCorrectionNewUserId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-8 text-center">Yükleniyor...</div>;

  const customer = customers.find(c => c.id === id);

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-red-500 font-medium">Müşteri bulunamadı.</p>
        <Link href="/cariler" className="text-blue-600 hover:underline">Listeye Dön</Link>
      </div>
    );
  }

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
    const report = buildWhatsAppReport();

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

  const handleAddRoom = () => {
    const name = window.prompt("Oda adı giriniz (örn: Salon, Yatak Odası):");
    if (name && name.trim()) {
      addRoom(customer.id, name);
    }
  };

  const handleAddWindow = (roomId: string) => {
    if (!windowName) return alert("Pencere adı zorunludur.");
    addWindow(customer.id, roomId, windowName);
    setActiveRoomIdForWindow(null);
    setWindowName("");
  };

  const handleFileUpload = (type: 'photo' | 'video', callback: (url: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'photo' ? 'image/*' : 'video/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const dataUrl = await fileToDataUrl(file, type);
        callback(dataUrl);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Dosya kaydedilemedi.');
      }
    };
    input.click();
  };

  const openMeasurementForm = (w: WindowItem) => {
    setActiveWindowIdForProduct(w.id);
    setSelectedTemplate("CURTAIN_DETAIL");
    setRawValues({});
    setMeasurementNotes("");
    setOverrideMeasuredById(currentUser.id);
  };

  const handleSaveMeasurement = (roomId: string, windowId: string) => {
    // Determine who actually measured
    const isOfficeEntry = permissions.canAccessOfficeMode && overrideMeasuredById !== currentUser.id;
    const measuredByUser = MOCK_USERS.find(u => u.id === overrideMeasuredById) || currentUser;
    const now = new Date().toISOString();

    const parsedRawValues: Record<string, number> = {};
    const templateFields = MEASUREMENT_TEMPLATES[selectedTemplate]?.fields || [];
    templateFields.forEach(f => {
      const val = rawValues[f.key];
      parsedRawValues[f.key] = val !== undefined && val !== '' ? Number(val) : 0;
    });

    addProductMeasurement(customer.id, roomId, windowId, {
      templateType: selectedTemplate,
      rawValues: parsedRawValues,
      notes: measurementNotes,
      status: "MEASURED",
      measuredBy: measuredByUser.name,
      measuredById: measuredByUser.id,
      createdById: currentUser.id,
      measuredDate: now,
      createdAt: now,
      updatedAt: now,
      notesHistory: [],
      photos: [],
      videos: [],
    });
    setActiveWindowIdForProduct(null);
  };

  const handleAddNote = (roomId: string, windowId: string, m: ProductMeasurement) => {
    if (!newNote.trim()) return;
    const note = { date: new Date().toISOString(), note: newNote, author: currentUser.name };
    updateProductMeasurement(customer.id, roomId, windowId, m.id, {
      notesHistory: [...(m.notesHistory || []), note],
      updatedAt: new Date().toISOString(),
    });
    setNewNote("");
  };

  const handleCorrectionSave = (roomId: string, windowId: string, m: ProductMeasurement) => {
    if (!correctionNewUserId || !correctionReason.trim()) return;
    const newUser = MOCK_USERS.find(u => u.id === correctionNewUserId);
    if (!newUser) return;

    addAuditEntry({
      entityType: 'ProductMeasurement',
      entityId: m.id,
      field: 'measuredById',
      previousValue: `${m.measuredBy} (${m.measuredById || 'N/A'})`,
      newValue: `${newUser.name} (${newUser.id})`,
      changedBy: currentUser.name,
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/cariler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ölçü & Proje Yönetimi (V2)</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={handleShareWhatsAppReport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm transition-colors"
            title="Müşteri ölçü raporunu WhatsApp ile paylaş"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Ölçü Raporu
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
                <span className="block text-gray-500 dark:text-gray-400">Telefon</span>
                <span className="font-medium text-gray-900 dark:text-white">{customer.phone || '-'}</span>
              </div>
              <div>
                <span className="block text-gray-500 dark:text-gray-400 mb-1">Adres</span>
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
            </div>
          </div>
          
          <button onClick={handleAddRoom} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-sm transition-colors ${mode === 'MEASUREMENT' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-800 dark:text-white'}`}>
            <Plus className="w-5 h-5" />
            Yeni Oda Ekle
          </button>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-4">
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
                    <button onClick={(e) => { e.stopPropagation(); deleteRoom(customer.id, room.id); }} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Room Attachments */}
                  {isExpanded && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {room.photos?.map((url, i) => (
                        <div key={i} className="relative w-16 h-16 rounded overflow-hidden border">
                          <img src={url} className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {mode === 'MEASUREMENT' && (
                        <button 
                          onClick={() => handleFileUpload('photo', (url) => updateRoomAttachments(customer.id, room.id, [...(room.photos||[]), url], room.videos||[]))}
                          className="w-16 h-16 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          <span className="text-[10px]">İsteğe Bağlı</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* WINDOWS / OPENINGS */}
                {isExpanded && (
                  <div className="p-4 space-y-6">
                    {room.windows.map(window => (
                      <div key={window.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-4 ml-2">
                        
                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4">
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-md">
                              <WindowIcon className="w-4 h-4 text-blue-500" />
                              {window.name}
                            </h4>
                            
                            {/* Window Attachments Button */}
                            {mode === 'MEASUREMENT' && (
                              <button 
                                onClick={() => handleFileUpload('photo', (url) => updateWindowItem(customer.id, room.id, window.id, { photos: [...(window.photos||[]), url] }))}
                                className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-400 flex items-center gap-1 transition-colors"
                              >
                                <Camera className="w-3 h-3" /> Foto Ekle (İsteğe Bağlı)
                              </button>
                            )}
                          </div>
                          <button onClick={() => deleteWindow(customer.id, room.id, window.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Display Window Attachments */}
                        {window.photos && window.photos.length > 0 && (
                          <div className="flex gap-2">
                            {window.photos.map((url, i) => <img key={i} src={url} className="w-12 h-12 rounded object-cover border" />)}
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
                                      <span className="text-orange-500">Kaydeden: {MOCK_USERS.find(u => u.id === p.createdById)?.name || p.createdById}</span>
                                    )}
                                  </div>
                                </div>
                                <button onClick={() => deleteProductMeasurement(customer.id, room.id, window.id, p.id)} className="text-red-400 hover:text-red-600 p-1">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Raw Values Grid */}
                              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded grid grid-cols-2 md:grid-cols-3 gap-2 mb-3 border border-gray-200 dark:border-gray-700">
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
                                            {MEASUREMENT_EMPLOYEES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                                <h5 className="font-bold text-blue-900 dark:text-gray-100">Saha Ölçü Formu</h5>
                                <button onClick={() => setActiveWindowIdForProduct(null)}><X className="w-5 h-5 text-blue-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-200" /></button>
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
                                        {MEASUREMENT_EMPLOYEES.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_PERMISSIONS[u.role].label})</option>)}
                                      </select>
                                    ) : (
                                      /* Normal users see their own name, read-only */
                                      <div className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-900/50 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium flex items-center gap-2">
                                        <Shield className="w-3.5 h-3.5 text-blue-500" />
                                        {currentUser.name}
                                        <span className="text-[10px] text-gray-500 dark:text-gray-500 ml-auto">Otomatik</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded border dark:border-gray-700">
                                  {MEASUREMENT_TEMPLATES[selectedTemplate]?.fields.map(f => (
                                    <div key={f.key}>
                                      <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                                      <input 
                                        type={f.type} 
                                        step={f.type === 'number' ? 'any' : undefined}
                                        placeholder={f.label}
                                        value={rawValues[f.key] || ''}
                                        onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                        className="w-full p-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-900 dark:text-white dark:placeholder-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                                      />
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
                                  Saha Ölçüsünü Kaydet
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
                    ))}

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
        </div>
      </div>
    </div>
  );
}
