"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, 
  Users, 
  Ruler, 
  Package, 
  ShoppingCart, 
  Factory, 
  Wrench, 
  FileText, 
  Settings,
  ChevronDown,
  X,
  LogOut, ClipboardList } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuthStore, ROLE_PERMISSIONS, canViewModule, normalizeUser, normalizeRole } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";
import { useState, useEffect } from "react";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Cariler", href: "/cariler", icon: Users },
  { name: "Ölçüler", href: "/olculer", icon: Ruler },
  { name: "Görevler", href: "/gorevler", icon: ClipboardList },
  { name: "Stok", href: "/stok", icon: Package },
  { name: "Satış", href: "/satis", icon: ShoppingCart },
  { name: "Üretim", href: "/uretim", icon: Factory },
  { name: "Montaj", href: "/montaj", icon: Wrench },
  { name: "Raporlar", href: "/raporlar", icon: FileText },
  { name: "Ayarlar", href: "/ayarlar", icon: Settings },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-600',
  OFFICE: 'bg-orange-500',
  SALES: 'bg-orange-500',
  FIELD: 'bg-blue-600',
  MEASUREMENT: 'bg-blue-600',
  TAILOR: 'bg-purple-600',
  PRODUCTION: 'bg-purple-600',
  INSTALLER: 'bg-green-600',
  INSTALLATION: 'bg-green-600',
};

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser: rawCurrentUser, switchUser, users, logout } = useAuthStore();
  const { isMobileMenuOpen, setMobileMenuOpen } = useUiStore();
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  if (!rawCurrentUser) return null;
  
  const currentUser = normalizeUser(rawCurrentUser);

  const permissions = ROLE_PERMISSIONS[currentUser.role] || { label: 'Kullanıcı' };
  const visibleMenuItems = menuItems.filter(item => 
    canViewModule(currentUser.role, item.href)
  );

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 ease-in-out"
        />
      )}

      <aside 
        className={twMerge(
          clsx(
            "w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col",
            "fixed inset-y-0 left-0 z-50 transform md:static md:translate-x-0 transition-transform duration-300 ease-in-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              CEYLİN ERP
            </h1>
            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              V1.0 SAHA PİLOT
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Menüyü Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={twMerge(
                clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
                  isActive 
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                )
              )}
            >
              <item.icon className={clsx("w-5 h-5", isActive ? "text-blue-700 dark:text-blue-400" : "text-gray-500 dark:text-gray-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* User Switcher / Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 relative">
        <div className="flex items-center justify-between gap-2">
          <button 
            disabled={normalizeRole(currentUser.role) !== 'ADMIN'}
            onClick={() => setShowUserPicker(!showUserPicker)}
            className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors text-left flex-1 min-w-0 disabled:hover:bg-transparent disabled:cursor-default"
          >
            <div className={`w-8 h-8 rounded-full ${mounted ? ROLE_COLORS[currentUser.role] : 'bg-gray-500'} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {mounted ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-sm flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{mounted ? currentUser.name : 'Kullanıcı'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{mounted ? permissions.label : 'Yükleniyor'}</p>
            </div>
            {normalizeRole(currentUser.role) === 'ADMIN' && (
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserPicker ? 'rotate-180' : ''} shrink-0`} />
            )}
          </button>
          
          {normalizeRole(currentUser.role) !== 'ADMIN' && (
            <button 
              onClick={() => logout()}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Picker Dropdown (Only for ADMIN) */}
        {showUserPicker && mounted && normalizeRole(currentUser.role) === 'ADMIN' && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Kullanıcı Değiştir (Admin)</span>
            </div>
            {users.map(u => normalizeUser(u)).filter(u => u.isActive).map(user => (
              <button
                key={user.id}
                onClick={() => { switchUser(user.id); setShowUserPicker(false); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  currentUser.id === user.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-750/50'
                }`}
              >
                <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-500'} flex items-center justify-center text-white font-bold text-xs`}>
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{(ROLE_PERMISSIONS[user.role] || { label: user.role }).label}</p>
                </div>
                {currentUser.id === user.id && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">AKTİF</span>
                )}
              </button>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800/50">
              <button 
                onClick={() => { logout(); setShowUserPicker(false); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
