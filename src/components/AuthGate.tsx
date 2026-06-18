"use client";

import { useState, useEffect } from "react";
import { useAuthStore, normalizeRole, canViewModule, INITIAL_USERS, normalizeUser } from "@/store/useAuthStore";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, Lock, User, KeyRound, ArrowRight } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser: rawCurrentUser, login, users } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const currentUser = rawCurrentUser ? normalizeUser(rawCurrentUser) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-redirect tailors and installers when they land on the root "/" route
  useEffect(() => {
    if (mounted && currentUser) {
      const normRole = normalizeRole(currentUser.role);
      if (pathname === "/") {
        if (normRole === "TAILOR") {
          router.replace("/uretim");
        } else if (normRole === "INSTALLER") {
          router.replace("/montaj");
        }
      }
    }
  }, [mounted, currentUser, pathname, router]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Yükleniyor...</div>;
  }

  // 1. Render Login screen if not authenticated
  if (!currentUser) {
    const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      
      const success = login(username, password);
      if (!success) {
        setError("Kullanıcı adı veya şifre hatalı, ya da hesap aktif değil.");
      }
    };

    const handleQuickLogin = (user: typeof INITIAL_USERS[0]) => {
      setUsername(user.username);
      setPassword(user.password || "");
      setError("");
    };

    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Soft decorative background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-650/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Ölçü ERP Giriş</h2>
            <p className="text-xs text-slate-400">Saha pilot sürümüne erişmek için kimliğinizi doğrulayın.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Kullanıcı Adı</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınız..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN / Şifre</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Giriş şifreniz..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer"
            >
              Giriş Yap <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Login selector for local demo/pilot testing */}
          <div className="border-t border-slate-800/80 pt-4 space-y-2">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Hızlı Giriş (Demo/Test)</span>
            <div className="grid grid-cols-2 gap-2">
              {users.map(u => normalizeUser(u)).map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleQuickLogin(user)}
                  type="button"
                  className="px-3 py-2 bg-slate-950/40 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left text-xs transition-all flex flex-col cursor-pointer"
                >
                  <span className="font-semibold text-slate-200 truncate">{user.name}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{user.username} (P: {user.password})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Render Unauthorized warning if page access is denied
  if (!canViewModule(currentUser.role, pathname)) {
    const handleReturnClick = () => {
      const normRole = normalizeRole(currentUser.role);
      if (normRole === "TAILOR") {
        router.push("/uretim");
      } else if (normRole === "INSTALLER") {
        router.push("/montaj");
      } else {
        router.push("/");
      }
    };

    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Erişim Engellendi</h3>
            <p className="text-sm text-slate-400">Bu bölüme erişim yetkiniz yok.</p>
            <p className="text-xs text-slate-500">Hesabınızın yetki tanımları bu sayfayı görüntülemek için yeterli değildir.</p>
          </div>
          <button
            onClick={handleReturnClick}
            className="w-full bg-slate-800 hover:bg-slate-750 text-white font-semibold py-3 rounded-xl text-sm transition-colors border border-slate-700 cursor-pointer"
          >
            Erişilebilir Sayfaya Git
          </button>
        </div>
      </div>
    );
  }

  // 3. Render children if authenticated and authorized
  return <>{children}</>;
}
