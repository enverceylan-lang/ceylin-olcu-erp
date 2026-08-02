"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Menu, Bell, Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useAuthStore, ROLE_PERMISSIONS, normalizeUser } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";
import { useStore } from "@/store/useStore";
import { pushDeltaSyncEvents } from "@/lib/deltaSyncClient";
import { CLOUD_SYNC_DISABLED } from "@/lib/syncService";
import { ErpScopeSelector } from "@/components/ErpScopeSelector";
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const ROLE_BADGE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  OFFICE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  SALES: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  FIELD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  MEASUREMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  TAILOR: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  PRODUCTION: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  INSTALLER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  INSTALLATION: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { currentUser: rawCurrentUser } = useAuthStore();
  const { toggleMobileMenu } = useUiStore();
  const syncStatus = useStore((state) => state.syncStatus);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [isPushing, setIsPushing] = useState(false);


  if (!rawCurrentUser) return null;

  const handleManualPush = async () => {
    setIsPushing(true);
    try {
      const result = await pushDeltaSyncEvents();
      
      const debugText = `
pendingCount: ${result.debug.pendingCount}
apiStatus: ${result.debug.apiStatus}
syncedCount: ${result.debug.syncedCount}
errorCount: ${result.debug.errorCount}
firstStatus: ${result.debug.firstStatus}
      `.trim();

      const isDev = process.env.NODE_ENV === 'development';

      if (result.success) {
        if (result.pushedCount > 0) {
          alert(`Ölçüler gönderildi. ${result.pushedCount} kayıt aktarıldı.` + (isDev ? `\n\nDEBUG:\n${debugText}` : ''));
        } else {
          alert(`Gönderilecek yeni ölçü yok.` + (isDev ? `\n\nDEBUG:\n${debugText}` : ''));
        }
      } else {
        alert(`Ölçüler gönderilemedi. İnternet bağlantısını kontrol edip tekrar deneyin.` + (isDev ? `\n\nDETAY: ${result.errors.join(', ')}\n\nDEBUG:\n${debugText}` : ''));
      }
    } catch (error: unknown) {
      alert(`Beklenmeyen hata oluştu. Lütfen tekrar deneyin.`);
      if (process.env.NODE_ENV === 'development') {
        console.error("Manual push failed:", error);
      }
    } finally {
      setIsPushing(false);
    }
  };


  const currentUser = normalizeUser(rawCurrentUser);

  return (
    <header className="flex h-16 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-900 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        
              {/* Global Kurtar button disabled per user request */}
<button 
          onClick={toggleMobileMenu}
          className="min-h-10 min-w-10 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
          aria-label="Menüyü Aç"
        >
          <Menu className="w-5 h-5" />
        </button>

        {mounted && (
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <span className="hidden min-w-0 text-sm font-medium text-gray-700 dark:text-gray-300 lg:block">
              <span className="truncate font-bold text-gray-900 dark:text-white">{currentUser.name}</span>
            </span>
            <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-bold xl:inline-flex ${ROLE_BADGE_COLORS[currentUser.role] || 'bg-gray-150 text-gray-700'}`}>
              {(ROLE_PERMISSIONS[currentUser.role] || { label: currentUser.role }).label}
            </span>

            <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-800 sm:ml-1 sm:pl-3">
              {CLOUD_SYNC_DISABLED && (
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400" title="Ana bulut senkronizasyonu kapalı; veriler bu cihazda korunuyor">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Yerel Mod</span>
                </span>
              )}
              {!CLOUD_SYNC_DISABLED && syncStatus === 'synced' && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" title="Senkronize edildi">
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Senkronize edildi</span>
                </span>
              )}
              {!CLOUD_SYNC_DISABLED && syncStatus === 'pending' && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-650 dark:text-amber-400" title="Senkron bekliyor">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden md:inline">Senkron bekliyor</span>
                </span>
              )}
              {!CLOUD_SYNC_DISABLED && syncStatus === 'offline' && (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400" title="Çevrimdışı">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Çevrimdışı</span>
                </span>
              )}
              {!CLOUD_SYNC_DISABLED && syncStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400" title="Senkron hatası">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Senkron hatası</span>
                </span>
              )}

              <button
                onClick={handleManualPush}
                disabled={isPushing}
                className={`ml-1 flex min-h-10 items-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors sm:ml-2 ${
                  isPushing 
                    ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-wait'
                    : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                }`}
                title="Bekleyen yerel ölçüleri merkeze gönder"
              >
                <RefreshCw className={`w-3 h-3 ${isPushing ? 'animate-spin text-gray-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <span className="hidden sm:inline">{isPushing ? 'Gönderiliyor...' : 'Ölçüleri Gönder'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ErpScopeSelector />
        <button aria-label="Bildirimler" className="hidden min-h-10 min-w-10 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 sm:inline-flex sm:items-center sm:justify-center">
          <Bell className="w-5 h-5" />
        </button>
        
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Tema değiştir"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </header>
  );
}
