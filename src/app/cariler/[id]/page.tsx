"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Plus, Trash2, X, LayoutPanelTop as WindowIcon, ChevronDown, ChevronRight, ChevronUp, Layers, Camera, Video, FileText, Shield, AlertTriangle, MapPin, MessageCircle, Loader2, Ruler, RefreshCw, Phone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useStore, Customer, Room, WindowItem, MEASUREMENT_TEMPLATES, ProductMeasurement } from "@/store/useStore";
import { useMeasurementStore } from "@/store/measurementStore";
import { useAuthStore, ROLE_PERMISSIONS, normalizeRole, canViewCustomer, canViewCustomerWorkflowReport, canViewCustomerContactFields, canViewCariCard, canEditCari, canMergeCari, canArchiveCari, canMoveMeasurementBetweenCustomers, canTransferMeasurementToSale } from "@/store/useAuthStore";
import { isPilotFieldV1RuntimeEnabled } from "@/lib/pilotFieldV1";
import { getMeasurementDimensions, getTemplateLabel, getGoogleMapsUrl, getWorkflowStatusLabel, getWorkflowStatusColorClass, WORKFLOW_STATUS_LABELS } from "@/lib/measurementAdapter";
import { fileToDataUrl } from "@/lib/fileStorage";
import { MediaPreviewModal } from "@/components/MediaPreviewModal";
import { syncNow } from "@/lib/syncService";
import { buildWhatsAppShortReport, getValidNote } from "@/lib/reportFormatters";
import { fetchActiveCompanyDisplayName } from "@/lib/activeCompanyDisplayNameClient";
import { MeasurementVisualReport } from "@/components/reports/MeasurementVisualReport";
import { RoomPreparationModal } from "@/components/reports/RoomPreparationModal";
import { localDraftDb, FieldMeasurementDraft, forceRequeueCustomerMeasurementTree } from "@/lib/localDraftDb";
import { useSalesStore } from "@/store/salesStore";
import { syncOrCreateDraftSale } from "@/lib/salesAdapter";
import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";
import { ShoppingCart, Edit, Merge, Archive } from "lucide-react";
import { CariEditModal } from "@/components/modals/CariEditModal";
import { MergeCustomerModal } from "@/components/modals/MergeCustomerModal";
import { MoveRoomModal } from "@/components/modals/MoveRoomModal";
import { FacadeSegmentsEditor } from "@/components/measurements/FacadeSegmentsEditor";
import { PlicellCamListEditor } from "@/components/measurements/PlicellCamListEditor";
import { FieldTaskAssignButton } from "@/components/FieldTaskAssignButton";
import { hasSlopedFacadeHeight } from "@/lib/facadeHeight";
import { CustomerFinancePanel } from "@/components/finance/CustomerFinancePanel";
import { CounterpartyPayablePanel } from "@/components/finance/CounterpartyPayablePanel";
import { validateMeasurementRecord } from "@/lib/measurementValidationEngine";

const measurementOpeningId = (measurement: { openingId?: string; windowId?: string }) =>
  measurement.openingId || measurement.windowId || "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getMeasurementUserShortCode = (name: string | undefined): string => {
  const clean = String(name || "").trim();
  if (!clean) return "?";
  if (/^\d+$/.test(clean)) return clean.slice(0, 6);

  const parts = clean
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  const initials = parts
    .slice(0, 3)
    .map(part => part.charAt(0))
    .join("")
    .toLocaleUpperCase("tr-TR");

  return initials || clean.slice(0, 4).toLocaleUpperCase("tr-TR");
};

type DeleteConfirmation =
  | { type: "room"; data: { customerId: string; roomId: string; roomName: string } }
  | { type: "window"; data: { customerId: string; roomId: string; windowId: string; windowName: string } }
  | { type: "measurement"; data: { customerId: string; roomId: string; windowId: string; measurementId: string } }
  | {
      type: "photo";
      data:
        | { type: "measurement"; url: string; customerId: string; roomId: string; windowId: string; measurementId: string }
        | { type?: never; customerId: string; index: number };
    };

export default function CariDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;

  const store = useStore();
  const measurementStore = useMeasurementStore();
  const { customers, updateCustomer, addRoom, deleteRoom, addWindow, deleteWindow, updateRoomAttachments, updateWindowItem, addProductMeasurement, updateProductMeasurement, deleteProductMeasurement } = store;
  const { currentUser, addAuditEntry, users } = useAuthStore();
  const user = currentUser!;
  const customer = customers.find(c => c.id === id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [salePreparationBridgeHandled, setSalePreparationBridgeHandled] =
    useState(false);
  const { scope } = useErpRuntimeContext();

  const normRole = user ? normalizeRole(user.role) : 'FIELD';
  const cariType = customer?.cariType || 'CUSTOMER';

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isCustomerCardExpanded, setIsCustomerCardExpanded] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleTargetRecover = async () => {
    if (!customer?.id) return;
    setIsRecovering(true);
    try {
      const result = await forceRequeueCustomerMeasurementTree(customer.id);
      if (result.counts) {
        alert(`Sonuç: ${result.message}\n\nCari ID: ${customer.id.substring(0, 8)}...\nOdalar: ${result.counts.roomsCount}\nAçıklıklar: ${result.counts.openingsCount}\nÖlçüler: ${result.counts.measurementsCount}\nKuyrukta: ${result.queued ? 'EVET' : 'HAYIR'}\nZaten Kuyruktaydı: ${result.alreadyQueued ? 'EVET' : 'HAYIR'}`);
      } else {
        alert(result.message);
      }
    } catch (error: unknown) {
      alert("Kurtarma sırasında hata oluştu: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsRecovering(false);
    }
  };
  const [isMoveRoomModalOpen, setIsMoveRoomModalOpen] = useState(false);
  const [roomToMove, setRoomToMove] = useState<Room | null>(null);

  const canEdit = canEditCari(user, cariType);
  const canMerge = canMergeCari(user);
  const canArchive = canArchiveCari(user, cariType);
  const canMoveRoom = canMoveMeasurementBetweenCustomers(user);
  const canTransferToSale =
    canTransferMeasurementToSale(user);
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

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const permissions = ROLE_PERMISSIONS[currentUser?.role || "FIELD"] || { label: "Kullanıcı", canAccessOfficeMode: false, canOverrideMeasuredBy: false };
  const [mode, setMode] = useState<"MEASUREMENT" | "OFFICE">("MEASUREMENT");
  const [requestedTab, setActiveTab] = useState<"rooms" | "timeline" | "financial">("rooms");

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
  const [pendingNewWindow, setPendingNewWindow] = useState<{
    roomId: string;
    windowId: string;
  } | null>(null);
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
  const [rawValues, setRawValues] = useState<ProductMeasurement["rawValues"]>({});
  // For ADMIN/SALES entering on behalf of someone else
  const [overrideMeasuredById, setOverrideMeasuredById] = useState(currentUser?.id || "");
  const [measurementNotes, setMeasurementNotes] = useState("");
  const [measurementViewMode, setMeasurementViewMode] = useState<"CARD"|"GRID">("CARD");
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
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [selectedRoomForPrep, setSelectedRoomForPrep] = useState<Room | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmation | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;

    const { type, data } = deleteConfirm;
    const username =
      currentUser?.name ||
      currentUser?.username ||
      currentUser?.email ||
      "SYSTEM";

    try {
      if (type === "room") {
        await measurementStore.cascadeDeleteRoom(
          data.customerId,
          data.roomId,
          username,
        );
        await deleteRoom(data.customerId, data.roomId);
      } else if (type === "window") {
        await measurementStore.cascadeDeleteOpening(
          data.customerId,
          data.roomId,
          data.windowId,
          username,
        );
        await deleteWindow(
          data.customerId,
          data.roomId,
          data.windowId,
        );
      } else if (type === "measurement") {
        await deleteProductMeasurement(
          data.customerId,
          data.roomId,
          data.windowId,
          data.measurementId,
        );
      } else if (type === "photo") {
        if (data.type === "measurement") {
          const measObj = measurementStore.measurements.find(
            (measurement) => measurement.id === data.measurementId,
          );

          if (measObj) {
            const updatedPhotos = (measObj.photos || []).filter(
              (url) => url !== data.url,
            );
            const updatedVideos = (measObj.videos || []).filter(
              (url) => url !== data.url,
            );

            await updateProductMeasurement(
              data.customerId,
              data.roomId,
              data.windowId,
              data.measurementId,
              {
                photos: updatedPhotos,
                videos: updatedVideos,
              },
            );
          }
        } else {
          const addressPhotos = customer?.addressPhotos || [];
          const updated = addressPhotos.filter(
            (_, index) => index !== data.index,
          );

          await updateCustomer(data.customerId, {
            addressPhotos: updated,
          });
        }
      }

      setDeleteConfirm(null);
      await measurementStore.loadMeasurements();

      try {
        await syncNow();
      } catch (syncError) {
        console.error(syncError);
      }
    } catch (error) {
      console.error(
        "[CascadeDelete] Silme işlemi tamamlanamadı:",
        error,
      );
      showToast(
        "Silme işlemi tamamlanamadı. Bağlı kayıtlar korunuyor.",
      );
    }
  };

  const activeTab =
    requestedTab === "timeline" &&
    customer &&
    currentUser &&
    !canViewCustomerWorkflowReport(currentUser, customer)
      ? "rooms"
      : requestedTab;

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

  const getJobDurationDays = () => {
    if (!customer.createdAt) return 0;
    const start = new Date(customer.createdAt).getTime();
    const isFinished = customer.workflowStatus === "TAMAMLANDI" || customer.workflowStatus === "IPTAL";
    const end = isFinished && customer.updatedAt ? new Date(customer.updatedAt).getTime() : renderedAt;
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
        measurementStore.measurements.filter(m => measurementOpeningId(m) === win.id && !m.isDeleted).forEach(p => {
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

  const handleShareWhatsAppReport = async () => {
    let activeCompanyName: string;

    try {
      activeCompanyName =
        await fetchActiveCompanyDisplayName();
    } catch {
      showToast(
        "Aktif şirket adı okunamadı. Rapor paylaşılmadı.",
      );
      return;
    }

    const report = buildWhatsAppShortReport(
      customer,
      users,
      useMeasurementStore.getState().measurements,
      activeCompanyName,
    );

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${customer.name} Ölçü Raporu`,
          text: report,
        });

        return;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          '[WhatsAppReport] Native share failed:',
          error instanceof Error
            ? error.message
            : 'Unknown share error',
        );

        window.alert(
          'Telefonun paylaşım ekranı açılamadı. WhatsApp bağlantısı denenecek.',
        );
      }
    }

    const whatsappUrl =
      `https://wa.me/?text=${encodeURIComponent(report)}`;

    const openedWindow = window.open(
      whatsappUrl,
      '_blank',
      'noopener,noreferrer',
    );

    if (openedWindow) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(
          report,
        );

        window.alert(
          'WhatsApp penceresi açılamadı. Ölçü raporu panoya kopyalandı.',
        );

        return;
      }
    } catch (error) {
      console.error(
        '[WhatsAppReport] Clipboard fallback failed:',
        error instanceof Error
          ? error.message
          : 'Unknown clipboard error',
      );
    }

    window.alert(
      'WhatsApp raporu açılamadı. Tarayıcı açılır pencere iznini kontrol edin.',
    );
  };

  const openRoomPreparation = (room: Customer["rooms"][number]) => {
    const activeOpenings = (room.windows || []).filter(
      opening => !opening.isDeleted,
    );

    if (activeOpenings.length === 0) {
      showToast(
        `${room.name} odasında ölçü açıklığı bulunmuyor. Satışa Hazırlık açılamaz.`,
      );
      return;
    }

    for (const opening of activeOpenings) {
      const nestedOpeningMeasurements = (opening.products || []).filter(
        measurement => !measurement.isDeleted,
      );

      const canonicalOpeningMeasurements = measurementStore.measurements.filter(
        measurement =>
          measurement.customerId === customer.id &&
          measurementOpeningId(measurement) === opening.id &&
          !measurement.isDeleted,
      );

      const openingMeasurements = Array.from(
        new Map(
          [
            ...nestedOpeningMeasurements,
            ...canonicalOpeningMeasurements,
          ].map(measurement => [measurement.id, measurement]),
        ).values(),
      );

      if (openingMeasurements.length === 0) {
        showToast(
          `${room.name} > ${opening.name || "Açıklık"} için ölçü kaydedilmeden Satışa Hazırlık açılamaz.`,
        );
        return;
      }

      for (const measurement of openingMeasurements) {
        const issues = validateMeasurementRecord(
          measurement,
          {
            roomId: room.id,
            roomName: room.name,
            openingId: opening.id,
            openingName: opening.name,
          },
        );

        if (issues.length > 0) {
          console.warn(
            "[MeasurementValidation] Satışa Hazırlık kapısı",
            issues,
          );
          showToast(issues[0].message);
          return;
        }
      }
    }

    setSelectedRoomForPrep(room);
    setIsPrepModalOpen(true);
  };
  useEffect(() => {
    if (
      salePreparationBridgeHandled ||
      searchParams.get("openPreparation") !== "1"
    ) {
      return;
    }

    const measurementIds =
      String(searchParams.get("measurementIds") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    if (measurementIds.length === 0) {
      setSalePreparationBridgeHandled(true);
      return;
    }

    const sourceMeasurement =
      measurementStore.measurements.find(
        measurement => measurementIds.includes(measurement.id)
      );

    if (!sourceMeasurement?.roomId) {
      setSalePreparationBridgeHandled(true);
      showToast("Satışa bağlı ölçünün odası bulunamadı.");
      return;
    }

    const sourceRoom =
      customer.rooms?.find(
        room => room.id === sourceMeasurement.roomId
      );

    setSalePreparationBridgeHandled(true);

    if (!sourceRoom) {
      showToast("Satışa bağlı oda bulunamadı.");
      return;
    }

    openRoomPreparation(sourceRoom);
  }, [
    salePreparationBridgeHandled,
    searchParams,
    measurementStore.measurements,
    customer.rooms,
  ]);
  const toggleRoom = (roomId: string) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const handleSaveRoom = async () => {
    if (isSaving) return;
    if (newRoomName.trim()) {
      setIsSaving(true);
      try {
        const newRoomId = await addRoom(customer.id, newRoomName.trim());
        await syncNow();
        setIsAddingRoom(false);
        setNewRoomName("");
        if (newRoomId) {
          setExpandedRooms(prev => ({ ...prev, [newRoomId]: true }));
          setTimeout(() => {
            const el = document.getElementById(`room-card-${newRoomId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-4', 'ring-blue-500', 'transition-all', 'duration-1000');
              setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500'), 2000);
            }
          }, 100);
        }
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
      const newWindowId =
        await addWindow(
          customer.id,
          roomId,
          windowName.trim()
        );

      if (!newWindowId) {
        throw new Error(
          "Açıklık oluşturulamadı."
        );
      }

      await syncNow();
      setActiveRoomIdForWindow(null);
      setWindowName("");
      beginNewWindowMeasurement(
        roomId,
        newWindowId
      );
    } catch (err) {
      console.error(err);
      showToast("Pencere kaydedilirken senkronizasyon hatası oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const beginNewWindowMeasurement = (
    roomId: string,
    windowId: string
  ) => {
    setPendingNewWindow({
      roomId,
      windowId
    });
    setActiveWindowIdForProduct(
      windowId
    );
    setEditingMeasurementId(null);
    setSelectedTemplate(
      "CURTAIN_DETAIL"
    );
    setRawValues({});
    setMeasurementNotes("");
    setOverrideMeasuredById(user.id);
  };

  const isLegacyEmptyDefaultWindow = (
    window: WindowItem
  ) =>
    window.name === "Pencere 1" &&
    window.products.length === 0 &&
    (window.photos?.length || 0) === 0 &&
    (window.videos?.length || 0) === 0;

  const handleStartRoomMeasurement =
    async (room: Room) => {
      if (isSaving) return;

      setIsSaving(true);

      try {
        const legacyEmptyWindow =
          room.windows.find(
            isLegacyEmptyDefaultWindow
          );

        if (legacyEmptyWindow) {
          await updateWindowItem(
            customer.id,
            room.id,
            legacyEmptyWindow.id,
            {
              name: room.name,
              updatedAt:
                new Date().toISOString()
            }
          );

          beginNewWindowMeasurement(
            room.id,
            legacyEmptyWindow.id
          );
          return;
        }

        const newWindowId =
          await addWindow(
            customer.id,
            room.id,
            room.name
          );

        if (!newWindowId) {
          throw new Error(
            "Oda ölçüsü başlatılamadı."
          );
        }

        beginNewWindowMeasurement(
          room.id,
          newWindowId
        );
      } catch (error) {
        console.error(error);
        showToast(
          "Oda ölçüsü başlatılamadı."
        );
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
    if (isPilotFieldV1RuntimeEnabled()) {
      alert(
        "Pilot kullanımında fotoğraf ve video yükleme henüz aktif değildir."
      );
      return;
    }

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

  const hasMeaningfulMeasurementInput = () => {
    const positiveNumber =
      (value: unknown) =>
        Number.isFinite(Number(value)) &&
        Number(value) > 0;

    const facadeSegments =
      Array.isArray(rawValues.facadeSegments)
        ? rawValues.facadeSegments
        : [];

    if (
      facadeSegments.some(
        segment =>
          isRecord(segment) &&
          positiveNumber(segment.widthCm)
      )
    ) {
      return true;
    }

    const plicellGlasses =
      Array.isArray(rawValues.plicellCamListesi)
        ? rawValues.plicellCamListesi
        : [];

    if (
      plicellGlasses.some(
        glass =>
          isRecord(glass) &&
          positiveNumber(
            glass.widthCm ??
              glass.enCm ??
              glass.width
          )
      ) &&
      (
        positiveNumber(
          rawValues.ortakCamBoyuCm
        ) ||
        plicellGlasses.some(
          glass =>
            isRecord(glass) &&
            positiveNumber(
              glass.heightCm ??
                glass.boyCm ??
                glass.height
            )
        )
      )
    ) {
      return true;
    }

    if (selectedTemplate === 'CURTAIN_DETAIL') {
      const hasFacadeWidth =
        facadeSegments.some(
          segment =>
            isRecord(segment) &&
            positiveNumber(segment.widthCm)
        ) ||
        positiveNumber(rawValues.windowWidth);

      if (!hasFacadeWidth) {
        return false;
      }
    }

    const templateFields =
      MEASUREMENT_TEMPLATES[
        selectedTemplate
      ]?.fields || [];

    return templateFields.some(
      field =>
        field.type === 'number' &&
        positiveNumber(
          rawValues[field.key]
        )
    );
  };

  const handleCloseMeasurementForm =
    async (
      roomId: string,
      window: WindowItem
    ) => {
      const shouldRemoveEmptyWindow =
        !editingMeasurementId &&
        pendingNewWindow?.roomId ===
          roomId &&
        pendingNewWindow.windowId ===
          window.id &&
        window.products.length === 0;

      setActiveWindowIdForProduct(null);
      setEditingMeasurementId(null);
      setRawValues({});
      setMeasurementNotes("");

      if (!shouldRemoveEmptyWindow) {
        return;
      }

      await deleteWindow(
        customer.id,
        roomId,
        window.id
      );
      setPendingNewWindow(null);
      await syncNow();
      showToast(
        "Ölçü girilmediği için boş açıklık kaydedilmedi."
      );
    };

  const handleSaveMeasurement = async (roomId: string, windowId: string) => {
    if (isSaving) return;
    const measurementIssues = validateMeasurementRecord(
      {
        templateType: selectedTemplate,
        rawValues,
      },
      {
        roomId,
        roomName: customer.rooms.find(room => room.id === roomId)?.name,
        openingId: windowId,
        openingName: customer.rooms
          .find(room => room.id === roomId)
          ?.windows?.find(opening => opening.id === windowId)?.name,
      },
    );

    if (measurementIssues.length > 0) {
      console.warn(
        "[MeasurementValidation] Ölçü kayıt kapısı",
        measurementIssues,
      );
      showToast(measurementIssues[0].message);
      return;
    }

    if (!hasMeaningfulMeasurementInput()) {
      showToast(
        "En az bir geçerli ölçü girmeden kayıt yapılamaz. İptal etmek için X düğmesini kullanın."
      );
      return;
    }

    setIsSaving(true);
    try {
      const measuredByUser = users.find(u => u.id === overrideMeasuredById) || user;
      const now = new Date().toISOString();

      const parsedRawValues: ProductMeasurement["rawValues"] = {};
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

      if (rawValues.facadeSegments && Array.isArray(rawValues.facadeSegments) && rawValues.facadeSegments.length > 0) {
        parsedRawValues.facadeSegments = rawValues.facadeSegments;
        parsedRawValues.totalFacadeWidthCm = rawValues.facadeSegments.reduce(
          (sum: number, segment: unknown) =>
            sum + (isRecord(segment) && Number(segment.widthCm) > 0 ? Number(segment.widthCm) : 0),
          0
        );
      }

      if (selectedTemplate === 'PLICELL') {
        if (rawValues.plicellCamListesi) parsedRawValues.plicellCamListesi = rawValues.plicellCamListesi;
        if (rawValues.camAdedi !== undefined) parsedRawValues.camAdedi = rawValues.camAdedi;
        if (rawValues.ortakCamBoyuCm !== undefined) parsedRawValues.ortakCamBoyuCm = rawValues.ortakCamBoyuCm;
        if (rawValues.profilRengi !== undefined) parsedRawValues.profilRengi = rawValues.profilRengi;
      }

      const slopedCeiling =
        hasSlopedFacadeHeight(
          parsedRawValues
        );

      if (slopedCeiling) {
        const existingHeightNote =
          String(
            parsedRawValues.yukseklikNotu ||
              ''
          ).trim();

        if (
          !existingHeightNote
            .toLocaleLowerCase('tr-TR')
            .includes('tavan yamuk')
        ) {
          parsedRawValues.yukseklikNotu =
            existingHeightNote
              ? `${existingHeightNote} — Tavan Yamuk`
              : 'Tavan Yamuk';
        }
      }

      const savedMeasurementNotes =
        slopedCeiling &&
        !measurementNotes
          .toLocaleLowerCase('tr-TR')
          .includes('tavan yamuk')
          ? (
              measurementNotes.trim()
                ? `${measurementNotes.trim()} — Tavan Yamuk`
                : 'Tavan Yamuk'
            )
          : measurementNotes;

      if (editingMeasurementId) {
        await updateProductMeasurement(customer.id, roomId, windowId, editingMeasurementId, {
          templateType: selectedTemplate,
          rawValues: parsedRawValues,
          notes: savedMeasurementNotes,
          measuredBy: measuredByUser.name,
          measuredById: measuredByUser.id,
          updatedAt: now,
        });
      } else {
        await addProductMeasurement(customer.id, roomId, windowId, {
          templateType: selectedTemplate,
          rawValues: parsedRawValues,
          notes: savedMeasurementNotes,
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
      if (
        pendingNewWindow?.windowId ===
        windowId
      ) {
        setPendingNewWindow(null);
      }
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

  const handleSaveAsLocalDraft = async () => {
    if (!customer) return;
    try {
      const draftId = customer.id;
      const existing = await localDraftDb.measurementDrafts.get(draftId);
      const now = new Date().toISOString();
      const draftData: FieldMeasurementDraft = {
        id: draftId,
        draftType: 'MEASUREMENT',
        customerName: customer.name,
        customerPhone: customer.phone || "",
        customerAddress: customer.address || "",
        notes: customer.notes || "",
        rooms: customer.rooms || [],
        mediaFiles: [],
        createdBy: currentUser?.name || "Bilinmiyor",
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        syncStatus: 'DRAFT'
      };

      await localDraftDb.measurementDrafts.put(draftData);
      // Taslak yalnız cihazda korunur. Sync kuyruğuna ancak SOURCE_EXIT doğrulamasından sonra alınır.
showToast("Saha taslağı telefona kaydedildi.");
    } catch (err) {
      console.error(err);
      showToast("Taslak kaydedilemedi.");
    }
  };

  const handleTransferToSales = async () => {

    if (!customer) return;


    if (!canTransferToSale) {

      showToast(

        "Bu kullanıcı rolünün satışa aktarma yetkisi bulunmuyor."

      );

      return;

    }


    try {
      setIsSaving(true);
      const draftId = await syncOrCreateDraftSale(
        customer,
        useSalesStore.getState(),
        currentUser,
        scope
      );
      router.push(`/satis/${draftId}`);
    } catch (err) {
      console.error(err);
      showToast("Satışa aktarılırken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCustomer = async (id: string, data: Partial<Customer>) => {
    await updateCustomer(id, data);
    if (user) {
      addAuditEntry({
        entityType: 'Customer',
        entityId: id,
        field: 'all',
        previousValue: 'N/A',
        newValue: 'Updated via Admin Modal',
        changedBy: user.name,
        changedAt: new Date().toISOString(),
        reason: 'Cari kart bilgileri yetkili tarafından güncellendi.'
      });
    }
  };

  const handleArchiveCustomer = async () => {
    if (confirm("Bu cari ve cariye bağlı ölçü, satış ve finans işlemleri aktif ekranlardan kaldırılarak arşive taşınacaktır. Veriler fiziksel olarak silinmeyecek ve geri getirilebilecektir.")) {
      await store.archiveCustomer(id, currentUser);
      await syncNow();
    }
  };

  const handleRestoreArchivedCustomer = async () => {
    if (confirm("Cari ve arşivlenen bağlı kayıtlar geri getirilecek. Emin misiniz?")) {
      await store.restoreArchivedCustomer(id, currentUser);
      await syncNow();
    }
  };

  const handleMoveToTrash = async () => {
    const linkedMeasurementCount = measurementStore.measurements.filter(
      (measurement) =>
        measurement.customerId === id &&
        !measurement.isDeleted,
    ).length;

    const confirmed = confirm(
      `Bu cari, tüm odaları, açıklıkları ve bağlı ${linkedMeasurementCount} ölçü çöp kutusuna taşınacaktır.\n\n` +
        "Cari silindiğinde bağlı ölçüler yetim bırakılmayacaktır. Devam edilsin mi?",
    );

    if (!confirmed) return;

    await store.moveCustomerToTrash(id, currentUser);
    await measurementStore.loadMeasurements();
    await syncNow();
  };

  const handleRestoreFromTrash = async () => {
    if (confirm("Çöp kutusundan çıkarılacaktır. Emin misiniz?")) {
      await store.restoreCustomerFromTrash(id, currentUser);
        await syncNow();
      }
    };

    const handleConfirmMerge = async (targetId: string) => {
    await store.mergeCustomers(id, targetId);
    await useSalesStore.getState().transferSales(id, targetId);
    if (user) {
      addAuditEntry({
        entityType: 'Customer',
        entityId: id,
        field: 'status',
        previousValue: 'ACTIVE',
        newValue: `MERGED into ${targetId}`,
        changedBy: user.name,
        changedAt: new Date().toISOString(),
        reason: 'Cari Birleştirme'
      });
    }
    router.push('/cariler');
  };

  const handleConfirmMoveRoom = async (targetId: string, roomId: string) => {
    await store.moveRoom(id, targetId, roomId);
    if (user) {
      addAuditEntry({
        entityType: 'Room',
        entityId: roomId,
        field: 'customerId',
        previousValue: id,
        newValue: targetId,
        changedBy: user.name,
        changedAt: new Date().toISOString(),
        reason: 'Oda başka cariye taşındı.'
      });
    }
  };


  const renderMeasurementForm = (room: Room, window: WindowItem, isInlineEdit = false) => {
    return (
      <div key={isInlineEdit ? editingMeasurementId : "new"} className={`relative mt-3 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900 ${isInlineEdit ? "" : "ml-0 sm:ml-6"}`}>
                              <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-950/70 sm:px-4">
                                <div className="flex min-w-0 items-center gap-2">
                                  <h5 className="truncate font-bold text-blue-900 dark:text-gray-100">
                                    {editingMeasurementId ? "Saha Ölçüsü Düzenleme Formu" : "Saha Ölçü Formu"}
                                  </h5>
                                  <span
                                    className="ml-auto max-w-[72px] truncate rounded-md border border-blue-200 bg-white/80 px-2 py-0.5 text-[10px] font-black tracking-wide text-blue-700 sm:hidden dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300"
                                    title={currentUser?.name || "Bilinmiyor"}
                                  >
                                    {getMeasurementUserShortCode(currentUser?.name)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  aria-label="Ölçü formunu kapat"
                                  onClick={() =>
                                    void handleCloseMeasurementForm(
                                      room.id,
                                      window
                                    )
                                  }
                                >
                                  <X className="w-5 h-5 text-blue-400 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-200" />
                                </button>
                              </div>

                              <div className="space-y-4 p-3 sm:p-5">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ölçüm Şablonu</label>
                                    <select
                                      value={selectedTemplate}
                                      onChange={(e) => { setSelectedTemplate(e.target.value); setRawValues({}); }}
                                      className="min-h-11 w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    >
                                      {Object.values(MEASUREMENT_TEMPLATES).map(t => (
                                        <option key={t.type} value={t.type}>{getTemplateLabel(t.type)}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="hidden sm:block">
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ölçüyü Alan</label>
                                    {permissions.canOverrideMeasuredBy ? (
                                      /* ADMIN/SALES can select who measured */
                                      <select
                                        value={overrideMeasuredById}
                                        onChange={(e) => setOverrideMeasuredById(e.target.value)}
                                        className="min-h-11 w-full rounded-lg border bg-gray-50 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

                                {selectedTemplate === 'CURTAIN_DETAIL' && (
                                  <div className="mb-4">
                                    <FacadeSegmentsEditor
                                      key={activeWindowIdForProduct || 'new'}
                                      segments={rawValues.facadeSegments || []}
                                      onChange={(segments) => setRawValues({...rawValues, facadeSegments: segments})}
                                    />
                                  </div>
                                )}

                                {selectedTemplate === 'PLICELL' && (
                                  <div className="mb-4">
                                    <PlicellCamListEditor
                                      key={activeWindowIdForProduct || 'new'}
                                      camAdedi={rawValues.camAdedi}
                                      ortakCamBoyuCm={rawValues.ortakCamBoyuCm}
                                      profilRengi={rawValues.profilRengi}
                                      plicellCamListesi={rawValues.plicellCamListesi}
                                      onChange={(data) => setRawValues({...rawValues, ...data})}
                                    />
                                  </div>
                                )}

                                <div className={`grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/40 sm:p-4 ${selectedTemplate === 'CURTAIN_DETAIL' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                  {selectedTemplate === 'CURTAIN_DETAIL' && (
                                    <div className="col-span-1 sm:col-span-2 md:col-span-3 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 border-b pb-1 dark:border-gray-700">Yükseklik Bilgileri</div>
                                  )}
                                  {MEASUREMENT_TEMPLATES[selectedTemplate]?.fields.filter(f => !f.hidden && selectedTemplate !== 'PLICELL').map(f => {
                                    const isNotesField = f.key === 'notes' || f.key === 'yukseklikNotu';
                                    return (
                                      <div key={f.key} className={isNotesField ? 'col-span-1 sm:col-span-full' : ''}>
                                        <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">{f.label}</label>
                                        {f.type === 'select' ? (
                                          <select
                                            value={String(rawValues[f.key] !== undefined ? rawValues[f.key] : (f.options && f.options.length > 0 ? f.options[0] : ''))}
                                            onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                            className="min-h-11 w-full rounded border px-3 py-2.5 text-base transition-shadow outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                          >
                                            {f.options?.map(opt => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        ) : isNotesField ? (
                                          <textarea
                                            placeholder={f.label}
                                            value={String(rawValues[f.key] !== undefined ? rawValues[f.key] : (f.defaultValue !== undefined ? f.defaultValue : ''))}
                                            onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                            className="min-h-24 w-full resize-y rounded border px-3 py-2.5 text-base transition-shadow outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-600"
                                            rows={2}
                                          />
                                        ) : (
                                          <input
                                            type={f.type}
                                            step={f.type === 'number' ? 'any' : undefined}
                                            placeholder={f.label}
                                            value={String(rawValues[f.key] !== undefined ? rawValues[f.key] : (f.defaultValue !== undefined ? f.defaultValue : ''))}
                                            onChange={(e) => setRawValues({...rawValues, [f.key]: e.target.value})}
                                            className="min-h-11 w-full rounded border px-3 py-2.5 text-base transition-shadow outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-600"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div>
                                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Saha Notları (İsteğe Bağlı, Engeller vb.)</label>
                                  <textarea
                                    value={measurementNotes}
                                    placeholder="Herhangi bir engel veya not var mı?"
                                    onChange={(e) => setMeasurementNotes(e.target.value)}
                                    className="min-h-24 w-full resize-y rounded border px-3 py-2.5 text-base transition-shadow outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-600"
                                    rows={2}
                                  />
                                </div>

                                <div className="sticky bottom-2 z-10 rounded-xl border border-blue-100 bg-white/95 p-1.5 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><button onClick={() => handleSaveMeasurement(room.id, window.id)} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                                  {editingMeasurementId ? "Değişiklikleri Kaydet" : "Ölçüyü Kaydet"}
                                </button></div>
                              </div>
                            </div>
    );
  };

  return (
    <div data-cari-360-ui-v2 data-cari-360-final-polish data-cari-360-final-layout className="mx-auto max-w-[1600px] space-y-3 pb-24">
{customer.isArchived && !customer.isDeleted && (
  <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400 px-4 py-3 rounded-xl mb-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        <span className="font-bold">ARŞİVLENEN CARİ:</span> Bu kayıt sadece okuma amaçlıdır. Yeni işlem yapılamaz.
      </div>
      {(currentUser?.role === 'ADMIN') && (
        <button onClick={handleRestoreArchivedCustomer} className="px-3 py-1 bg-yellow-200 dark:bg-yellow-800 rounded font-medium hover:opacity-80 transition-opacity">
          Arşivden Geri Al
        </button>
      )}
    </div>
  </div>
)}
{customer.isDeleted && (
  <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded-xl mb-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Trash2 className="w-5 h-5" />
        <span className="font-bold">ÇÖP KUTUSUNDA:</span> Bu kayıt tamamen silinmiş durumdadır.
      </div>
      {(currentUser?.role === 'ADMIN') && (
        <button onClick={handleRestoreFromTrash} className="px-3 py-1 bg-red-200 dark:bg-red-800 rounded font-medium hover:opacity-80 transition-opacity">
          Çöp Kutusundan Çıkar
        </button>
      )}
    </div>
  </div>
)}
      {/* Header & Mode Toggle */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/cariler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-extrabold tracking-tight heading-title sm:text-3xl">{customer.name}</h1>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCariTypeColor(customer.cariType)}`}>
                {getCariTypeLabel(customer.cariType)}
              </span>
              {customer.customerCode && (
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  {customer.customerCode}
                </span>
              )}
            </div>

            {canViewCustomerContactFields(currentUser, customer) && (
              <div className="mt-2 grid max-w-3xl gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2 xl:grid-cols-[auto_1fr]">
                <div className="flex min-w-0 items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="truncate font-semibold hover:text-blue-600 hover:underline dark:hover:text-blue-300">
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">Telefon belirtilmemiş</span>
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate font-semibold text-blue-600 dark:text-blue-300">
                    {[customer.province, customer.district].filter(Boolean).join(" / ") || "İl / İlçe belirtilmemiş"}
                  </span>
                </div>

                <div className="flex min-w-0 items-start gap-2 sm:col-span-2 xl:col-span-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="line-clamp-2 font-medium leading-relaxed text-gray-500 dark:text-gray-400">{customer.address || "Adres belirtilmemiş"}</span>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 text-sm dark:border-gray-800 dark:bg-gray-950/30 sm:col-span-2 sm:grid-cols-4 xl:col-span-2">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Müşteri No</span>
                    <span className="mt-0.5 block truncate font-mono font-semibold text-gray-700 dark:text-gray-200">{customer.customerCode || "-"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Vergi No</span>
                    <span className="mt-0.5 block truncate font-mono font-semibold text-gray-700 dark:text-gray-200">{customer.taxNumber || "-"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Grup</span>
                    <span className="mt-0.5 block truncate font-semibold text-gray-700 dark:text-gray-200">{getCariTypeLabel(customer.cariType)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">İl / İlçe</span>
                    <span className="mt-0.5 block truncate font-semibold text-gray-700 dark:text-gray-200">{[customer.province, customer.district].filter(Boolean).join(" / ") || "-"}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {canViewCustomerContactFields(currentUser, customer) && customer.phone && (
                <a href={`tel:${customer.phone}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750">
                  <Phone className="h-3.5 w-3.5" />
                  Ara
                </a>
              )}
              {(() => {
                const mapsUrl = getGoogleMapsUrl(customer);
                return mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750">
                    <MapPin className="h-3.5 w-3.5" />
                    Harita
                  </a>
                ) : null;
              })()}
              <button
                type="button"
                onClick={handleUpdateLocation}
                disabled={updatingLocation}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
              >
                {updatingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                {customer.mapLocation ? "Konum Güncelle" : "Konum Al"}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Cariyi Düzenle
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 [&_button]:h-9 [&_button]:min-h-9 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-xs [&_button]:font-semibold [&_a]:h-9 [&_a]:min-h-9 [&_a]:rounded-lg [&_a]:px-3 [&_a]:text-xs [&_a]:font-semibold">
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={handleTargetRecover}
              disabled={isRecovering}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#c48a32] bg-[#a96824] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#bd7b2d] disabled:cursor-wait disabled:opacity-70"
              title="Bu Carinin Ölçülerini Yeniden Gönderime Hazırla"
            >
              {isRecovering ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Ölçü Kurtar</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#8f70c9] bg-[#7355a6] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#8262b8]"
              title="Cari bilgilerini düzenle"
            >
              <Edit className="w-4 h-4" />
              Düzenle
            </button>
          )}

          {canMerge && (
            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#6686ba] bg-[#4f6f9f] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#5c7caf]"
              title="Başka bir cari ile birleştir"
            >
              <Merge className="w-4 h-4" />
              Birleştir
            </button>
          )}

          {canArchive && !customer.isArchived && !customer.isDeleted && (
    <div className="contents">
      <button onClick={handleArchiveCustomer} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d0a440] bg-[#c59632] px-3 py-2 text-center text-sm font-bold leading-tight text-[#2f240b] shadow-sm transition-colors hover:bg-[#d2a640]">
        <Archive className="w-4 h-4" />
        Arşivle
      </button>
      <button onClick={handleMoveToTrash} className="inline-flex h-9 min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#c46773] bg-[#a94756] px-3 py-1.5 text-center text-xs font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#ba5665]">
        <Trash2 className="w-4 h-4" />
        Sil
      </button>
    </div>
  )}
          <FieldTaskAssignButton
            customer={customer}
            currentUser={currentUser}
            users={users}
            onAssigned={showToast}
          />
          <button
            onClick={handleShareWhatsAppReport}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#5aa47e] bg-[#3f805f] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#4b906d]"
            title="Müşteri ölçü raporunu WhatsApp ile paylaş"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Kısa Rapor
          </button>

          <button
            onClick={() => setIsVisualReportOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#6e96c8] bg-[#527eae] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#628dbd]"
            title="Görsel Ölçü Raporunu Görüntüle"
          >
            <FileText className="w-4 h-4" />
            Görsel Ölçü Raporu
          </button>

          {canTransferToSale && (
            <button
              onClick={handleTransferToSales}
              disabled={isSaving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#ce805d] bg-[#ad5f3d] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#bf704c] disabled:cursor-wait disabled:opacity-50"
              title="Ölçüleri yeni satış/teklif taslağına kopyala"
            >
              <ShoppingCart className="w-4 h-4" />
              Satışa Aktar
            </button>
          )}

          <button
            onClick={handleSaveAsLocalDraft}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#66778d] bg-[#4f6075] px-3 py-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#5c6d83]"
            title="Saha ölçü taslağını telefona kaydet"
          >
            <Ruler className="w-4 h-4 text-blue-400" />
            Telefona Taslak Kaydet
          </button>

          {/* MODE TOGGLE */}
          <div className="flex bg-gray-200 dark:bg-gray-800 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => setMode("MEASUREMENT")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'MEASUREMENT' ? 'bg-white dark:bg-[#435269] text-[#527eae] dark:text-[#9fc1e8] shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Sahadan Ölçü Modu
          </button>
          {permissions.canAccessOfficeMode ? (
            <button
              onClick={() => setMode("OFFICE")}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'OFFICE' ? 'bg-white dark:bg-[#594b47] text-[#ad5f3d] dark:text-[#e1a486] shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
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
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Sidebar */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:hidden">
            <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white lg:text-xs lg:uppercase lg:tracking-wide lg:text-gray-500 lg:dark:text-gray-400">{customer.name}<span className="hidden lg:inline"> · Detaylar</span></h2>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getCariTypeColor(customer.cariType)}`}>
                      {getCariTypeLabel(customer.cariType)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {canViewCustomerContactFields(currentUser, customer) && customer.phone && (
                      <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-300">
                        <Phone className="h-3.5 w-3.5" />
                        {customer.phone}
                      </a>
                    )}
                    {(customer.province || customer.district) && (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-300">
                        <MapPin className="h-3.5 w-3.5" />
                        {[customer.province, customer.district].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerCardExpanded(value => !value)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
                  aria-label={isCustomerCardExpanded ? "Müşteri kartını daralt" : "Müşteri kartını genişlet"}
                >
                  {isCustomerCardExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-2 flex items-center gap-1.5 lg:hidden">
                {canViewCustomerContactFields(currentUser, customer) && customer.phone && (
                  <a href={`tel:${customer.phone}`} title="Ara" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {(() => {
                  const mapsUrl = getGoogleMapsUrl(customer);
                  return mapsUrl ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Haritada Aç" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <MapPin className="h-4 w-4" />
                    </a>
                  ) : null;
                })()}
                {canEdit && (
                  <button type="button" onClick={() => setIsEditModalOpen(true)} title="Cariyi Düzenle" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
                    <Edit className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className={`${isCustomerCardExpanded ? "block" : "hidden"} divide-y divide-gray-100 px-4 text-sm dark:divide-gray-800 sm:px-5 lg:block`}>

              {customer.approvalStatus === 'PENDING_APPROVAL' && (
                <div className="my-4 space-y-2 rounded-xl border border-amber-250 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
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
                <div className="py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Cari Kodu</span>
                  <span className="mt-1 block break-all font-mono text-sm font-semibold text-gray-900 dark:text-white">{customer.customerCode}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && customer.taxNumber && (
                <div className="py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">TC / Vergi No</span>
                  <span className="mt-1 block font-mono text-sm font-semibold text-gray-900 dark:text-white">{customer.taxNumber}</span>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && (
                <div className="py-2.5">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Telefon</span>
                      {customer.phone ? (
                        <a href={`tel:${customer.phone}`} className="mt-0.5 inline-flex min-h-6 items-center font-semibold text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-300">
                          {customer.phone}
                        </a>
                      ) : (
                        <span className="mt-0.5 block text-gray-400">Belirtilmemiş</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && customer.phone2 && (
                <div className="py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Telefon 2</span>
                  <a href={`tel:${customer.phone2}`} className="mt-1 inline-flex min-h-8 items-center font-bold text-blue-700 hover:underline dark:text-blue-300">
                    {customer.phone2}
                  </a>
                </div>
              )}
              {canViewCustomerContactFields(currentUser, customer) && (
                <div className="py-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Adres</span>
                    {(customer.province || customer.district) && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                        {[customer.province, customer.district].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const mapsUrl = getGoogleMapsUrl(customer);
                    if (mapsUrl) {
                      return (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                           className="group flex min-h-9 items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
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
                <div className="py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Cari Konum</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${customer.mapLocation ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {customer.mapLocation ? "Kayıtlı" : "Belirtilmemiş"}
                    </span>
                  </div>
                  {customer.mapLocation && (
                    <div className="mb-2 break-all font-mono text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">{customer.mapLocation}</div>
                  )}

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

                  <div className="mt-2 flex flex-wrap gap-2">
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
                          className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-center text-[11px] font-bold transition-colors ${
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
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-2 py-1.5 text-center text-[11px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div className="py-3">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bina / Adres Fotoğrafları</span>

                  {(() => {
                    const addressPhotos = customer.addressPhotos || [];
                    if (addressPhotos.length > 0) {
                      return (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {addressPhotos.map((url, i) => (
                            <div
                              key={i}
                              className="relative group aspect-square w-full overflow-hidden rounded-lg border border-gray-250 dark:border-gray-850"
                            >
                              <Image
                                src={url}
                                fill
                                unoptimized
                                sizes="96px"
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
                      className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-250 bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Bina Fotoğrafı Ekle
                    </button>
                  )}
                </div>
              )}

              {customer.extraDescription && (
                <div className="py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ek Açıklama</span>
                  <p className="mt-1.5 rounded-lg bg-amber-50 p-2.5 font-medium leading-relaxed text-gray-800 dark:bg-amber-950/20 dark:text-gray-200">{customer.extraDescription}</p>
                </div>
              )}
              {customer.generalNote && (
                <div className="py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Genel Açıklama</span>
                  <p className="mt-1.5 break-words rounded-lg bg-gray-50 p-2.5 font-medium leading-relaxed text-gray-800 dark:bg-gray-800/60 dark:text-gray-200">{customer.generalNote}</p>
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

            {/* View Mode Toggle for Measurements */}
            {activeTab === "rooms" && customer.rooms.length > 0 && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setMeasurementViewMode(prev => prev === 'CARD' ? 'GRID' : 'CARD')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 flex items-center gap-2 shadow-sm"
                >
                  {measurementViewMode === 'CARD' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                      Toplu A4 Görünümüne Geç
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                      Kart Görünümüne Geç
                    </>
                  )}
                </button>
              </div>
            )}

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
            <button
              onClick={() => setActiveTab("financial")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "financial"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              Finans
            </button>
          </div>

          {activeTab === "rooms" && (
            <>
              {customer.rooms.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500">
                  <Layers className="w-12 h-12 text-gray-300 mb-4 mx-auto" />
                  <p>Oda bulunamadı. Lütfen yeni oda ekleyin.</p>
                </div>
              ) : null}

          {([...(customer.rooms || [])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())).map((room) => {
            const isExpanded = expandedRooms[room.id] !== false;
            const windowHasMeasurement = (
              window: WindowItem
            ) =>
              window.products.length > 0 ||
              measurementStore.measurements.some(
                measurement =>
                  measurementOpeningId(
                    measurement
                  ) === window.id &&
                  !measurement.isDeleted
              );
            const visibleWindows =
              room.windows.filter(
                window =>
                  !(
                    isLegacyEmptyDefaultWindow(
                      window
                    ) &&
                    !windowHasMeasurement(
                      window
                    )
                  )
              );
            const hasMeasuredOpening =
              visibleWindows.some(
                window =>
                  windowHasMeasurement(
                    window
                  )
              );

            return (
              <div id={`room-card-${room.id}`} key={room.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">

                {/* ROOM HEADER */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleRoom(room.id)}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2 h-6 rounded-full inline-block ${mode === 'MEASUREMENT' ? 'bg-blue-600' : 'bg-orange-500'}`}></span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            openRoomPreparation(room);
                          }}
                          className="cursor-pointer hover:underline text-blue-600 dark:text-blue-400"
                          title="Satışa Hazırlık ve Ürün Seçimi"
                        >
                          {room.name}
                        </span>
                      </h3>
                    </div>
                    <div className="flex gap-4 items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openRoomPreparation(room);
                        }}
                        className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer font-bold text-xs border border-emerald-250 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800/50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        title="Oda Ürün Seçimleri ve Satışa Hazırlık"
                      >
                        Satışa Hazırlık
                      </button>
                      {canMoveRoom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoomToMove(room);
                            setIsMoveRoomModalOpen(true);
                          }}
                          className="text-indigo-500 hover:text-indigo-700 cursor-pointer font-semibold text-xs border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800 px-2 py-1 rounded"
                          title="Odayı başka cariye taşı"
                        >
                          Taşı
                        </button>
                      )}
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
                          <Image src={url} fill unoptimized sizes="64px" alt={`Oda fotoğrafı ${i + 1}`} className="w-full h-full object-cover" />
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
                    {visibleWindows.map(window => {
                      const isPrimaryRoomOpening =
                        window.name ===
                          room.name ||
                        (
                          visibleWindows.length === 1 &&
                          window.name ===
                            "Pencere 1"
                        );
                      return (
                        <div key={window.id} className={isPrimaryRoomOpening ? "space-y-4" : "border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50 space-y-4 ml-2"}>

                          {!isPrimaryRoomOpening && (
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
                                <Image src={url} fill unoptimized sizes="48px" alt={`Açıklık fotoğrafı ${i + 1}`} className="w-full h-full object-cover" />
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
                        <div className={measurementViewMode === "GRID" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" : "space-y-3"}>
                            {measurementStore.measurements
                              .filter(m => measurementOpeningId(m) === window.id && !m.isDeleted)
                              .sort((a, b) => {
                                const timeA = new Date(a.createdAt || a.measuredDate || 0).getTime();
                                const timeB = new Date(b.createdAt || b.measuredDate || 0).getTime();
                                if (timeB !== timeA) return timeB - timeA;
                                return b.id.localeCompare(a.id);
                              })
                              .map(p => {
  if (editingMeasurementId === p.id) return renderMeasurementForm(room, window, true);


  if (measurementViewMode === 'GRID') {
    return (
      <div key={p.id} className="relative bg-[#e6f2ff] dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-700 rounded-sm p-2 flex flex-col items-center justify-center text-center shadow-inner min-h-[140px] m-2">
        <div className="absolute inset-x-0 top-0 border-b-2 border-blue-300 dark:border-blue-800 bg-white/50 dark:bg-black/20 text-[10px] font-bold py-1 text-blue-800 dark:text-blue-300">
          EN: {p.rawValues?.width || 0}
        </div>
        <div className="absolute inset-y-0 left-0 border-r-2 border-blue-300 dark:border-blue-800 bg-white/50 dark:bg-black/20 text-[10px] font-bold px-1 text-blue-800 dark:text-blue-300 flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          BOY: {p.rawValues?.height || 0}
        </div>
        <div className="mt-6 ml-6 flex flex-col items-center justify-center h-full">
           <div className="text-[10px] text-blue-700 dark:text-blue-400 font-bold mb-1 line-clamp-1 bg-white/60 dark:bg-black/40 px-1 rounded">{getTemplateLabel(p.templateType)}</div>
           {p.rawValues?.quantity && Number(p.rawValues.quantity) > 1 && <div className="text-xs bg-white/80 dark:bg-black/50 text-blue-800 dark:text-blue-300 font-bold px-1 rounded inline-block shadow-sm">{p.rawValues.quantity} Adet</div>}
           {p.notes && <div className="text-[9px] text-gray-700 dark:text-gray-300 mt-1 line-clamp-2 leading-tight bg-white/50 dark:bg-black/30 p-1 rounded">{p.notes}</div>}
           <button onClick={() => setEditingMeasurementId(p.id)} className="mt-2 text-[10px] bg-blue-500 text-white px-3 py-1 rounded shadow-sm hover:bg-blue-600 transition-colors">Düzenle</button>
        </div>
      </div>
    );
  }

                              if (editingMeasurementId === p.id) return renderMeasurementForm(room, window, true);
                            return (
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
                                          const storedCalculation = {
                                            ...(p.details || {}),
                                            ...(
                                              p.selectedProducts?.find(
                                                (selectedProduct) =>
                                                  selectedProduct?.isActive
                                              )?.calculation || {}
                                            )
                                          };

                                          const billingWidth = Number(
                                            storedCalculation.billingWidthCm ??
                                            storedCalculation.billingWidth ??
                                            0
                                          );

                                          const billingHeight = Number(
                                            storedCalculation.billingHeightCm ??
                                            storedCalculation.billingHeight ??
                                            0
                                          );

                                          return billingWidth > 0 && billingHeight > 0
                                            ? `${billingWidth} × ${billingHeight} cm`
                                            : '-';
                                        })()}
                                      </span>
                                    </div>
                                    <div className="bg-green-50/40 dark:bg-green-950/10 p-2 rounded border border-green-100/50 dark:border-green-900/20">
                                      <span className="text-[9px] text-green-600 dark:text-green-400 uppercase block font-medium">
                                        {Number(p.rawValues?.quantity || 1) > 1 ? 'Toplam m²' : 'm²'}
                                      </span>
                                      <span className="font-bold text-green-700 dark:text-green-400 text-[13px]">
                                        {(() => {
                                          const storedCalculation = {
                                            ...(p.details || {}),
                                            ...(
                                              p.selectedProducts?.find(
                                                (selectedProduct) =>
                                                  selectedProduct?.isActive
                                              )?.calculation || {}
                                            )
                                          };

                                          const totalM2 = Number(
                                            storedCalculation.totalSystemM2 ??
                                            storedCalculation.totalM2 ??
                                            0
                                          );

                                          return totalM2 > 0
                                            ? `${totalM2.toFixed(2)} m²`
                                            : '-';
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
                              ) : p.templateType === 'PLICELL' && p.rawValues?.plicellCamListesi && Array.isArray(p.rawValues.plicellCamListesi) && p.rawValues.plicellCamListesi.length > 0 ? (
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded mb-3 border border-gray-200 dark:border-gray-700">
                                  {p.rawValues.profilRengi && (
                                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                      <span className="text-gray-500 font-normal">Profil Rengi:</span> {p.rawValues.profilRengi}
                                    </div>
                                  )}
                                  {Number(p.rawValues.ortakCamBoyuCm) > 0 && (
                                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                      <span className="text-gray-500 font-normal">Ortak Cam Boyu:</span> {p.rawValues.ortakCamBoyuCm} cm
                                    </div>
                                  )}
                                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                                    <span className="text-gray-500 font-normal">Cam Adedi:</span> {p.rawValues.plicellCamListesi.filter((cam: unknown) => isRecord(cam) && Number(cam.widthCm) > 0 && Number(cam.heightCm) > 0).length}
                                  </div>
                                  <div className="space-y-1.5 border-t border-gray-200 dark:border-gray-700 pt-2">
                                    {(() => {
                                      const storedCalculation = {
                                        ...(p.details || {}),
                                        ...(
                                          p.selectedProducts?.find(
                                            (selectedProduct) =>
                                              selectedProduct?.isActive
                                          )?.calculation || {}
                                        )
                                      };

                                      const storedGroups = Array.isArray(
                                        storedCalculation.groups
                                      )
                                        ? storedCalculation.groups
                                        : Array.isArray(
                                            storedCalculation.cams
                                          )
                                          ? storedCalculation.cams
                                          : [];

                                      const totalM2 = Number(
                                        storedCalculation.totalSystemM2 ??
                                        storedCalculation.totalM2 ??
                                        storedGroups.reduce(
                                          (sum: number, group: unknown) =>
                                            sum + (isRecord(group)
                                              ? Number(
                                                  group.totalM2 ??
                                                  group.chargeableM2 ??
                                                  group.unitM2 ??
                                                  0
                                                )
                                              : 0),
                                          0
                                        )
                                      );

                                      return (
                                        <>
                                          {storedGroups.length > 0 ? (
                                            storedGroups.map(
                                              (group: unknown, i: number) => {
                                                if (!isRecord(group)) return null;
                                                const realWidth = Number(
                                                  group.realWidthCm ??
                                                  group.actualWidthCm ??
                                                  group.widthCm ??
                                                  0
                                                );

                                                const realHeight = Number(
                                                  group.realHeightCm ??
                                                  group.actualHeightCm ??
                                                  group.heightCm ??
                                                  0
                                                );

                                                const billingWidth = Number(
                                                  group.billingWidthCm ??
                                                  group.calculatedWidthCm ??
                                                  group.roundedWidth ??
                                                  0
                                                );

                                                const billingHeight = Number(
                                                  group.billingHeightCm ??
                                                  group.calculatedHeightCm ??
                                                  group.roundedHeight ??
                                                  0
                                                );

                                                const groupM2 = Number(
                                                  group.totalM2 ??
                                                  group.chargeableM2 ??
                                                  group.unitM2 ??
                                                  0
                                                );

                                                return (
                                                  <div
                                                    key={
                                                      String(group.generatedItemId || group.id || "") ||
                                                      i
                                                    }
                                                    className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between"
                                                  >
                                                    <span>
                                                      {i + 1}. Cam:{' '}
                                                      <span className="font-semibold">
                                                        {realWidth} × {realHeight} cm
                                                      </span>
                                                    </span>

                                                    <span className="text-xs text-gray-500">
                                                      {billingWidth} × {billingHeight} ={' '}
                                                      <span className="font-semibold text-green-600 dark:text-green-500">
                                                        {groupM2.toFixed(2)} m²
                                                      </span>
                                                    </span>
                                                  </div>
                                                );
                                              }
                                            )
                                          ) : (
                                            <div className="text-sm text-amber-600 dark:text-amber-400">
                                              Merkezi hesap sonucu bulunamadı.
                                            </div>
                                          )}

                                          <div className="pt-2 mt-2 border-t border-dashed border-gray-300 dark:border-gray-700 text-right text-sm font-bold text-gray-900 dark:text-white">
                                            Toplam:{' '}
                                            <span className="text-green-600 dark:text-green-500">
                                              {totalM2.toFixed(2)} m²
                                            </span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                  {(() => {
                                    const validNote = getValidNote(p.notes);
                                    if (!validNote) return null;
                                    return (
                                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase block mb-1">Saha Notu:</span>
                                        <span className="text-sm text-gray-800 dark:text-gray-200">{validNote}</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded mb-3 border border-gray-200 dark:border-gray-700">
                                  {(p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN') ? (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
                                          AÇIKLIK EN ÖLÇÜLERİ
                                        </div>
                                        {(() => {
                                          const facadeTotalWidth = (
                                            Array.isArray(p.rawValues?.facadeSegments)
                                              ? p.rawValues.facadeSegments
                                              : []
                                          ).reduce(
                                            (sum: number, segment: unknown) =>
                                              sum +
                                              (
                                                isRecord(segment)
                                                  ? Number(segment.widthCm || 0)
                                                  : 0
                                              ),
                                            0,
                                          );

                                          return facadeTotalWidth > 0 ? (
                                            <div className="mb-2 whitespace-nowrap text-xs font-black text-blue-600 dark:text-blue-300">
                                              Toplam En: {facadeTotalWidth} cm
                                            </div>
                                          ) : null;
                                        })()}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {(Array.isArray(p.rawValues?.facadeSegments) ? p.rawValues.facadeSegments : [])
                                          .filter((segment: unknown) => isRecord(segment) && Number(segment.widthCm || 0) > 0)
                                          .map((segment: unknown, segmentIndex: number) => {
                                            if (!isRecord(segment)) return null;
                                            const normalizedSegmentType = String(segment?.type || segment?.label || '').toUpperCase();
                                            const segmentShortLabel =
                                              normalizedSegmentType === 'WALL' || normalizedSegmentType === 'DUVAR'
                                                ? 'D'
                                                : normalizedSegmentType.includes('CAM')
                                                  ? 'C'
                                                  : normalizedSegmentType.includes('PENCERE')
                                                    ? 'P'
                                                    : normalizedSegmentType.includes('KAPI')
                                                      ? 'K'
                                                      : String(segment?.label || normalizedSegmentType || '?').charAt(0).toUpperCase();

                                            return (
                                              <div key={String(segment.id || "") || segmentIndex} className="flex items-center gap-2">
                                                {segmentIndex > 0 && <span className="font-bold text-gray-400 dark:text-gray-600">+</span>}
                                                <div className="min-w-[76px] rounded-lg border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-gray-950 px-3 py-2 text-center">
                                                  <div className="text-lg font-black leading-none text-gray-900 dark:text-white">
                                                    {Number(segment.widthCm)}
                                                  </div>
                                                  <div className="mt-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    {segmentShortLabel}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                      </div>
                                      {(() => {
                                        const validNote = getValidNote(p.notes);
                                        if (!validNote) return null;
                                        return (
                                          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Saha Notu:</span>
                                            <span className="text-sm text-gray-800 dark:text-gray-200 block">{validNote}</span>
                                          </div>
                                        );
                                      })()}
                                    </>
                                  ) : (
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                      {Object.entries(p.rawValues || {})
                                        .filter(([key]) => {
                                          if (key === 'facadeSegments' || key === 'totalFacadeWidthCm') return false;
                                          if (p.templateType === 'PLICELL' && (key === 'plicellCamListesi' || key === 'camAdedi' || key === 'ortakCamBoyuCm' || key === 'profilRengi')) return false;
                                          const template = MEASUREMENT_TEMPLATES[p.templateType] || (p.templateType === 'CURTAIN' ? MEASUREMENT_TEMPLATES['CURTAIN_DETAIL'] : undefined);
                                          const fieldDef = template?.fields.find(f => f.key === key);
                                          return !fieldDef?.hidden;
                                        })
                                        .map(([key, val]) => {
                                          const template = MEASUREMENT_TEMPLATES[p.templateType] || (p.templateType === 'CURTAIN' ? MEASUREMENT_TEMPLATES['CURTAIN_DETAIL'] : undefined);
                                          const label = template?.fields.find(f => f.key === key)?.label || key;

                                          if (p.templateType === 'PLICELL' && (key === 'glassWidth' || key === 'glassHeight') && Number(val) === 0) return null;

                                          return (
                                            <div key={key} className="flex flex-col">
                                              <span className="text-[10px] text-gray-500 uppercase">{label}</span>
                                              <span className="font-semibold text-gray-900 dark:text-white text-sm">{String(val)}</span>
                                            </div>
                                          );
                                        })}
                                      {(() => {
                                        const validNote = getValidNote(p.notes);
                                        if (!validNote) return null;
                                        return (
                                          <div className="col-span-full mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">Saha Notu:</span>
                                            <span className="text-sm text-gray-800 dark:text-gray-200 block">{validNote}</span>
                                          </div>
                                        );
                                      })()}
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
                                      <Image src={url} fill unoptimized sizes="48px" alt={`Ölçü fotoğrafı ${i + 1}`} className="w-full h-full object-cover" />
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
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {p.templateType === 'PLICELL'
                                      ? `Plicell Özeti: ${getMeasurementDimensions(p).summaryLabel}`
                                      : `Üretim Ölçüsü: ${p.calculatedWidth}x${p.calculatedHeight}`}
                                  </div>
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
                          );
                          })}
                        </div>

                        {/* MEASUREMENT MODE: Add new Raw Measurement */}
                        {mode === 'MEASUREMENT' && (
                          activeWindowIdForProduct === window.id ? (
                              renderMeasurementForm(room, window, false)
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

                    {/* First room measurement / additional opening area */}
                    {mode === 'MEASUREMENT' &&
                    !hasMeasuredOpening &&
                    visibleWindows.length === 0 ? (
                      <div className="ml-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleStartRoomMeasurement(
                              room
                            )
                          }
                          disabled={isSaving}
                          className="w-full py-3 border-2 border-dashed rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:cursor-wait disabled:opacity-50"
                        >
                          <Ruler className="w-5 h-5" />
                          Bu Odanın Ölçüsünü Al
                        </button>
                      </div>
                    ) : activeRoomIdForWindow === room.id ? (
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
                          Bu Odaya Farklı Açıklık Ekle
                        </button>
                      </div>
                    )}

                    {['ADMIN', 'MODERATOR'].includes(normRole) && (
                      <div className="mt-4 border-t border-gray-200 dark:border-gray-700/50 pt-2">

                        {/* ALT SIRAYA YENİ ODA EKLE */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex justify-center">
                          {isAddingRoom ? (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm space-y-3 w-full max-w-md">
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
                                    if (e.key === 'Enter') handleSaveRoom();
                                    else if (e.key === 'Escape') { setIsAddingRoom(false); setNewRoomName(""); }
                                  }}
                                />
                              </div>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { setIsAddingRoom(false); setNewRoomName(""); }} className="flex-1 px-3 py-2 border border-gray-250 dark:border-gray-750 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer">İptal</button>
                                <button type="button" onClick={handleSaveRoom} disabled={!newRoomName.trim()} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:bg-blue-600/50 disabled:cursor-not-allowed">Kaydet</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setIsAddingRoom(true)}
                              className="text-sm font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1.5 transition-colors"
                            >
                              <Plus className="w-4 h-4" /> Alt Sıraya Yeni Oda Ekle
                            </button>
                          )}
                        </div>


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

          {activeTab === "financial" && (
            <>
                <CustomerFinancePanel customerId={customer.id} currency="TRY" />
                <CounterpartyPayablePanel customerId={customer.id} />
              </>
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
        {isPrepModalOpen && selectedRoomForPrep && (
          <RoomPreparationModal
            isOpen={isPrepModalOpen}
            onClose={() => {
              setIsPrepModalOpen(false);
              setSelectedRoomForPrep(null);
            }}
            room={selectedRoomForPrep}
            customerId={customer.id}
            measurements={measurementStore.measurements}
            onSave={async (updatedMeas, transferToSale) => {
              for (const m of updatedMeas) {
                await measurementStore.updateMeasurement(m, currentUser?.name || 'Sistem');
              }
              showToast("Ürün seçimleri başarıyla kaydedildi.");

              const returnSaleId =
                searchParams.get("returnSaleId")?.trim();

              if (returnSaleId) {
                try {
                  await syncOrCreateDraftSale(
                    customer,
                    useSalesStore.getState(),
                    currentUser,
                    scope,
                    returnSaleId
                  );
                  router.push(`/satis/${returnSaleId}`);
                  return;
                } catch (err) {
                  console.error(err);
                  showToast("Satış güncellenirken hata oluştu.");
                  return;
                }
              }

              if (transferToSale) {
                try {
                  const draftId = await syncOrCreateDraftSale(
                    customer,
                    useSalesStore.getState(),
                    currentUser,
                    scope
                  );
                  showToast("Satış taslağı oluşturuldu / güncellendi.");
                  router.push(`/satis/${draftId}`);
                } catch (err) {
                  console.error(err);
                  showToast("Satış taslağı oluşturulurken hata.");
                }
              }
            }}
          />
        )}

        {isEditModalOpen && (
          <CariEditModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            customer={customer}
            onSave={handleSaveCustomer}
          />
        )}

        {isMergeModalOpen && (
          <MergeCustomerModal
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            sourceCustomer={customer}
            onConfirm={handleConfirmMerge}
          />
        )}

        {isMoveRoomModalOpen && (
          <MoveRoomModal
            isOpen={isMoveRoomModalOpen}
            onClose={() => {
              setIsMoveRoomModalOpen(false);
              setRoomToMove(null);
            }}
            sourceCustomer={customer}
            roomToMove={roomToMove}
            onConfirm={handleConfirmMoveRoom}
          />
        )}
      </div>
    </div>
  );
}
