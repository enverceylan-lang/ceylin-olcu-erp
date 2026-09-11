"use client";

import { useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import type { CustomerAddress } from "@/store/useStore";

type AddressInput = Omit<
  CustomerAddress,
  "id" | "customerId" | "normalizedTitle" | "createdAt" | "updatedAt"
>;

interface CustomerAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: CustomerAddress | null;
  onSave: (data: AddressInput) => Promise<void>;
}

export function CustomerAddressModal({
  isOpen,
  onClose,
  address,
  onSave,
}: CustomerAddressModalProps) {
  if (!isOpen) return null;

  return (
    <CustomerAddressModalContent
      key={`${address?.id || "new"}:${address?.updatedAt || ""}`}
      onClose={onClose}
      address={address}
      onSave={onSave}
    />
  );
}

type CustomerAddressModalContentProps = Omit<
  CustomerAddressModalProps,
  "isOpen"
>;

function CustomerAddressModalContent({
  onClose,
  address,
  onSave,
}: CustomerAddressModalContentProps) {
  const [title, setTitle] = useState(address?.title || "");
  const [phone, setPhone] = useState(address?.phone || "");
  const [province, setProvince] = useState(address?.province || "");
  const [district, setDistrict] = useState(address?.district || "");
  const [openAddress, setOpenAddress] = useState(address?.address || "");
  const [mapLocation, setMapLocation] = useState(address?.mapLocation || "");
  const [latitude, setLatitude] = useState<number | undefined>(address?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(address?.longitude);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");



  const handleLocation = () => {
    if (!navigator.geolocation) {
      setError("Bu cihaz konum bilgisini desteklemiyor.");
      return;
    }
    setIsLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);
        setMapLocation(`${lat},${lng}`);
        setIsLocating(false);
      },
      () => {
        setError("Konum alınamadı. Cihazın konum iznini kontrol edin.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim() || undefined,
        phone: phone.trim() || undefined,
        province: province.trim() || undefined,
        district: district.trim() || undefined,
        address: openAddress.trim(),
        mapLocation: mapLocation.trim() || undefined,
        latitude,
        longitude,
        isDeleted: false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Adres kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {address ? "Adresi Düzenle" : "Yeni Adres"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Adres başlığı örnekleri: Ev, İş, Yazlık, Yeni Ev
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Adres Başlığı</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Örn: Ev, İş, Yazlık, Yeni Ev" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Adres Telefonu</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="İsteğe bağlı" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">İl</span>
            <input value={province} onChange={e => setProvince(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">İlçe</span>
            <input value={district} onChange={e => setDistrict(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800" />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Açık Adres</span>
            <textarea value={openAddress} onChange={e => setOpenAddress(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800" />
          </label>

          <div className="sm:col-span-2">
            <button type="button" onClick={handleLocation} disabled={isLocating} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {isLocating ? "Konum Alınıyor..." : "Konum Al"}
            </button>
            {mapLocation && <div className="mt-2 break-all font-mono text-[10px] text-gray-500">{mapLocation}</div>}
          </div>

          {error && (
            <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-5 dark:border-gray-800">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300">
            İptal
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}