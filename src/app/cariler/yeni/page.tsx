"use client";

import { useState } from "react";
import { ArrowLeft, Save, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useAuthStore, canCreateCariType } from "@/store/useAuthStore";

export default function YeniCariPage() {
  const router = useRouter();
  const addCustomer = useStore((state) => state.addCustomer);
  const { currentUser } = useAuthStore();

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
    cariType: "CUSTOMER"
  });

  const [fetchingLocation, setFetchingLocation] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert("Tarayıcınız konum bilgisini desteklemiyor.");
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          mapLocation: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        }));
        setFetchingLocation(false);
      },
      (error) => {
        console.error(error);
        alert("Konum bilgisi alınamadı. Lütfen konum izinlerini kontrol edin.");
        setFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    addCustomer(formData);
    router.push("/cariler");
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Yeni Cari Ekle</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sisteme yeni bir müşteri kaydedin.</p>
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Konum</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.mapLocation}
                  onChange={e => setFormData({...formData, mapLocation: e.target.value})}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm" 
                  placeholder="39.9334, 32.8597 veya https://maps.app.goo.gl/..." 
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={fetchingLocation}
                  className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors text-xs font-semibold cursor-pointer"
                  title="Mevcut Konumu Al"
                >
                  {fetchingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4 text-red-500" />
                  )}
                  {fetchingLocation ? "Alınıyor..." : "Konum Al"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cari Adresi</label>
            <textarea 
              rows={2} 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" 
              placeholder="Müşteri adresi..."></textarea>
          </div>

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
            <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-sm">
              <Save className="w-4 h-4" />
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
