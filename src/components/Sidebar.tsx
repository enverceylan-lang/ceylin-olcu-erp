"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Ruler, 
  Package, 
  ShoppingCart, 
  Factory, 
  Wrench, 
  FileText, 
  Settings,
  ChevronDown
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuthStore, MOCK_USERS, ROLE_PERMISSIONS } from "@/store/useAuthStore";
import { useState, useEffect } from "react";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Cariler", href: "/cariler", icon: Users },
  { name: "Ölçüler", href: "/olculer", icon: Ruler },
  { name: "Stok", href: "/stok", icon: Package },
  { name: "Satış", href: "/satis", icon: ShoppingCart },
  { name: "Üretim", href: "/uretim", icon: Factory },
  { name: "Montaj", href: "/montaj", icon: Wrench },
  { name: "Raporlar", href: "/raporlar", icon: FileText },
  { name: "Ayarlar", href: "/ayarlar", icon: Settings },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-600',
  SALES: 'bg-orange-500',
  MEASUREMENT: 'bg-blue-600',
  PRODUCTION: 'bg-purple-600',
  INSTALLATION: 'bg-green-600',
};

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, switchUser } = useAuthStore();
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  const permissions = ROLE_PERMISSIONS[currentUser.role];
  const visibleMenuItems = menuItems.filter(item => 
    permissions.allowedRoutes.some(route => 
      route === item.href || (item.href !== '/' && route.startsWith(item.href))
    )
  );

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
          Ölçü ERP
        </h1>
        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          V1.0 SAHA PİLOT
        </span>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.name}
              href={item.href}
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
      
      {/* User Switcher */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 relative">
        <button 
          onClick={() => setShowUserPicker(!showUserPicker)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className={`w-8 h-8 rounded-full ${mounted ? ROLE_COLORS[currentUser.role] : 'bg-gray-500'} flex items-center justify-center text-white font-bold text-sm`}>
            {mounted ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="text-sm text-left flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{mounted ? currentUser.name : 'Kullanıcı'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{mounted ? permissions.label : 'Yükleniyor'}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserPicker ? 'rotate-180' : ''}`} />
        </button>

        {/* User Picker Dropdown */}
        {showUserPicker && mounted && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">Kullanıcı Değiştir (Demo)</span>
            </div>
            {MOCK_USERS.map(user => (
              <button
                key={user.id}
                onClick={() => { switchUser(user.id); setShowUserPicker(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  currentUser.id === user.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className={`w-7 h-7 rounded-full ${ROLE_COLORS[user.role]} flex items-center justify-center text-white font-bold text-xs`}>
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{ROLE_PERMISSIONS[user.role].label}</p>
                </div>
                {currentUser.id === user.id && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">AKTİF</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
