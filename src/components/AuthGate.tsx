"use client";

import { useState, useEffect } from "react";
import { useAuthStore, normalizeRole, canViewModule, normalizeUser } from "@/store/useAuthStore";
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
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileTcNo, setProfileTcNo] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileError, setProfileError] = useState("");

  const currentUser = rawCurrentUser ? normalizeUser(rawCurrentUser) : null;
  const currentUserId = currentUser?.id;

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || "");
      setProfileEmail(currentUser.email || "");
      setProfilePhone(currentUser.phone || "");
      setProfileTcNo(currentUser.tcNo || "");
      setProfileAddress(currentUser.address || "");
    }
  }, [currentUserId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if system needs bootstrap
  useEffect(() => {
    if (mounted && !currentUser) {
      fetch("/api/admin/bootstrap")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.needsBootstrap) {
            setNeedsBootstrap(true);
          }
        })
        .catch((err) => console.error("Failed to check bootstrap status:", err));
    }
  }, [mounted, currentUser]);

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

  // Force logout if currentUser is logged in but has no password credential stored
  useEffect(() => {
    if (mounted && currentUser && !currentUser.password) {
      console.warn("User has no password credential stored. Forcing logout to restore sync credential.");
      useAuthStore.getState().logout();
    }
  }, [mounted, currentUser]);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Yükleniyor...</div>;
  }

  // 1. Render Login screen if not authenticated
  if (!currentUser) {
    const handleLoginSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      
      const success = await login(username, password);
      if (!success) {
        setError("Kullanıcı adı veya şifre hatalı, ya da hesap aktif değil.");
        // If login failed, check if database needs bootstrap
        fetch("/api/admin/bootstrap")
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.needsBootstrap) {
              setNeedsBootstrap(true);
            }
          })
          .catch((err) => console.error("Failed to check bootstrap status:", err));
      }
    };

    const handleBootstrapClick = async () => {
      setBootstrapLoading(true);
      setBootstrapMessage("");
      setError("");
      try {
        const res = await fetch("/api/admin/bootstrap", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setBootstrapMessage("İlk kurulum başarıyla tamamlandı. Artık 'admin' kullanıcı adı ve '123' şifresiyle giriş yapabilirsiniz.");
          setNeedsBootstrap(false);
        } else {
          setError(data.error || "Kurulum başlatılamadı.");
        }
      } catch (err: any) {
        setError(err.message || "Ağ hatası oluştu.");
      } finally {
        setBootstrapLoading(false);
      }
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

            {needsBootstrap && (
              <div className="pt-2 border-t border-slate-800/60 mt-4 space-y-2">
                <p className="text-[10px] text-slate-400 text-center">Veritabanı bağlantısı boş görünüyor. İlk kurulumu başlatabilirsiniz.</p>
                <button
                  type="button"
                  onClick={handleBootstrapClick}
                  disabled={bootstrapLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-emerald-500/20 cursor-pointer"
                >
                  {bootstrapLoading ? "Kuruluyor..." : "İlk Kurulumu Başlat"}
                </button>
              </div>
            )}

            {bootstrapMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 mt-4 text-center">
                {bootstrapMessage}
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Check if profile is incomplete
  const isAdmin = currentUser && normalizeRole(currentUser.role) === 'ADMIN';
  const isSettingsPage = pathname.startsWith('/ayarlar');
  
  const isProfileIncomplete = currentUser && (
    !currentUser.profileCompletedAt ||
    !currentUser.name?.trim() || 
    currentUser.name === 'İsimsiz Kullanıcı' ||
    !currentUser.email?.trim() || 
    !currentUser.phone?.trim()
  );
  
  const shouldBlock = isProfileIncomplete && !(isAdmin && isSettingsPage);

  if (shouldBlock && currentUser) {
    const handleProfileSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setProfileError("");

      const trimmedName = profileName.trim();
      const trimmedEmail = profileEmail.trim();
      const trimmedPhone = profilePhone.trim();
      const trimmedTcNo = profileTcNo.trim();
      const trimmedAddress = profileAddress.trim();

      if (!trimmedName || !trimmedEmail || !trimmedPhone) {
        setProfileError("Lütfen ad soyad, mail adresi ve telefon numarası alanlarını doldurunuz.");
        return;
      }
      // Update user in the store
      useAuthStore.getState().updateUser(currentUser.id, {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        tcNo: trimmedTcNo,
        address: trimmedAddress,
        profileCompletedAt: new Date().toISOString()
      }).then((success) => {
        if (!success) {
          setProfileError("Profil bilgileri sunucuda güncellenemedi.");
        } else {
          // Role specific redirect
          const normRole = normalizeRole(currentUser.role);
          if (normRole === "TAILOR") {
            router.replace("/uretim");
          } else if (normRole === "INSTALLER") {
            router.replace("/montaj");
          } else {
            router.replace("/");
          }
        }
      }).catch((err) => {
        setProfileError("Profil güncellenirken hata oluştu.");
      });

      // Secure Logging (Only boolean flags and non-sensitive status)
      console.log("User profile status:", {
        hasFullName: !!trimmedName,
        hasEmail: !!trimmedEmail,
        hasPhone: !!trimmedPhone,
        hasTcNo: !!trimmedTcNo,
        hasAddress: !!trimmedAddress,
        role: currentUser.role,
        active: currentUser.isActive
      });    };

    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Soft decorative background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Erişim Kısıtlandı</h2>
            <p className="text-sm text-red-400 max-w-md mx-auto leading-relaxed">
              Güvenlik sebebiyle erişiminiz kısıtlanmıştır. Lütfen ad soyad, mail adresi ve telefon numarası bilgilerinizi tamamlayınız.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-left">
            {profileError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Adı Soyadı</label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Adınız ve soyadınız..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Mail Adresi</label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Telefon Numarası</label>
                <input
                  type="tel"
                  required
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">TC Kimlik Numarası</label>
              <input
                type="text"
                maxLength={11}
                value={profileTcNo}
                onChange={(e) => setProfileTcNo(e.target.value.replace(/\D/g, ""))}
                placeholder="TC kimlik numaranız..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Adres</label>
              <textarea
                value={profileAddress}
                onChange={(e) => setProfileAddress(e.target.value)}
                placeholder="Adresiniz..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow placeholder-slate-600 resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Bilgileri Kaydet ve Devam Et
              </button>
            </div>
            
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => useAuthStore.getState().logout()}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Farklı Kullanıcıyla Giriş Yap
              </button>
            </div>
          </form>
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
