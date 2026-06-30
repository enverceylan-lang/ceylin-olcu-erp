"use client";

import { Download, Settings, Upload, ShieldCheck, AlertTriangle, UserPlus, Trash2, Check, X, Shield } from "lucide-react";
import { useRef, useState, useEffect, Fragment } from "react";
import { useAuthStore, ROLE_PERMISSIONS, normalizeRole, MockUser } from "@/store/useAuthStore";
import { syncNow } from "@/lib/syncService";

const DATA_KEYS = ["curtain-erp-storage-v3", "curtain-erp-auth-v1"];

type BackupPayload = {
  version: "olcu-erp-v1";
  exportedAt: string;
  data: Record<string, string | null>;
};

export default function AyarlarPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupPayload | null>(null);
  
  // Auth Store
  const { currentUser, users, addUser, updateUser, deleteUser } = useAuthStore();

  // Logged in user profile edit form states
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [selfPhone, setSelfPhone] = useState("");
  const [selfTcNo, setSelfTcNo] = useState("");
  const [selfAddress, setSelfAddress] = useState("");
  const [selfPassword, setSelfPassword] = useState("");
  const [selfMessage, setSelfMessage] = useState("");

  // Add User Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("FIELD");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTcNo, setNewTcNo] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("FIELD");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTcNo, setEditTcNo] = useState("");
  const [editAddress, setEditAddress] = useState("");

  useEffect(() => {
    if (currentUser) {
      setSelfName(currentUser.name || "");
      setSelfEmail(currentUser.email || "");
      setSelfPhone(currentUser.phone || "");
      setSelfTcNo(currentUser.tcNo || "");
      setSelfAddress(currentUser.address || "");
      setSelfPassword("");
    }
  }, [currentUser?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

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

      setPendingBackupData(parsed);
      setShowConfirmModal(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Yedek geri yüklenemedi.");
    }
  };

  const handleConfirmImport = () => {
    if (!pendingBackupData) return;
    DATA_KEYS.forEach((key) => {
      const value = pendingBackupData.data[key];
      if (typeof value === "string") localStorage.setItem(key, value);
    });
    setMessage("Yedek geri yüklendi. Sayfa yenileniyor…");
    setShowConfirmModal(false);
    window.setTimeout(() => window.location.reload(), 700);
  };

  // User Management Handlers
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim() || !newEmail.trim() || !newPhone.trim()) {
      setMessage("Hata: Ad soyad, kullanıcı adı, şifre, mail adresi ve telefon numarası zorunludur.");
      return;
    }

    setMessage("Kullanıcı ekleniyor... Lütfen bekleyin.");

    const success = await addUser({
      name: newName.trim(),
      username: newUsername.trim().toLowerCase(),
      password: newPassword.trim(),
      role: newRole as any,
      isActive: true,
      permissions: [],
      email: newEmail.trim(),
      phone: newPhone.trim(),
      tcNo: newTcNo.trim(),
      address: newAddress.trim()
    });

    if (success) {
      const addedName = newName.trim();
      const addedEmail = newEmail.trim();
      const addedPhone = newPhone.trim();
      const addedTcNo = newTcNo.trim();
      const addedAddress = newAddress.trim();

      // Reset Form
      setNewName("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("FIELD");
      setNewEmail("");
      setNewPhone("");
      setNewTcNo("");
      setNewAddress("");
      setShowAddForm(false);
      setMessage("Kullanıcı başarıyla eklendi.");

      try {
        await syncNow(true);
      } catch (err: any) {}

      // Secure Logging (Only boolean flags and non-sensitive status)
      console.log("User profile status (admin created user):", {
        hasFullName: !!addedName,
        hasEmail: !!addedEmail,
        hasPhone: !!addedPhone,
        hasTcNo: !!addedTcNo,
        hasAddress: !!addedAddress,
        role: newRole,
        active: true
      });
    } else {
      setMessage("Hata: Kullanıcı eklenemedi.");
    }
  };

  const startEditingUser = (u: any) => {
    setEditingUserId(u.id);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditPassword(""); // Blank by default, so it's not pre-filled/exposed. If left empty, updateUser preserves the current password.
    setEditRole(u.role);
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
    setEditTcNo(u.tcNo || "");
    setEditAddress(u.address || "");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim() || !editUsername.trim() || !editEmail.trim() || !editPhone.trim()) {
      setMessage("Hata: Ad soyad, kullanıcı adı, mail adresi ve telefon numarası zorunludur.");
      return;
    }

    const updateData: Partial<MockUser> = {
      name: editName.trim(),
      username: editUsername.trim().toLowerCase(),
      role: editRole as any,
      email: editEmail.trim(),
      phone: editPhone.trim(),
      tcNo: editTcNo.trim(),
      address: editAddress.trim()
    };

    if (editPassword.trim() && editPassword.trim() !== "••••") {
      updateData.password = editPassword.trim();
    }

    setMessage("Güncelleniyor... Lütfen bekleyin.");

    const success = await updateUser(id, updateData);
    if (success) {
      setEditingUserId(null);
      setMessage("Kullanıcı başarıyla güncellendi.");
      try {
        await syncNow(true);
      } catch (err: any) {}
    } else {
      setMessage("Hata: Kullanıcı güncellenemedi.");
    }

    // Secure Logging (Only boolean flags and non-sensitive status)
    const userRecord = users.find(x => x.id === id);
    console.log("User profile status (admin update):", {
      hasFullName: !!editName.trim(),
      hasEmail: !!editEmail.trim(),
      hasPhone: !!editPhone.trim(),
      hasTcNo: !!editTcNo.trim(),
      hasAddress: !!editAddress.trim(),
      role: editRole,
      active: userRecord ? userRecord.isActive : true
    });
  };

  const handleSelfUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfMessage("");

    if (!currentUser) {
      setSelfMessage("Hata: Oturum açık değil.");
      return;
    }

    if (!selfName.trim() || !selfEmail.trim() || !selfPhone.trim()) {
      setSelfMessage("Hata: Ad soyad, mail adresi ve telefon numarası zorunludur.");
      return;
    }

    const updateData: Partial<MockUser> = {
      name: selfName.trim(),
      email: selfEmail.trim(),
      phone: selfPhone.trim(),
      tcNo: selfTcNo.trim(),
      address: selfAddress.trim()
    };

    if (selfPassword.trim() && selfPassword.trim() !== "••••") {
      updateData.password = selfPassword.trim();
    }

    setSelfMessage("Güncelleniyor... Lütfen bekleyin.");

    const success = await updateUser(currentUser.id, updateData);
    if (success) {
      setSelfMessage("Profil bilgileriniz başarıyla güncellendi.");
      setSelfPassword(""); // reset password input
      try {
        await syncNow(true);
      } catch (err: any) {}
    } else {
      setSelfMessage("Hata: Profil güncellenemedi.");
    }

    // Secure Logging (Only boolean flags and non-sensitive status)
    console.log("User profile status (self update):", {
      hasFullName: !!selfName.trim(),
      hasEmail: !!selfEmail.trim(),
      hasPhone: !!selfPhone.trim(),
      hasTcNo: !!selfTcNo.trim(),
      hasAddress: !!selfAddress.trim(),
      role: currentUser.role,
      active: currentUser.isActive
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-bold heading-title">Ayarlar</h1>
        <p className="text-sm heading-subtitle">Ölçü ERP V1.0 saha pilotu için cihaz verisi, kullanıcı hesapları ve güvenlik araçları.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p><strong>Pilot uyarısı:</strong> Veriler şimdilik bu cihazın tarayıcısında saklanır. Tarayıcı verilerini temizlemeden önce mutlaka yedek alın.</p>
        </div>
      </div>

      {/* Profil Bilgilerim Panel */}
      {currentUser && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden text-xs">
          <div className="border-b border-gray-200 p-5 dark:border-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold">
              {selfName ? selfName[0].toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Profil Bilgilerim</h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Kendi profil detaylarınızı ve şifrenizi güncelleyin.</p>
            </div>
          </div>
          
          <form onSubmit={handleSelfUpdate} className="p-5 space-y-4">
            {selfMessage && (
              <div className={`p-3 rounded-lg border text-[11px] ${
                selfMessage.startsWith("Hata")
                  ? "bg-red-500/10 border-red-500/20 text-red-500"
                  : "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
              }`}>
                {selfMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-gray-650 dark:text-gray-405 mb-1">Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={selfName}
                  onChange={e => setSelfName(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                  placeholder="Nihat Ceylan"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-650 dark:text-gray-405 mb-1">Mail Adresi</label>
                <input
                  type="email"
                  required
                  value={selfEmail}
                  onChange={e => setSelfEmail(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                  placeholder="ornek@mail.com"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-650 dark:text-gray-405 mb-1">Telefon Numarası</label>
                <input
                  type="tel"
                  required
                  value={selfPhone}
                  onChange={e => setSelfPhone(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                  placeholder="05xx xxx xx xx"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-gray-650 dark:text-gray-405 mb-1 font-normal text-slate-500">TC Kimlik Numarası</label>
                <input
                  type="text"
                  maxLength={11}
                  value={selfTcNo}
                  onChange={e => setSelfTcNo(e.target.value.replace(/\D/g, ""))}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                  placeholder="11 haneli TC no..."
                />
              </div>
              <div>
                <label className="block font-bold text-gray-655 dark:text-gray-405 mb-1 font-normal text-slate-500">Yeni Şifre (Mevcut şifreyi korumak için boş bırakın)</label>
                <input
                  type="password"
                  value={selfPassword}
                  onChange={e => setSelfPassword(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                  placeholder="Yeni şifreniz..."
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-650 dark:text-gray-450 mb-1 font-normal text-slate-500">Adres</label>
              <textarea
                value={selfAddress}
                onChange={e => setSelfAddress(e.target.value)}
                rows={2}
                className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none resize-none"
                placeholder="Ev veya iş adresiniz..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors shadow-md shadow-indigo-650/20"
              >
                Profil Bilgilerini Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Management Panel (ADMIN Only) */}
      {currentUser && normalizeRole(currentUser.role) === 'ADMIN' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-indigo-650 dark:text-indigo-400" />
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Kullanıcı Yönetimi</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">ERP kullanıcı hesaplarını, PIN şifrelerini ve rollerini yönetin.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {showAddForm ? "Kapat" : "Yeni Kullanıcı"}
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <form onSubmit={handleAddUserSubmit} className="p-5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Yeni Kullanıcı Hesabı Ekle</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">Adı Soyadı</label>
                  <input 
                    type="text" 
                    required 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="Nihat Ceylan"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">Kullanıcı Adı</label>
                  <input 
                    type="text" 
                    required 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="nihat"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">PIN / Şifre</label>
                  <input 
                    type="password" 
                    required 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">Rol</label>
                  <select 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none cursor-pointer"
                  >
                    <option value="ADMIN">Yönetici (Admin)</option>
                    <option value="OFFICE">Ofis / Moderatör</option>
                    <option value="FIELD">Saha / Plasiyer</option>
                    <option value="TAILOR">Terzi / Üretici</option>
                    <option value="INSTALLER">Montaj Ekibi</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">Mail Adresi</label>
                  <input 
                    type="email" 
                    required 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="ornek@mail.com"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1">Telefon Numarası</label>
                  <input 
                    type="tel" 
                    required 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="05xx xxx xx xx"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1 font-normal text-slate-500">TC Kimlik Numarası</label>
                  <input 
                    type="text" 
                    maxLength={11}
                    value={newTcNo} 
                    onChange={e => setNewTcNo(e.target.value.replace(/\D/g, ""))}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="11 haneli TC no..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-600 dark:text-gray-400 mb-1 font-normal text-slate-500">Adres</label>
                  <input 
                    type="text" 
                    value={newAddress} 
                    onChange={e => setNewAddress(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                    placeholder="Ev/İş adresi..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-550 text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors shadow-md shadow-indigo-650/20">Kaydet</button>
              </div>
            </form>
          )}

          {/* Users List Table */}
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold">
                  <th className="p-4">Adı Soyadı</th>
                  <th className="p-4">Kullanıcı Adı</th>
                  <th className="p-4">PIN / Şifre</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4 text-center">Durum</th>
                  <th className="p-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingUserId === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                        <td className="p-4 font-semibold text-gray-900 dark:text-white">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs outline-none" 
                            />
                          ) : (
                            u.name
                          )}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editUsername} 
                              onChange={e => setEditUsername(e.target.value)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs w-28 outline-none" 
                            />
                          ) : (
                            u.username
                          )}
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400 font-mono">
                          {isEditing ? (
                            <input 
                              type="password" 
                              value={editPassword} 
                              onChange={e => setEditPassword(e.target.value)}
                              placeholder="Mevcut PIN..."
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs w-24 outline-none placeholder-slate-650" 
                            />
                          ) : (
                            u.password || u.hasPassword ? "••••" : "-"
                          )}
                        </td>
                        <td className="p-4 font-medium">
                          {isEditing ? (
                            <select 
                              value={editRole} 
                              onChange={e => setEditRole(e.target.value)}
                              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs cursor-pointer outline-none"
                            >
                              <option value="ADMIN">Yönetici (Admin)</option>
                              <option value="OFFICE">Ofis / Moderatör</option>
                              <option value="FIELD">Saha / Plasiyer</option>
                              <option value="TAILOR">Terzi / Üretici</option>
                              <option value="INSTALLER">Montaj Ekibi</option>
                            </select>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border dark:border-gray-800">
                              {ROLE_PERMISSIONS[u.role]?.label || u.role}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={async () => {
                              setMessage("Durum güncelleniyor...");
                              const success = await updateUser(u.id, { isActive: !u.isActive });
                              if (success) {
                                setMessage("Kullanıcı durumu güncellendi.");
                              } else {
                                setMessage("Hata: Kullanıcı durumu güncellenemedi.");
                              }
                            }}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border cursor-pointer transition-colors ${
                              u.isActive 
                                ? 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400' 
                                : 'bg-red-500/10 text-red-500 border-red-500/20 dark:text-red-400'
                            }`}
                          >
                            {u.isActive ? "Aktif" : "Pasif"}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {isEditing ? (
                              <>
                                <button onClick={() => handleSaveEdit(u.id)} className="text-green-500 hover:text-green-700 p-1 cursor-pointer" title="Kaydet"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingUserId(null)} className="text-gray-400 hover:text-gray-500 p-1 cursor-pointer" title="İptal"><X className="w-4 h-4" /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditingUser(u)} className="text-blue-500 hover:underline cursor-pointer">Düzenle</button>
                                {u.id !== 'user-admin' && (
                                  <button onClick={async () => {
                                    if (confirm("Bu kullanıcıyı silmek istediğinize emin misiniz? (Devre dışı bırakılacaktır)")) {
                                      setMessage("Kullanıcı siliniyor...");
                                      const success = await deleteUser(u.id);
                                      if (success) {
                                        setMessage("Kullanıcı başarıyla silindi (pasif yapıldı).");
                                      } else {
                                        setMessage("Hata: Kullanıcı silinemedi.");
                                      }
                                    }
                                  }} className="text-red-500 hover:text-red-700 p-1 cursor-pointer" title="Kullanıcı Sil"><Trash2 className="w-4 h-4" /></button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-gray-50/50 dark:bg-gray-800/10">
                          <td colSpan={6} className="p-4 border-b border-gray-200 dark:border-gray-800">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <label className="block font-semibold text-gray-650 dark:text-gray-400 mb-1">Mail Adresi</label>
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={e => setEditEmail(e.target.value)}
                                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                                  placeholder="ornek@mail.com"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-gray-650 dark:text-gray-400 mb-1">Telefon Numarası</label>
                                <input
                                  type="tel"
                                  value={editPhone}
                                  onChange={e => setEditPhone(e.target.value)}
                                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                                  placeholder="05xx xxx xx xx"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-gray-650 dark:text-gray-400 mb-1 font-normal text-slate-500">TC Kimlik Numarası</label>
                                <input
                                  type="text"
                                  maxLength={11}
                                  value={editTcNo}
                                  onChange={e => setEditTcNo(e.target.value.replace(/\D/g, ""))}
                                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                                  placeholder="11 haneli TC no..."
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-gray-650 dark:text-gray-400 mb-1 font-normal text-slate-500">Adres</label>
                                <input
                                  type="text"
                                  value={editAddress}
                                  onChange={e => setEditAddress(e.target.value)}
                                  className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-700 text-gray-900 dark:text-white text-xs outline-none"
                                  placeholder="Ev/İş adresi..."
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-200 p-5 dark:border-gray-800">
          <Settings className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Cihaz Yedeği</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cari, oda, açıklık, ölçü ve demo kullanıcı verilerini JSON dosyası olarak koruyun.</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <button onClick={exportBackup} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 cursor-pointer">
            <Download className="h-4 w-4" /> Yedek İndir
          </button>
          <button onClick={() => inputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 cursor-pointer">
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
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-250 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-scale-in text-gray-955 dark:text-white">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
              <h4 className="text-lg font-bold">Yedeği Geri Yükle</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Mevcut cihaz verileri yedekteki verilerle değiştirilecek. Devam etmek istediğinize emin misiniz?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingBackupData(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              >
                Evet, Yükle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
