"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Menu, Bell, Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore, ROLE_PERMISSIONS, normalizeUser } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";
import { useStore } from "@/store/useStore";
import { syncNow } from "@/lib/syncService";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!rawCurrentUser) return null;

  const currentUser = normalizeUser(rawCurrentUser);

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleMobileMenu}
          className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Menüyü Aç"
        >
          <Menu className="w-5 h-5" />
        </button>

        {mounted && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Giriş: <span className="font-bold text-gray-900 dark:text-white">{currentUser.name}</span>
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE_COLORS[currentUser.role] || 'bg-gray-150 text-gray-700'}`}>
              {(ROLE_PERMISSIONS[currentUser.role] || { label: currentUser.role }).label}
            </span>

            <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-gray-800 pl-3 ml-1">
              {syncStatus === 'synced' && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" title="Senkronize edildi">
                  <Cloud className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Senkronize edildi</span>
                </span>
              )}
              {syncStatus === 'pending' && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-650 dark:text-amber-400" title="Senkron bekliyor">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden md:inline">Senkron bekliyor</span>
                </span>
              )}
              {syncStatus === 'offline' && (
                <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400" title="Çevrimdışı">
                  <CloudOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Çevrimdışı</span>
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400" title="Senkron hatası">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Senkron hatası</span>
                </span>
              )}

              <button
                onClick={() => alert("Cloud sync geçici olarak kapalı. Ana PC yerel veri korunuyor.")}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-md border border-gray-200 dark:border-gray-700 ml-2 cursor-not-allowed opacity-60"
                title="Cloud sync geçici olarak kapalı. Ana PC yerel veri korunuyor."
              >
                <RefreshCw className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                <span>Senkronize Et</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </header>
  );
}
