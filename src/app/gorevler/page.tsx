"use client";

import { useRouter } from "next/navigation";
import {
  Archive,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  RotateCcw,
  Ruler,
  Search,
  Trash2,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  deleteLocalFieldTask,
  listAllFieldTasks,
  listArchivedFieldTasks,
  listFieldTasksForUser,
  markFieldTaskSeen,
  putFieldTask,
  type FieldTask,
  type FieldTaskStatus,
  updateFieldTaskStatus,
  upsertRemoteFieldTasks
} from "@/lib/localFieldTaskDb";
import {
  deleteRemoteFieldTaskLifecycle,
  fetchRemoteFieldTasks,
  updateRemoteFieldTask,
  updateRemoteFieldTaskLifecycle,
  type FieldTaskLifecycleAction
} from "@/lib/fieldTaskSyncClient";
import { normalizeRole, useAuthStore } from "@/store/useAuthStore";
import { ensureFieldTaskCustomer } from "@/lib/fieldTaskCustomerBridge";
import { pushDeltaSyncEvents } from "@/lib/deltaSyncClient";
import { useMeasurementStore } from "@/store/measurementStore";
import { saveLocalMeasurementWithSync } from "@/lib/localMeasurementDb";
import {
  filterFieldTasksByView,
  isArchivedFieldTask,
  type FieldTaskViewMode
} from "@/lib/fieldTaskViewPolicy";

const STATUS_LABELS: Record<FieldTaskStatus, string> = {
  ASSIGNED: "Atandı",
  ON_THE_WAY: "Yolda",
  MEASUREMENT_STARTED: "Ölçü Başladı",
  MEASUREMENT_TAKEN: "Ölçü Alındı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal"
};

const STATUS_STYLES: Record<FieldTaskStatus, string> = {
  ASSIGNED: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  ON_THE_WAY: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  MEASUREMENT_STARTED: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  MEASUREMENT_TAKEN: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  CANCELLED: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
};

interface FieldTaskSnapshotOpening { id?: string; name?: string }
interface FieldTaskSnapshotRoom {
  id?: string;
  name?: string;
  windows?: FieldTaskSnapshotOpening[];
  openings?: FieldTaskSnapshotOpening[];
}
interface FieldTaskSnapshot {
  customer?: { rooms?: FieldTaskSnapshotRoom[] };
  rooms?: FieldTaskSnapshotRoom[];
}

type ConfirmAction = FieldTaskLifecycleAction | "DELETE";
interface PendingLifecycle { task: FieldTask; action: ConfirmAction }

function formatDate(value?: string): string {
  if (!value) return "Tarih belirtilmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusIcon(status: FieldTaskStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "CANCELLED") return <XCircle className="h-3.5 w-3.5" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />;
}

function StatusChip({ status }: { status: FieldTaskStatus }) {
  return (
    <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-[5px] border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {statusIcon(status)} {STATUS_LABELS[status]}
    </span>
  );
}

function LifecycleDialog({
  pending,
  busy,
  error,
  onClose,
  onConfirm
}: {
  pending: PendingLifecycle;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const needsReason = pending.action === "CANCEL" || pending.action === "DELETE";
  const isDelete = pending.action === "DELETE";
  const labels: Record<ConfirmAction, string> = {
    CANCEL: "Görevi İptal Et",
    ARCHIVE: "Görevi Arşivle",
    RESTORE: "Görevi Geri Yükle",
    DELETE: "Kalıcı Olarak Sil"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[1px] sm:items-center sm:p-6" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="lifecycle-title" className="flex max-h-[92vh] w-full flex-col rounded-t-[8px] border border-slate-300 bg-white shadow-2xl sm:max-w-lg sm:rounded-[8px] dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-widest ${isDelete ? "text-red-600 dark:text-red-400" : "text-blue-700 dark:text-blue-300"}`}>Yönetici işlemi</p>
            <h2 id="lifecycle-title" className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{labels[pending.action]}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Kapat" className="grid min-h-11 min-w-11 place-items-center rounded-[5px] text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <div className="border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-slate-950 dark:text-white">{pending.task.customerName}</p><p className="mt-1 text-xs text-slate-500">Görev #{pending.task.id.slice(-8).toUpperCase()}</p></div>
              <StatusChip status={pending.task.status} />
            </div>
          </div>
          {isDelete ? <p className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">Bu işlem geri alınamaz. Uzak kayıt ve tombstone sözleşmesi tamamlanmadan yerel kayıt silinmez.</p> : null}
          {needsReason ? (
            <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              {isDelete ? "Kalıcı silme nedeni" : "İptal nedeni"} <span className="text-red-600">*</span>
              <textarea value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={4} maxLength={1000} className="mt-2 w-full resize-none rounded-[5px] border border-slate-300 bg-white p-3 text-sm font-normal outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-600 dark:bg-slate-950" placeholder="Denetim kaydı için açıklama girin..." />
            </label>
          ) : null}
          {error ? <p role="alert" className="mt-3 border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
        </div>
        <footer className="flex gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:justify-end dark:border-slate-700 dark:bg-slate-950/40">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-[5px] border border-slate-300 px-4 text-sm font-bold sm:flex-none dark:border-slate-600">Vazgeç</button>
          <button type="button" onClick={() => onConfirm(reason.trim())} disabled={busy || (needsReason && !reason.trim())} className={`min-h-11 flex-1 rounded-[5px] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none ${isDelete ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>{busy ? "İşleniyor..." : labels[pending.action]}</button>
        </footer>
      </section>
    </div>
  );
}

export default function FieldTasksPage() {
  const router = useRouter();
  const currentUser = useAuthStore(state => state.currentUser);
  const sessionToken = useAuthStore(state => state.sessionToken);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<FieldTaskViewMode>("ACTIVE");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FieldTaskStatus | "ALL">("ALL");
  const [showClosed, setShowClosed] = useState(true);
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingLifecycle | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const loadRequestId = useRef(0);

  const role = currentUser ? normalizeRole(currentUser.role) : null;
  const isAdminView = role === "ADMIN" || role === "MODERATOR" || role === "OFFICE";
  const canManageLifecycle = role === "ADMIN";

  const loadTasks = useCallback(async (
    forceRefresh = false,
    syncRemote = true,
  ) => {
    const requestId = ++loadRequestId.current;
    const requestedView = viewMode;

    if (!currentUser) {
      if (requestId === loadRequestId.current) {
        setTasks([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    if (forceRefresh) setRefreshing(true);
    if (
      syncRemote &&
      sessionToken &&
      requestedView === "ACTIVE"
    ) {
      try {
        const remote = await fetchRemoteFieldTasks(sessionToken);
        await upsertRemoteFieldTasks(remote.tasks);
      } catch (error) {
        console.warn("[Field Tasks Page] Remote load skipped:", error instanceof Error ? error.message : "Unknown error");
      }
    }

    const rows = requestedView === "ARCHIVE"
      ? await listArchivedFieldTasks()
      : isAdminView
        ? await listAllFieldTasks()
        : await listFieldTasksForUser(currentUser.id);

    if (requestId !== loadRequestId.current) return;

    setTasks(filterFieldTasksByView(rows, requestedView));
    setLoading(false);
    setRefreshing(false);
  }, [currentUser, isAdminView, sessionToken, viewMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTasks(), 0);
    const handleUpdate = () => void loadTasks(false, false);
    window.addEventListener("field-tasks-updated", handleUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("field-tasks-updated", handleUpdate);
      loadRequestId.current += 1;
    };
  }, [loadTasks]);

  const viewTasks = useMemo(
    () => filterFieldTasksByView(tasks, viewMode),
    [tasks, viewMode],
  );

  const counts = useMemo(() => ({
    active: viewTasks.filter(task => !["COMPLETED", "CANCELLED"].includes(task.status)).length,
    way: viewTasks.filter(task => task.status === "ON_THE_WAY").length,
    measuring: viewTasks.filter(task => task.status === "MEASUREMENT_STARTED" || task.status === "MEASUREMENT_TAKEN").length,
    completed: viewTasks.filter(task => task.status === "COMPLETED").length,
    cancelled: viewTasks.filter(task => task.status === "CANCELLED").length,
    archive: viewTasks.filter(isArchivedFieldTask).length
  }), [viewTasks]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    return viewTasks.filter(task => {
      if (!showClosed && (task.status === "COMPLETED" || task.status === "CANCELLED")) return false;
      if (statusFilter !== "ALL" && task.status !== statusFilter) return false;
      if (!needle) return true;
      return [task.customerName, task.assignedUserName, task.customerPhone, task.customerAddress, task.mapLocation, task.note, STATUS_LABELS[task.status]].some(value => value?.toLocaleLowerCase("tr-TR").includes(needle));
    });
  }, [query, showClosed, statusFilter, viewTasks]);

  const handleOpenCustomer = async (task: FieldTask) => {
    try {
      await markFieldTaskSeen(task.id);
      if (!sessionToken) throw new Error("Oturum anahtarı bulunamadı.");
      await ensureFieldTaskCustomer(task, sessionToken);
      router.push(`/cariler/${task.customerId}?fieldTaskId=${task.id}&mode=measurement`);
    } catch (error) {
      console.error("[Field Tasks] Customer preparation failed:", error);
      alert(error instanceof Error ? `Görev carisi hazırlanamadı: ${error.message}` : "Görev carisi saha cihazında hazırlanamadı.");
    }
  };

  const handleStatus = async (task: FieldTask, status: FieldTaskStatus) => {
    await updateFieldTaskStatus(task.id, status);
    await markFieldTaskSeen(task.id);
    if (sessionToken) {
      try { await putFieldTask(await updateRemoteFieldTask(task.id, status, sessionToken, true)); }
      catch (error) {
        console.warn("[Field Tasks Page] Remote status update failed:", error instanceof Error ? error.message : "Unknown error");
        alert("Durum telefona kaydedildi fakat sunucuya henüz gönderilemedi.");
      }
    }
    await loadTasks();
  };

  const handleSendMeasurement = async (task: FieldTask) => {
    try {
      const taskMeasurements = useMeasurementStore.getState().measurements.filter(measurement => measurement.customerId === task.customerId && !measurement.isDeleted && !measurement.isArchived);
      if (taskMeasurements.length === 0) { alert("Bu görev için kayıtlı ölçü bulunamadı. Önce ölçüyü kaydedin."); return; }
      for (const measurement of taskMeasurements) {
        const taskSnapshot = task.customerSnapshot as FieldTaskSnapshot;
        const snapshotCustomer = taskSnapshot?.customer || taskSnapshot;
        const snapshotRooms = Array.isArray(snapshotCustomer?.rooms) ? snapshotCustomer.rooms : [];
        const snapshotRoom = snapshotRooms.find(candidate => candidate?.id === measurement.roomId);
        const snapshotOpenings = Array.isArray(snapshotRoom?.windows) ? snapshotRoom.windows : Array.isArray(snapshotRoom?.openings) ? snapshotRoom.openings : [];
        const openingId = measurement.openingId || measurement.windowId || "";
        const snapshotOpening = snapshotOpenings.find(candidate => candidate?.id === openingId);
        const roomName = snapshotRoom?.name || measurement.roomName || measurement.roomLabel || "İsimsiz Oda";
        const openingName = snapshotOpening?.name || measurement.openingName || measurement.windowName || measurement.openingLabel || "İsimsiz Açıklık";
        await saveLocalMeasurementWithSync({ ...measurement, customerId: task.customerId, openingId, windowId: measurement.windowId || measurement.openingId || "", roomName, roomLabel: roomName, openingName, openingLabel: openingName, windowName: openingName, updatedAt: new Date().toISOString() }, currentUser?.name || currentUser?.username || "FIELD");
      }
      const result = await pushDeltaSyncEvents();
      if (!result.success) { alert(`Gönderme başarısız: ${result.errors?.length ? result.errors.join(", ") : "Ölçüler sunucuya gönderilemedi."}`); return; }
      await handleStatus(task, "MEASUREMENT_TAKEN");
      alert(result.pushedCount > 0 ? `${result.pushedCount} kayıt mağazaya gönderildi.` : "Ölçü daha önce gönderilmiş. Görev güncellendi.");
    } catch (error) {
      console.error("[Field Task] Measurement send failed:", error);
      alert(error instanceof Error ? `Ölçü gönderilemedi: ${error.message}` : "Ölçü gönderilemedi.");
    }
  };

  const handleStartMeasurement = async (task: FieldTask) => {
    await handleStatus(task, "MEASUREMENT_STARTED");
    if (!sessionToken) throw new Error("Oturum anahtarı bulunamadı.");
    await ensureFieldTaskCustomer(task, sessionToken);
    router.push(`/cariler/${task.customerId}?fieldTaskId=${task.id}&mode=measurement`);
  };

  const runLifecycle = async (reason: string) => {
    if (!pendingLifecycle || !sessionToken || !canManageLifecycle || lifecycleBusy) return;
    setLifecycleBusy(true); setLifecycleError("");
    try {
      if (pendingLifecycle.action === "DELETE") {
        await deleteRemoteFieldTaskLifecycle(pendingLifecycle.task.id, sessionToken, reason);
        await deleteLocalFieldTask(pendingLifecycle.task.id);
      } else {
        const result = await updateRemoteFieldTaskLifecycle(pendingLifecycle.task.id, pendingLifecycle.action, sessionToken, reason || undefined);
        await putFieldTask(result.task);
      }
      setPendingLifecycle(null);
      await loadTasks();
    } catch (error) {
      setLifecycleError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally { setLifecycleBusy(false); }
  };

  if (!currentUser) return <div className="border border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">Oturum bulunamadı.</div>;

  const kpis = viewMode === "ARCHIVE"
    ? [{ label: "Arşiv", value: counts.archive, tone: "text-blue-700 dark:text-blue-300" }, { label: "Tamamlandı", value: counts.completed, tone: "text-emerald-700 dark:text-emerald-300" }, { label: "İptal", value: counts.cancelled, tone: "text-red-700 dark:text-red-300" }]
    : [{ label: "Aktif", value: counts.active, tone: "text-slate-950 dark:text-white" }, { label: "Yolda", value: counts.way, tone: "text-amber-700 dark:text-amber-300" }, { label: "Ölçü Sürecinde", value: counts.measuring, tone: "text-blue-700 dark:text-blue-300" }, { label: "Tamamlandı", value: counts.completed, tone: "text-emerald-700 dark:text-emerald-300" }, { label: "İptal", value: counts.cancelled, tone: "text-red-700 dark:text-red-300" }];

  return (
    <main className="mx-auto max-w-[1480px] pb-24 text-slate-900 dark:text-slate-100">
      <header className="flex min-h-12 flex-col justify-between gap-3 border-b border-slate-300 pb-4 sm:flex-row sm:items-end dark:border-slate-700">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Operasyon çalışma alanı</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{isAdminView ? "Saha Görevleri" : "Görevlerim"}</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Atama, saha ilerlemesi ve ölçü akışını tek ekrandan yönetin.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadTasks(true)} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Yenile</button>
          <button type="button" onClick={async () => { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-bold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"><BellRing className="h-4 w-4" /><span className="hidden sm:inline">Bildirimler</span></button>
        </div>
      </header>

      <section aria-label="Görev özeti" className={`mt-4 grid overflow-hidden rounded-[7px] border border-slate-300 bg-white ${kpis.length === 5 ? "grid-cols-2 lg:grid-cols-5" : "grid-cols-3"} dark:border-slate-700 dark:bg-slate-900`}>
        {kpis.map((kpi, index) => <div key={kpi.label} className={`px-4 py-3 ${index ? "border-l border-slate-200 dark:border-slate-700" : ""}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</p></div>)}
      </section>

      <section aria-label="Görev arama ve filtreleri" className="sticky top-0 z-20 mt-4 grid gap-2 rounded-[7px] border border-slate-300 bg-slate-50/95 p-3 shadow-sm backdrop-blur sm:grid-cols-[minmax(240px,1fr)_190px_auto] dark:border-slate-700 dark:bg-slate-950/95">
        <label className="relative"><span className="sr-only">Görevlerde ara</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari, personel, telefon, adres veya not ara..." className="min-h-11 w-full rounded-[5px] border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-600 dark:bg-slate-900" /></label>
        <select aria-label="Durum filtresi" value={statusFilter} onChange={event => setStatusFilter(event.target.value as FieldTaskStatus | "ALL")} className="min-h-11 rounded-[5px] border border-slate-300 bg-white px-3 text-sm font-semibold dark:border-slate-600 dark:bg-slate-900"><option value="ALL">Tüm durumlar</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {canManageLifecycle ? <div className="grid grid-cols-2 rounded-[5px] border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900"><button type="button" onClick={() => setViewMode("ACTIVE")} aria-pressed={viewMode === "ACTIVE"} className={`min-h-9 rounded-[4px] px-3 text-xs font-bold ${viewMode === "ACTIVE" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Aktif</button><button type="button" onClick={() => setViewMode("ARCHIVE")} aria-pressed={viewMode === "ARCHIVE"} className={`min-h-9 rounded-[4px] px-3 text-xs font-bold ${viewMode === "ARCHIVE" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Arşiv</button></div> : <label className="flex min-h-11 items-center gap-2 px-2 text-sm font-semibold"><input type="checkbox" checked={showClosed} onChange={event => setShowClosed(event.target.checked)} /> Kapalıları göster</label>}
      </section>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{filteredTasks.length} görev gösteriliyor</span>{isAdminView ? <label className="flex items-center gap-2"><input type="checkbox" checked={showClosed} onChange={event => setShowClosed(event.target.checked)} /> Tamamlanan ve iptal edilenleri göster</label> : null}</div>

      {loading ? (
        <section aria-label="Görevler yükleniyor" className="mt-4 grid gap-3 lg:grid-cols-2">{[1, 2, 3, 4].map(item => <div key={item} className="h-64 animate-pulse rounded-[7px] border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="h-5 w-28 bg-slate-200 dark:bg-slate-700" /><div className="mt-5 h-7 w-2/3 bg-slate-200 dark:bg-slate-700" /><div className="mt-6 h-24 bg-slate-100 dark:bg-slate-800" /></div>)}</section>
      ) : filteredTasks.length === 0 ? (
        <section className="mt-4 border border-dashed border-slate-400 bg-white px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900"><Archive className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 text-lg font-bold">{viewMode === "ARCHIVE" ? "Arşivde görev yok" : "Eşleşen görev bulunamadı"}</h2><p className="mt-1 text-sm text-slate-500">Arama veya filtreleri değiştirerek yeniden deneyin.</p></section>
      ) : (
        <section aria-label={viewMode === "ARCHIVE" ? "Arşivlenmiş görevler" : "Aktif görevler"} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredTasks.map(task => (
            <article key={task.id} className="group flex flex-col rounded-[7px] border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-400 hover:shadow-[0_2px_5px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusChip status={task.status} /><span className="font-mono text-[10px] font-semibold text-slate-500">#{task.id.slice(-8).toUpperCase()}</span></div><h2 className="mt-3 truncate text-lg font-bold text-slate-950 dark:text-white">{task.customerName}</h2></div><ChevronRight className="mt-1 h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5" /></div>
              <div className="grid flex-1 gap-3 px-4 py-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-2.5 text-sm"><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><span>{task.customerAddress || task.mapLocation || "Adres bilgisi yok"}</span></p>{task.customerPhone ? <a href={`tel:${task.customerPhone}`} className="flex min-h-7 items-center gap-2 font-semibold text-blue-700 hover:underline dark:text-blue-300"><Phone className="h-4 w-4" />{task.customerPhone}</a> : null}{task.note ? <p className="border-l-2 border-slate-300 pl-3 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:text-slate-300">{task.note}</p> : null}</div>
                <dl className="grid grid-cols-2 gap-2 border border-slate-200 bg-slate-50 p-2 sm:grid-cols-1 dark:border-slate-700 dark:bg-slate-950/50"><div><dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> Termin</dt><dd className="mt-1 text-xs font-semibold">{formatDate(task.scheduledAt)}</dd></div><div><dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500"><UserRound className="h-3.5 w-3.5" /> Atanan</dt><dd className="mt-1 truncate text-xs font-semibold">{task.assignedUserName || "Atanmadı"}</dd></div></dl>
              </div>
              <footer className="border-t border-slate-200 p-3 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {viewMode === "ACTIVE" ? <button type="button" onClick={() => void handleOpenCustomer(task)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[5px] bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700"><Ruler className="h-4 w-4" /> Cariyi Aç</button> : null}
                  {task.mapLocation && viewMode === "ACTIVE" ? <a href={task.mapLocation} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-slate-300 px-3 text-sm font-bold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"><Navigation className="h-4 w-4" /> Yol Tarifi</a> : null}
                  {!isAdminView && task.status === "ASSIGNED" ? <button type="button" onClick={() => void handleStatus(task, "ON_THE_WAY")} className="min-h-11 rounded-[5px] bg-amber-500 px-3 text-sm font-bold text-white hover:bg-amber-600">Yola Çıktım</button> : null}
                  {!isAdminView && (task.status === "ASSIGNED" || task.status === "ON_THE_WAY") ? <button type="button" onClick={() => void handleStartMeasurement(task)} className="min-h-11 rounded-[5px] bg-blue-700 px-3 text-sm font-bold text-white hover:bg-blue-800">Ölçüye Başla</button> : null}
                  {!isAdminView && task.status === "MEASUREMENT_STARTED" ? <button type="button" onClick={() => void handleSendMeasurement(task)} className="min-h-11 rounded-[5px] bg-violet-600 px-3 text-sm font-bold text-white hover:bg-violet-700">Ölçü Alındı</button> : null}
                  {!isAdminView && task.status === "MEASUREMENT_TAKEN" ? <button type="button" onClick={() => void handleStatus(task, "COMPLETED")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Tamamla</button> : null}
                  {canManageLifecycle && viewMode === "ACTIVE" && task.status !== "COMPLETED" && task.status !== "CANCELLED" ? <button type="button" onClick={() => { setLifecycleError(""); setPendingLifecycle({ task, action: "CANCEL" }); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-red-300 px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"><XCircle className="h-4 w-4" /> İptal</button> : null}
                  {canManageLifecycle && viewMode === "ACTIVE" && (task.status === "COMPLETED" || task.status === "CANCELLED") ? <button type="button" onClick={() => { setLifecycleError(""); setPendingLifecycle({ task, action: "ARCHIVE" }); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-slate-300 px-3 text-sm font-bold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"><Archive className="h-4 w-4" /> Arşivle</button> : null}
                  {canManageLifecycle && viewMode === "ARCHIVE" && isArchivedFieldTask(task) ? <><button type="button" onClick={() => { setLifecycleError(""); setPendingLifecycle({ task, action: "RESTORE" }); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[5px] bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700"><RotateCcw className="h-4 w-4" /> Geri Yükle</button><button type="button" onClick={() => { setLifecycleError(""); setPendingLifecycle({ task, action: "DELETE" }); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-red-400 px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /> Kalıcı Sil</button></> : null}
                </div>
              </footer>
            </article>
          ))}
        </section>
      )}
      {pendingLifecycle ? <LifecycleDialog key={`${pendingLifecycle.task.id}:${pendingLifecycle.action}`} pending={pendingLifecycle} busy={lifecycleBusy} error={lifecycleError} onClose={() => { if (!lifecycleBusy) setPendingLifecycle(null); }} onConfirm={reason => void runLifecycle(reason)} /> : null}
    </main>
  );
}
