"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Menu, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore, ROLE_PERMISSIONS } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";

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
  const { currentUser } = useAuthStore();
  const { toggleMobileMenu } = useUiStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!currentUser) return null;

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
