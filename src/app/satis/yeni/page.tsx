"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus, Trash2, HelpCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore, SaleItem, generateUUID } from "@/store/useStore";
import { getMeasurementDimensions, calculateFabricUsage, getTemplateLabel } from "@/lib/measurementAdapter";
import { useMeasurementStore } from "@/store/measurementStore";

interface SalesRow extends SaleItem {
  customerId?: string;
  roomId?: string;
  openingId?: string;
  measurementId?: string;
  templateType?: string;
  rawValues?: Record<string, any>;
  measuredById?: string;
  measuredDate?: string;
  photoCount?: number;
  videoCount?: number;
}

export default function YeniSatisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId');

  const { customers, products, addSale } = useStore();
  const { measurements } = useMeasurementStore();
  const [mounted, setMounted] = useState(false);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || "");
  const [saleItems, setSaleItems] = useState<SalesRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };
  
  useEffect(() => {
    setMounted(true);
    if (!preselectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, preselectedCustomerId]);

  // When customer changes, auto-load their advanced measurements into sales rows
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer && customer.rooms.length > 0) {
        const initialItems: SalesRow[] = [];
        
        customer.rooms.forEach(room => {
          room.windows.forEach(window => {
            const winMeasurements = measurements.filter(m => m.windowId === window.id && m.customerId === customer.id && !m.isDeleted && !m.isArchived);
            winMeasurements.forEach(p => {
              const dims = getMeasurementDimensions(p);
              
              // Only auto-select product if it is assigned (productId matches or productType matches category)
              let preselectedProduct = products.find(prod => prod.id === p.productId);
              if (!preselectedProduct && p.productType) {
                preselectedProduct = products.find(prod => 
                  prod.name.toLowerCase() === p.productType?.toLowerCase() || 
                  prod.category.toLowerCase() === p.productType?.toLowerCase()
                );
              }
              
              const productId = preselectedProduct ? preselectedProduct.id : "";
              const unitPrice = preselectedProduct ? preselectedProduct.cashPrice : 0;
              
              const photoCount = (window.photos || []).length + (p.photos || []).length;
              const videoCount = (window.videos || []).length + (p.videos || []).length;

              initialItems.push({
                id: generateUUID(),
                roomName: room.name,
                windowName: window.name,
                productGroup: p.productGroup || "",
                productType: p.productType || "",
                width: dims.structuralWidth, // Derived structural width
                height: dims.structuralHeight, // Derived structural height
                productId: productId,
                quantity: 0,
                unitPrice: unitPrice,
                totalPrice: 0,
                pleatType: p.details?.pile || 'NORMAL',
                wingQuantity: 1,
                
                customerId: customer.id,
                roomId: room.id,
                openingId: window.id,
                measurementId: p.id,
                templateType: dims.templateType,
                rawValues: p.rawValues,
                measuredById: p.measuredById,
                measuredDate: p.measuredDate,
                originalWidth: dims.structuralWidth,
                originalHeight: dims.structuralHeight,
                photoCount,
                videoCount
              });
            });
          });
        });
        
        // Calculate all rows
        setSaleItems(initialItems.map(item => calculateRow(item, products)));
      } else {
        setSaleItems([]);
      }
    }
  }, [selectedCustomerId, customers, products, measurements]);

  // The Calculation Engine using the shared calculateFabricUsage helper
  const calculateRow = (item: SalesRow, allProducts = products): SalesRow => {
    const product = allProducts.find(p => p.id === item.productId);
    if (!product) {
      return { ...item, quantity: 0, totalPrice: 0, calculationType: 'UNIT' };
    }

    // Pass original values to calculation or fall back to current width/height
    const netWidth = item.originalWidth !== undefined ? item.originalWidth : item.width;
    const netHeight = item.originalHeight !== undefined ? item.originalHeight : item.height;

    const calc = calculateFabricUsage(
      product.category,
      netWidth,
      netHeight,
      item.pleatType,
      item.wingQuantity
    );

    const quantity = calc.fabricUsageMeters;
    const totalPrice = Number((quantity * item.unitPrice).toFixed(2));

    return { 
      ...item, 
      quantity, 
      totalPrice, 
      calculationType: calc.calculationType,
      width: calc.cuttingWidth, // Updates with allowance/multiplier cutting width
      productGroup: product.category,
      productType: product.name
    };
  };

  const updateItem = (itemId: string, updates: Partial<SalesRow>) => {
    setSaleItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updated = { ...item, ...updates };
        
        // If product changed, auto-update unit price
        if ('productId' in updates) {
          const prod = products.find(p => p.id === updates.productId);
          if (prod) {
            updated.unitPrice = prod.cashPrice;
            updated.productGroup = prod.category;
            updated.productType = prod.name;
          } else {
            updated.unitPrice = 0;
            updated.productGroup = "";
            updated.productType = "";
          }
        }

        return calculateRow(updated);
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setSaleItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Add Product under existing measurement
  const addProductToWindow = (roomName: string, windowName: string, roomId: string, openingId: string, measurementId: string, originalWidth: number, originalHeight: number) => {
    const newItem: SalesRow = {
      id: generateUUID(),
      roomName,
      windowName,
      productGroup: "",
      productType: "",
      width: originalWidth,
      height: originalHeight,
      productId: "",
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
      pleatType: 'NORMAL',
      wingQuantity: 1,

      customerId: selectedCustomerId,
      roomId,
      openingId,
      measurementId,
      originalWidth,
      originalHeight,
      calculationType: 'UNIT'
    };
    setSaleItems(prev => [...prev, newItem]);
  };

  // Add a fully manual item (Odasız Ek Kalem)
  const addNewBlankRow = () => {
    const newItem: SalesRow = {
      id: generateUUID(),
      roomName: "Odasız",
      windowName: "Ek Kalem",
      productGroup: "Ekstra",
      productType: "Ekstra",
      width: 100,
      height: 200,
      productId: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      pleatType: 'NORMAL',
      wingQuantity: 1,
      calculationType: 'UNIT'
    };
    setSaleItems(prev => [...prev, newItem]);
  };

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const grandTotal = saleItems.reduce((acc, item) => acc + item.totalPrice, 0);

  const handleSave = () => {
    if (isSaving) return;
    if (!selectedCustomerId) {
      showToast("Lütfen müşteri seçiniz.");
      return;
    }
    if (saleItems.length === 0) {
      showToast("Satışta hiç ürün yok.");
      return;
    }
    
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;

    setIsSaving(true);
    try {
      addSale({
        customerId: selectedCustomerId,
        amount: grandTotal,
        items: saleItems,
        address: customer.address || "Adres Belirtilmemiş"
      });
      router.push("/satis");
    } catch (err) {
      console.error(err);
      showToast("Satış kaydedilirken bir hata oluştu.");
      setIsSaving(false);
    }
  };

  const customer = customers.find(c => c.id === selectedCustomerId);

  // Filter items that don't belong to any room/opening measurement (manual items)
  const manualItems = saleItems.filter(item => !item.measurementId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-24 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/satis" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold heading-title">Gelişmiş Satış & Hesaplama (V2)</h1>
            <p className="text-sm heading-subtitle">Pencerelere birden fazla tül, güneşlik veya fon ekleyin ve hesaplayın.</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={saleItems.length === 0 || isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg transition-colors font-bold shadow-md text-sm cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Satışı Kaydet
            </>
          )}
        </button>
      </div>

      {/* Customer Selection */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="max-w-md space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Cari Seçimi (Ölçüleri Otomatik Yükler)</label>
          {customers.length === 0 ? (
            <div className="text-sm text-red-500 bg-red-50/10 p-3 rounded-lg border border-red-500/20">Önce müşteri eklemelisiniz.</div>
          ) : (
            <select 
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="" disabled>Müşteri Seçin...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Nested Rooms and Windows Layout */}
      {customer && customer.rooms.length > 0 ? (
        <div className="space-y-6">
          {customer.rooms.map(room => {
            // Find windows in this room that have measurements
            if (room.windows.length === 0) return null;

            return (
              <div key={room.id} className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-5 shadow-sm">
                {/* Room Header */}
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-600/20">
                    Oda: {room.name}
                  </span>
                </div>

                {/* Windows list */}
                <div className="grid grid-cols-1 gap-6">
                  {room.windows.map(window => {
                    const winMeasurements = measurements.filter(m => m.windowId === window.id && m.customerId === selectedCustomerId && !m.isDeleted && !m.isArchived);
                    return winMeasurements.map(p => {
                      const dims = getMeasurementDimensions(p);
                      
                      // Find items belonging to this measurement
                      const windowRows = saleItems.filter(item => item.measurementId === p.id);

                      return (
                        <div key={p.id} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                          {/* Window Info Header */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                            <div>
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                {window.name}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Ölçü Tipi: <span className="font-semibold">{getTemplateLabel(p.templateType)}</span>
                                {p.measuredDate && ` • Ölçüm Tarihi: ${p.measuredDate}`}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2.5">
                              {((window.photos || []).length > 0 || (p.photos || []).length > 0) && (
                                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-md">
                                  📷 {(window.photos || []).length + (p.photos || []).length} Fotoğraf
                                </span>
                              )}
                              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm">
                                Net Ölçü: {dims.rawWidth} × {dims.rawHeight} cm
                              </div>
                            </div>
                          </div>

                          {/* Sibling Products table */}
                          {windowRows.length === 0 ? (
                            <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 italic bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                              Bu pencere için henüz ürün eklenmedi.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse min-w-[1000px] text-xs">
                                <thead>
                                  <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 font-bold">
                                    <th className="py-2.5 px-3">Ürün</th>
                                    <th className="py-2.5 px-3 w-52">Hesaplama / Pile</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Net En (cm)</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Kesim / Alan</th>
                                    <th className="py-2.5 px-3 w-28 text-right">Miktar (m/m²)</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Birim Fiyat</th>
                                    <th className="py-2.5 px-3 w-32 text-right">Tutar</th>
                                    <th className="py-2.5 px-3 w-12 text-center">Sil</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {windowRows.map(item => {
                                    const prod = products.find(pr => pr.id === item.productId);
                                    const cat = (prod?.category || "").toLowerCase();
                                    
                                    return (
                                      <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 transition-colors">
                                        {/* Product Selector */}
                                        <td className="py-3 px-3">
                                          <select
                                            value={item.productId}
                                            onChange={(e) => updateItem(item.id, { productId: e.target.value })}
                                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none text-gray-900 dark:text-white"
                                          >
                                            <option value="">-- Ürün Seçiniz --</option>
                                            {products.map(pOpt => (
                                              <option key={pOpt.id} value={pOpt.id}>
                                                [{pOpt.category}] {pOpt.name}
                                              </option>
                                            ))}
                                          </select>
                                        </td>

                                        {/* Dynamic Calc Parameter Selector */}
                                        <td className="py-3 px-3">
                                          {cat === 'tül' ? (
                                            <select
                                              value={item.pleatType}
                                              onChange={(e) => updateItem(item.id, { pleatType: e.target.value })}
                                              className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none"
                                            >
                                              <option value="SPARSE">Seyrek Pile (x2.1)</option>
                                              <option value="NORMAL">Normal Pile (x2.6)</option>
                                              <option value="TIGHT">Sık Pile (x3.1)</option>
                                            </select>
                                          ) : cat === 'güneşlik' ? (
                                            <div className="flex flex-col gap-1 text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-500/5 border border-orange-500/10 p-1.5 rounded-lg">
                                              <span>• Düz Dikim</span>
                                              <span>• Pile Uygulanmaz (+30cm Pay)</span>
                                            </div>
                                          ) : cat === 'fon' ? (
                                            <div className="flex items-center gap-2">
                                              <span className="shrink-0 font-bold text-gray-400">Kanat:</span>
                                              <select
                                                value={item.wingQuantity || 1}
                                                onChange={(e) => updateItem(item.id, { wingQuantity: Number(e.target.value) })}
                                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none"
                                              >
                                                {[1, 2, 3, 4, 5, 6].map(n => (
                                                  <option key={n} value={n}>{n} Kanat (x2.5)</option>
                                                ))}
                                              </select>
                                            </div>
                                          ) : cat === 'zebra' || cat === 'stor' || cat === 'jaluzi' || cat === 'plicell' ? (
                                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-500/5 border border-blue-500/10 p-1.5 rounded-lg">
                                              Mekanik Üretim (Min 2.0 m²)
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 italic">Düz Hesaplama</span>
                                          )}
                                        </td>

                                        {/* Original Net Width */}
                                        <td className="py-3 px-3 text-center font-medium">
                                          <input
                                            type="number"
                                            value={item.originalWidth !== undefined ? item.originalWidth : item.width}
                                            onChange={(e) => updateItem(item.id, { originalWidth: Number(e.target.value) })}
                                            className="w-16 p-1 text-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none"
                                            title="Özgün En"
                                          />
                                          <span className="text-gray-400 dark:text-gray-600 ml-1">cm</span>
                                        </td>

                                        {/* Computed Width / Cutting Width */}
                                        <td className="py-3 px-3 text-center text-gray-500 font-medium">
                                          {cat === 'güneşlik' ? (
                                            <span className="font-bold text-gray-900 dark:text-white">
                                              {item.width} <span className="text-[10px] text-gray-400">cm</span>
                                            </span>
                                          ) : cat === 'tül' ? (
                                            <span className="font-bold text-gray-900 dark:text-white">
                                              {item.width} <span className="text-[10px] text-gray-400">cm</span>
                                            </span>
                                          ) : (
                                            <span>--</span>
                                          )}
                                        </td>

                                        {/* Fabric Quantity */}
                                        <td className="py-3 px-3 text-right">
                                          <span className="bg-blue-500/10 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold px-2 py-1 rounded border border-blue-500/20">
                                            {item.quantity.toFixed(2)} {cat === 'zebra' || cat === 'stor' || cat === 'jaluzi' || cat === 'plicell' ? 'm²' : 'm'}
                                          </span>
                                        </td>

                                        {/* Unit Price */}
                                        <td className="py-3 px-3 text-right">
                                          <div className="flex items-center gap-1.5 justify-end">
                                            <input
                                              type="number"
                                              value={item.unitPrice}
                                              onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                                              className="w-20 p-1 text-right bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none font-medium"
                                            />
                                            <span className="text-gray-400">₺</span>
                                          </div>
                                        </td>

                                        {/* Total Price */}
                                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                                          ₺{item.totalPrice.toFixed(2)}
                                        </td>

                                        {/* Delete Action */}
                                        <td className="py-3 px-3 text-center">
                                          <button 
                                            onClick={() => removeItem(item.id)}
                                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Add Product Button */}
                          <div className="pt-2">
                            <button
                              onClick={() => addProductToWindow(room.name, window.name, room.id, window.id, p.id, dims.structuralWidth, dims.structuralHeight)}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/30 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" /> Ürün Ekle
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedCustomerId && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500 italic">
          Bu müşteriye ait odalanmış pencere ölçüsü bulunamadı. Aşağıdan bağımsız ek kalemler ekleyebilirsiniz.
        </div>
      )}

      {/* Manual Items Card ("Odasız Ek Kalemler") */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            Odasız Ek Kalemler (Aksesuar, Montaj, Rustik vb.)
          </h3>
        </div>

        {manualItems.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">Ekstra kalem eklenmedi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px] text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 font-bold">
                  <th className="py-2.5 px-3">Grup / Detay</th>
                  <th className="py-2.5 px-3">Ürün</th>
                  <th className="py-2.5 px-3 w-52">Hesaplama / Pile</th>
                  <th className="py-2.5 px-3 w-28 text-center">En (cm)</th>
                  <th className="py-2.5 px-3 w-28 text-center">Boy (cm)</th>
                  <th className="py-2.5 px-3 w-28 text-right">Miktar (m/m²)</th>
                  <th className="py-2.5 px-3 w-32 text-right">Birim Fiyat</th>
                  <th className="py-2.5 px-3 w-32 text-right">Tutar</th>
                  <th className="py-2.5 px-3 w-12 text-center">Sil</th>
                </tr>
              </thead>
              <tbody>
                {manualItems.map(item => {
                  const prod = products.find(pr => pr.id === item.productId);
                  const cat = (prod?.category || "").toLowerCase();

                  return (
                    <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-amber-500/5 transition-colors">
                      {/* Name / Location description inputs */}
                      <td className="py-3 px-3">
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={item.roomName}
                            onChange={(e) => updateItem(item.id, { roomName: e.target.value })}
                            className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded p-1 font-bold w-20"
                            placeholder="Grup"
                          />
                          <input
                            type="text"
                            value={item.windowName}
                            onChange={(e) => updateItem(item.id, { windowName: e.target.value })}
                            className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded p-1 w-28"
                            placeholder="Detay"
                          />
                        </div>
                      </td>

                      {/* Product Selection */}
                      <td className="py-3 px-3">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(item.id, { productId: e.target.value })}
                          className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none"
                        >
                          <option value="">-- Ürün Seçiniz --</option>
                          {products.map(pOpt => (
                            <option key={pOpt.id} value={pOpt.id}>
                              [{pOpt.category}] {pOpt.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Calcs */}
                      <td className="py-3 px-3">
                        {cat === 'tül' ? (
                          <select
                            value={item.pleatType}
                            onChange={(e) => updateItem(item.id, { pleatType: e.target.value })}
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none"
                          >
                            <option value="SPARSE">Seyrek Pile (x2.1)</option>
                            <option value="NORMAL">Normal Pile (x2.6)</option>
                            <option value="TIGHT">Sık Pile (x3.1)</option>
                          </select>
                        ) : cat === 'güneşlik' ? (
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold bg-orange-500/5 border border-orange-500/10 p-1.5 rounded-lg block text-center">
                            Düz Dikim (+30cm)
                          </span>
                        ) : cat === 'fon' ? (
                          <select
                            value={item.wingQuantity || 1}
                            onChange={(e) => updateItem(item.id, { wingQuantity: Number(e.target.value) })}
                            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 outline-none"
                          >
                            {[1, 2, 3, 4, 5, 6].map(n => (
                              <option key={n} value={n}>{n} Kanat (x2.5)</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-400 italic">Düz Hesaplama</span>
                        )}
                      </td>

                      {/* En */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            value={item.width}
                            onChange={(e) => updateItem(item.id, { width: Number(e.target.value) })}
                            className="w-16 p-1 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none"
                          />
                          <span className="text-gray-400">cm</span>
                        </div>
                      </td>

                      {/* Boy */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            value={item.height}
                            onChange={(e) => updateItem(item.id, { height: Number(e.target.value) })}
                            className="w-16 p-1 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none"
                          />
                          <span className="text-gray-400">cm</span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="py-3 px-3 text-right">
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-1 rounded border border-amber-500/20">
                          {item.quantity.toFixed(2)}
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) })}
                            className="w-20 p-1 text-right bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded outline-none font-medium"
                          />
                          <span className="text-gray-400">₺</span>
                        </div>
                      </td>

                      {/* Total Price */}
                      <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                        ₺{item.totalPrice.toFixed(2)}
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-3 text-center">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button 
          onClick={addNewBlankRow}
          className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-bold bg-amber-500/5 dark:bg-amber-950/20 px-3 py-1.5 rounded-lg border border-amber-500/20 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Ek Kalem Ekle
        </button>
      </div>

      {/* Grand Total Area */}
      <div className="flex justify-end">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-xl text-white min-w-[320px] border border-gray-800">
          <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Genel Sipariş Toplamı</h2>
          <div className="text-4xl font-extrabold text-green-400 flex items-baseline gap-1">
            <span className="text-2xl font-bold">₺</span>{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm flex items-center gap-2 border border-gray-800 animate-slide-up">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
