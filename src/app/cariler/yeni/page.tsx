"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, Save, Loader2, Camera, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useStore, generateUUID } from "@/store/useStore";
import { useAuthStore, canCreateCariType, normalizeRole } from "@/store/useAuthStore";
import { fileToDataUrl } from "@/lib/fileStorage";
import { syncNow } from "@/lib/syncService";
import { CustomerAddressModal, type AddressInput } from "@/components/modals/CustomerAddressModal";

export default function YeniCariPage() {
  const router = useRouter();
  const addCustomer = useStore((state) => state.addCustomer);
  const { currentUser } = useAuthStore();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [submitId, setSubmitId] = useState<string>(() => generateUUID());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const triggerPhotoInput = (useCamera: boolean) => {
    setShowPhotoSourceModal(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) {
      input.setAttribute('capture', 'environment');
    }
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file, 'photo');
        setFormData(prev => ({
          ...prev,
          addressPhotos: [...(prev.addressPhotos || []), dataUrl]
        }));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Fotoğraf eklenemedi.');
      }
    };
    input.click();
  };

  const canCreateAny = currentUser && (
    canCreateCariType(currentUser, 'CUSTOMER') || 
    canCreateCariType(currentUser, 'SUPPLIER') || 
    canCreateCariType(currentUser, 'TAILOR') || 
    canCreateCariType(currentUser, 'INSTALLER') || 
    canCreateCariType(currentUser, 'STAFF') || 
    canCreateCariType(currentUser, 'OTHER')
  );

  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    address: string;
    mapLocation: string;
    notes: string;
    customerCode: string;
    taxNumber: string;
    phone2: string;
    extraDescription: string;
    generalNote: string;
    cariType: 'CUSTOMER' | 'SUPPLIER' | 'TAILOR' | 'INSTALLER' | 'STAFF' | 'OTHER';
    addressPhotos: string[];
  }>({
    name: "",
    phone: "",
    address: "",
    mapLocation: "",
    notes: "",
    customerCode: "",
    taxNumber: "",
    phone2: "",
    extraDescription: "",
    generalNote: "",
    cariType: "CUSTOMER",
    addressPhotos: []
  });

  const normRole = currentUser ? normalizeRole(currentUser.role) : 'FIELD';
  const isCustomer = formData.cariType === 'CUSTOMER';
  const canAddAddressPhoto = !!currentUser && (
    normRole === 'ADMIN' ||
    normRole === 'OFFICE' ||
    currentUser.role === 'ACCOUNTING' ||
    ((normRole === 'FIELD' || currentUser.role === 'SALES') && isCustomer)
  );

  const [addressDraft, setAddressDraft] = useState<AddressInput | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[UI Diagnostic] submit started');
    console.log('[UI Diagnostic] isSaving before:', isSaving);
    
    if (isSaving) return;
    if (!formData.name.trim()) { showToast("Cari adı zorunludur."); return; }
    if (!formData.phone.trim() && !formData.phone2.trim()) { showToast("En az bir telefon girin."); return; }
    
    setIsSaving(true);
    
    const customerId = submitId || generateUUID();
    if (!submitId) {
      setSubmitId(customerId);
    }
    
    console.log('[UI Diagnostic] generated customer id:', customerId);
    
    try {
      await addCustomer({
        ...formData,
        id: customerId
      }, addressDraft ?? undefined);
      if (!useStore.getState().customers.some(customer => customer.id === customerId)) {
        throw new Error("Cari oluşturulmadı.");
      }
      console.log('[UI Diagnostic] addCustomer success: true');
      console.log('[UI Diagnostic] local count after add:', useStore.getState().customers.length);
    } catch (err) {
      console.error('[UI Diagnostic] caught error stage: Local Save', err);
      showToast("Müşteri kaydedilirken bir hata oluştu.");
      setIsSaving(false);
      return; // Stop execution here if local save failed
    }

    // Reset form fields
    setFormData({
      name: "",
      phone: "",
      address: "",
      mapLocation: "",
      notes: "",
      customerCode: "",
      taxNumber: "",
      phone2: "",
      extraDescription: "",
      generalNote: "",
      cariType: "CUSTOMER",
      addressPhotos: []
    });
    
    // Generate a new submitId for future form usage
    setSubmitId(generateUUID());
    setAddressDraft(null);

    // Trigger sync in the background with separate try/catch
    console.log('[UI Diagnostic] background sync started');
    (async () => {
      try {
        await syncNow();
        console.log('[UI Diagnostic] background sync status: success');
      } catch (syncErr) {
        console.error('[UI Diagnostic] caught error stage: Background Sync', syncErr);
        showToast("Kayıt cihazda kaydedildi. Senkronizasyon daha sonra tekrar denenecek.");
      }
    })();

    console.log('[UI Diagnostic] router push called');
    try {
      router.push("/cariler");
    } catch (pushErr) {
      console.error('[UI Diagnostic] router.push failed, fallback to href', pushErr);
      window.location.href = "/cariler";
    }
  };

  if (!mounted) {
    return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
  }

  if (!currentUser || !canCreateAny) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-red-500 font-bold text-lg">Erişim Engellendi</p>
        <p className="text-slate-350 text-sm">Cari kartı oluşturma yetkiniz yok.</p>
        <Link href="/cariler" className="inline-block bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">Geri Dön</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/cariler" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold heading-title">Yeni Cari Ekle</h1>
          <p className="text-sm heading-subtitle">Sisteme yeni bir müşteri kaydedin.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Kodu</label>
              <input 
                type="text" 
                value={formData.customerCode}
                onChange={e => setFormData({...formData, customerCode: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="CARI-001" 
              />
            </div>

            {(() => {
              const availableCariTypes = [
                { value: "CUSTOMER", label: "Müşteri" },
                { value: "SUPPLIER", label: "Satıcı / Tedarikçi" },
                { value: "TAILOR", label: "Terzi" },
                { value: "INSTALLER", label: "Montajcı" },
                { value: "STAFF", label: "Personel" },
                { value: "OTHER", label: "Diğer" }
              ].filter(t => canCreateCariType(currentUser, t.value));

              if (availableCariTypes.length > 1) {
                return (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Tipi</label>
                    <select
                      value={formData.cariType}
                      onChange={e => setFormData({...formData, cariType: e.target.value as 'CUSTOMER' | 'SUPPLIER' | 'TAILOR' | 'INSTALLER' | 'STAFF' | 'OTHER'})}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm cursor-pointer"
                    >
                      {availableCariTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Tipi</label>
                  <div className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm font-medium">
                    {availableCariTypes[0]?.label || "Müşteri"}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Müşteri Adı / Cari Adı *</label>
              <input 
                type="text" 
                required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="Ahmet Yılmaz" 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari TC / Vergi Kimlik No</label>
              <input 
                type="text" 
                value={formData.taxNumber}
                onChange={e => setFormData({...formData, taxNumber: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="12345678901" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Telefon</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="0555 123 45 67" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Telefon 2</label>
              <input 
                type="tel" 
                value={formData.phone2}
                onChange={e => setFormData({...formData, phone2: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
                placeholder="0555 987 65 43" 
              />
            </div>

          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => setAddressOpen(true)} className="rounded-lg border px-3 py-2 text-sm">
              {addressDraft ? "Adresi düzenle" : "Adres ekle (isteğe bağlı)"}
            </button>
            {addressDraft && <p className="text-sm">{[addressDraft.title, addressDraft.province, addressDraft.district, addressDraft.address].filter(Boolean).join(" · ")}</p>}
          </div>

          {canAddAddressPhoto && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bina / Adres Fotoğrafları</label>
              
              {formData.addressPhotos && formData.addressPhotos.length > 0 ? (
                <div className="flex gap-2 flex-wrap mb-2">
                  {formData.addressPhotos.map((url, i) => (
                    <div
                      key={i}
                      className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-250 dark:border-gray-850"
                    >
                      <Image
                        src={url}
                        fill
                        unoptimized
                        sizes="64px"
                        className="w-full h-full object-cover"
                        alt={`Adres Fotoğrafı ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = formData.addressPhotos.filter((_, idx) => idx !== i);
                          setFormData(prev => ({ ...prev, addressPhotos: updated }));
                        }}
                        className="absolute top-0.5 right-0.5 bg-red-650 hover:bg-red-700 text-white rounded-full p-0.5 shadow transition-colors cursor-pointer"
                        title="Fotoğrafı Kaldır"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-450 dark:text-gray-550 italic mb-2">
                  Henüz bina/adres fotoğrafı eklenmemiş.
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPhotoSourceModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 cursor-pointer w-fit"
              >
                <Camera className="w-3.5 h-3.5" />
                Bina Fotoğrafı Ekle
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ek Açıklama</label>
            <input 
              type="text" 
              value={formData.extraDescription}
              onChange={e => setFormData({...formData, extraDescription: e.target.value})}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              placeholder="Müşteri grubu, referans vb." 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Genel Açıklama</label>
            <textarea 
              rows={2} 
              value={formData.generalNote}
              onChange={e => setFormData({...formData, generalNote: e.target.value})}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              placeholder="Önemli cari detayları..."></textarea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notlar (Geçmiş Notlar)</label>
            <textarea 
              rows={2} 
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              placeholder="Özel notlar..."></textarea>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Link href="/cariler" className="px-6 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors flex items-center">
              İptal
            </Link>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {showPhotoSourceModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowPhotoSourceModal(false)}
        >
          <div 
            className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-250 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-scale-in text-gray-950 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-1">
              <h4 className="text-md font-bold">Fotoğraf Ekle</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lütfen fotoğraf kaynağını seçin.</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => triggerPhotoInput(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Fotoğraf Çek
              </button>
              <button
                type="button"
                onClick={() => triggerPhotoInput(false)}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-sm transition-colors border border-gray-250 dark:border-gray-750 cursor-pointer flex items-center justify-center gap-2"
              >
                Galeriden Seç
              </button>
              <button
                type="button"
                onClick={() => setShowPhotoSourceModal(false)}
                className="w-full py-3 bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomerAddressModal isOpen={addressOpen} address={addressDraft}
        onClose={() => setAddressOpen(false)} onSave={async address => {
          setAddressDraft(address);
          setAddressOpen(false);
        }} />

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm flex items-center gap-2 border border-gray-800 animate-slide-up">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
