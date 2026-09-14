"use client";

import { useState } from "react";
import { X, Save, Shield, Plus, MapPin, Edit3 } from "lucide-react";
import { Customer, CustomerAddress, useStore } from "@/store/useStore";
import { CustomerAddressModal } from "@/components/modals/CustomerAddressModal";
import { activeCustomerAddresses, customerAddressDisplayTitle } from "@/lib/customerAddressModel";

interface CariEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onSave: (id: string, data: Partial<Customer>) => Promise<void>;
}

export function CariEditModal({ isOpen, onClose, customer, onSave }: CariEditModalProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({ ...customer });
  const [isSaving, setIsSaving] = useState(false);
  const [addressTab, setAddressTab] = useState<string>("PRIMARY");
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  const liveCustomer =
    useStore(state => state.customers.find(item => item.id === customer.id)) ||
    customer;
  const ensureCustomerAddressIdentity =
    useStore(state => state.ensureCustomerAddressIdentity);
  const addCustomerAddress =
    useStore(state => state.addCustomerAddress);
  const updateCustomerAddress =
    useStore(state => state.updateCustomerAddress);
  const activeAddresses =
    activeCustomerAddresses(liveCustomer.addresses);
  const selectedExtraAddress =
    activeAddresses.find(address => address.id === addressTab) || null;

  const openNewAddress = async () => {
    await ensureCustomerAddressIdentity(customer.id);
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const openEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
    setIsAddressModalOpen(true);
  };

  const saveCustomerAddress = async (
    data: Omit<CustomerAddress, "id" | "customerId" | "normalizedTitle" | "createdAt" | "updatedAt">,
  ) => {
    if (editingAddress) {
      await updateCustomerAddress(customer.id, editingAddress.id, data);
      setAddressTab(editingAddress.id);
    } else {
      const addressId = await addCustomerAddress(customer.id, data);
      setAddressTab(addressId);
    }
    setIsAddressModalOpen(false);
    setEditingAddress(null);
  };

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | number | boolean | undefined = value;
    
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      finalValue = value === "" ? undefined : Number(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(customer.id, formData);
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Cari güncellenemedi.";
      alert("Hata: " + message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Cari Kartını Düzenle (Admin)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Tüm temel, finansal ve adres bilgilerini güncelleyebilirsiniz.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/50">
          <div
            data-cari-edit-address-tabs-v1
            className="mb-5 flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setAddressTab("PRIMARY")}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                addressTab === "PRIMARY"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              Ana Adres
            </button>

            {activeAddresses
              .filter(address => !address.legacyPrimary)
              .map(address => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => setAddressTab(address.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    addressTab === address.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  {customerAddressDisplayTitle(address)}
                </button>
              ))}

            <button
              type="button"
              onClick={() => void openNewAddress()}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              + Adres Ekle
            </button>
          </div>

          {addressTab === "PRIMARY" ? (
          <form id="cariEditForm" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Temel Bilgiler */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2">Temel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cari Adı / Ünvanı *</label>
                  <input required name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cari Kodu</label>
                  <input name="customerCode" value={formData.customerCode || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cari Tipi</label>
                  <select name="cariType" value={formData.cariType || 'CUSTOMER'} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500">
                    <option value="CUSTOMER">Müşteri</option>
                    <option value="SUPPLIER">Tedarikçi</option>
                    <option value="TAILOR">Terzi / Atölye</option>
                    <option value="INSTALLER">Montaj Ekibi</option>
                    <option value="STAFF">Personel</option>
                    <option value="OTHER">Diğer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Grup Kodu</label>
                  <input name="groupCode" value={formData.groupCode || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Grup Adı</label>
                  <input name="groupName" value={formData.groupName || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cari Yetkili Adı</label>
                  <input name="authorizedPerson" value={formData.authorizedPerson || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* İletişim & Adres */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2">İletişim & Adres</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Ana Telefon</label>
                  <input name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cep Tel 1</label>
                  <input name="mobile1" value={formData.mobile1 || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Cep Tel 2</label>
                  <input name="mobile2" value={formData.mobile2 || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">E-Mail</label>
                  <input name="email" type="email" value={formData.email || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Açık Adres</label>
                  <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Konum (Harita Linki)</label>
                  <input name="mapLocation" value={formData.mapLocation || ''} onChange={handleChange} placeholder="https://maps.google.com/..." className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            {/* Finansal & Opak */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2">Finans & Opak Bilgileri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Bakiye</label>
                  <input name="balance" type="number" step="0.01" value={formData.balance ?? ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Vergi Dairesi</label>
                  <input name="taxOffice" value={formData.taxOffice || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Vergi No</label>
                  <input name="taxNumber" value={formData.taxNumber || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Kimlik No (TC)</label>
                  <input name="identityNumber" value={formData.identityNumber || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Vade Günü</label>
                  <input name="dueDay" type="number" value={formData.dueDay ?? ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Plasiyer Adı</label>
                  <input name="salespersonName" value={formData.salespersonName || ''} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" checked={formData.isActive !== false} onChange={handleChange} className="w-4 h-4 text-blue-600" />
                  Aktif Cari
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="eInvoice" checked={!!formData.eInvoice} onChange={handleChange} className="w-4 h-4 text-blue-600" />
                  E-Fatura Mükellefi
                </label>
                <label className="flex items-center gap-2 text-sm text-amber-700">
                  <input type="checkbox" name="hasRisk" checked={!!formData.hasRisk} onChange={handleChange} className="w-4 h-4 text-amber-600" />
                  Risk Var
                </label>
                <label className="flex items-center gap-2 text-sm text-red-700">
                  <input type="checkbox" name="isLockedForAllTransactions" checked={!!formData.isLockedForAllTransactions} onChange={handleChange} className="w-4 h-4 text-red-600" />
                  Tüm İşlemlerde Kilit
                </label>
              </div>
            </div>

            {/* Notlar */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2">Notlar</h3>
              <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:border-blue-500" />
            </div>

          </form>
          ) : selectedExtraAddress ? (
            <section
              data-cari-edit-extra-address-v1
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    {customerAddressDisplayTitle(selectedExtraAddress)}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Bu adresin odalari bu adres kimligi ile bagli kalir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openEditAddress(selectedExtraAddress)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <Edit3 className="h-4 w-4" />
                  D&uuml;zenle
                </button>
              </div>

              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-gray-500">Telefon</dt>
                  <dd className="mt-1 text-gray-900 dark:text-white">
                    {selectedExtraAddress.phone || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-500">Il / Ilce</dt>
                  <dd className="mt-1 text-gray-900 dark:text-white">
                    {[selectedExtraAddress.province, selectedExtraAddress.district]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-gray-500">Adres</dt>
                  <dd className="mt-1 text-gray-900 dark:text-white">
                    {selectedExtraAddress.address || "-"}
                  </dd>
                </div>
              </dl>
            </section>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Secili adres artik aktif degil. Ana Adres sekmesine donun.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-2xl flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            İptal
          </button>
          {addressTab === "PRIMARY" && (
          <button
            type="submit"
            form="cariEditForm"
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? "Kaydediliyor..." : "Tüm Değişiklikleri Kaydet"}
            {!isSaving && <Save className="w-4 h-4" />}
          </button>
          )}
        </div>
      </div>
      <CustomerAddressModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
        }}
        address={editingAddress}
        onSave={saveCustomerAddress}
      />
    </div>
  );
}
