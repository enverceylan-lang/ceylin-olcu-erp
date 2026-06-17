"use client";

import { Download, Settings, Upload, ShieldCheck, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";

const DATA_KEYS = ["curtain-erp-storage-v3", "curtain-erp-auth-v1"];

type BackupPayload = {
  version: "olcu-erp-v1";
  exportedAt: string;
  data: Record<string, string | null>;
};

export default function AyarlarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const exportBackup = () => {
    const payload: BackupPayload = {
      version: "olcu-erp-v1",
      exportedAt: new Date().toISOString(),
      data: Object.fromEntries(DATA_KEYS.map((key) => [key, localStorage.getItem(key)])),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `olcu-erp-v1-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Yedek dosyası indirildi.");
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupPayload;
      if (parsed.version !== "olcu-erp-v1" || !parsed.data) throw new Error("Geçersiz yedek dosyası.");

      const approved = window.confirm("Mevcut cihaz verileri yedekteki verilerle değiştirilecek. Devam edilsin mi?");
      if (!approved) return;

      DATA_KEYS.forEach((key) => {
        const value = parsed.data[key];
        if (typeof value === "string") localStorage.setItem(key, value);
      });
      setMessage("Yedek geri yüklendi. Sayfa yenileniyor…");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Yedek geri yüklenemedi.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ayarlar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ölçü ERP V1.0 saha pilotu için cihaz verisi ve güvenlik araçları.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p><strong>Pilot uyarısı:</strong> Veriler şimdilik bu cihazın tarayıcısında saklanır. Tarayıcı verilerini temizlemeden önce mutlaka yedek alın.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
          <Settings className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Cihaz Yedeği</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cari, oda, açıklık, ölçü ve demo kullanıcı verilerini JSON dosyası olarak koruyun.</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <button onClick={exportBackup} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">
            <Download className="h-4 w-4" /> Yedek İndir
          </button>
          <button onClick={() => inputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
            <Upload className="h-4 w-4" /> Yedekten Geri Yükle
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
            event.currentTarget.value = "";
          }} />
        </div>
        {message && <p className="border-t border-gray-200 px-5 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">{message}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Saha Kullanım Kuralı</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Her iş günü sonunda yedek alın. Aynı kayıtları farklı cihazlarda paralel düzenlemeyin; merkezi senkronizasyon sonraki sürümde devreye alınacak.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
