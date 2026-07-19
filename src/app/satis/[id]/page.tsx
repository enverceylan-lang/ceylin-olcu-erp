"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Trash2, Edit2, CheckCircle, Calculator } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useSalesStore, Sale, SaleStatus, SaleItem } from "@/store/salesStore";

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const id = unwrappedParams.id;

  const router = useRouter();
  const { customers } = useStore();
  const { sales, loadSales, updateSale, removeSale, isLoading } = useSalesStore();

  const [mounted, setMounted] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  
  // Local form state
  const [cashPrice, setCashPrice] = useState(0);
  const [installmentPrice, setInstallmentPrice] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  
  useEffect(() => {
    loadSales().then(() => setMounted(true));
  }, [loadSales]);

  useEffect(() => {
    if (mounted && !isLoading) {
      const found = sales.find(s => s.id === id);
      if (found) {
        setSale(JSON.parse(JSON.stringify(found))); // deep copy for local edit
        setCashPrice(found.cashPrice);
        setInstallmentPrice(found.installmentPrice);
        setDownPayment(found.downPayment);
        setGlobalDiscount(found.discount);
      }
    }
  }, [mounted, isLoading, sales, id]);

  if (!mounted || isLoading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (!sale) return <div className="p-8 text-center text-red-500">Kayıt bulunamadı.</div>;

  const customer = customers.find(c => c.id === sale.customerId);

  const calculateRowTotal = (item: SaleItem) => {
    const rawTotal = item.unitPrice * item.metricSize * item.quantity;
    return rawTotal - (item.discount || 0);
  };

  const handleRowChange = (index: number, field: keyof SaleItem, value: number) => {
    const newItems = [...sale.items];
    const item = { ...newItems[index], [field]: value };
    item.rowTotal = calculateRowTotal(item);
    newItems[index] = item;
    
    // Recalculate global total
    const totalAmount = newItems.reduce((acc, curr) => acc + curr.rowTotal, 0);
    setSale({ ...sale, items: newItems, totalAmount });
  };

  const getRemainingBalance = () => {
    const baseTotal = sale.totalAmount;
    const finalTotal = baseTotal - globalDiscount;
    return finalTotal - downPayment;
  };

  const handleSave = async () => {
    try {
      const updatedSale: Sale = {
        ...sale,
        cashPrice,
        installmentPrice,
        downPayment,
        discount: globalDiscount,
        remainingBalance: getRemainingBalance(),
        updatedAt: new Date().toISOString()
      };
      await updateSale(updatedSale);
      alert("Satış kaydedildi!");
    } catch (err) {
      console.error(err);
      alert("Hata oluştu.");
    }
  };

  const handleDelete = async () => {
    if (confirm("Bu satış kaydını silmek istediğinize emin misiniz?")) {
      await removeSale(sale.id);
      router.push("/satis");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/satis" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold heading-title">{sale.saleNo}</h1>
            <p className="text-sm heading-subtitle">{customer?.name || "Bilinmiyor"}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold shadow-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Sil
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            Kaydet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content: Sale Items */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Ürün Kalemleri</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Oda / Pencere</th>
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3 text-right">Ölçü ({sale.items[0]?.metricUnit || 'br'})</th>
                    <th className="px-4 py-3 text-right">Miktar</th>
                    <th className="px-4 py-3 text-right">Birim Fiyat</th>
                    <th className="px-4 py-3 text-right">İskonto</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sale.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{item.roomName}</div>
                        <div className="text-xs text-gray-500">{item.windowName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded text-xs font-semibold">
                          {item.productType || item.productGroup || 'Ürün'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number"
                          value={item.metricSize}
                          onChange={e => handleRowChange(idx, 'metricSize', parseFloat(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number"
                          value={item.quantity}
                          onChange={e => handleRowChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-16 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number"
                          value={item.unitPrice}
                          onChange={e => handleRowChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input 
                          type="number"
                          value={item.discount}
                          onChange={e => handleRowChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-red-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                        {item.rowTotal.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                      </td>
                    </tr>
                  ))}
                  {sale.items.length === 0 && (
                     <tr><td colSpan={7} className="text-center py-4">Kalem yok</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: Totals & Status */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Genel Toplam</h2>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Ara Toplam</span>
                <span>{sale.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
              </div>
              
              <div className="flex justify-between items-center text-red-600">
                <span>Genel İskonto</span>
                <input 
                  type="number"
                  value={globalDiscount}
                  onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Net Toplam</span>
                <span>{(sale.totalAmount - globalDiscount).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
              </div>

              <div className="flex justify-between items-center text-green-600 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Kapora (Alınan)</span>
                <input 
                  type="number"
                  value={downPayment}
                  onChange={e => setDownPayment(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-between font-bold text-orange-600 text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Kalan Bakiye</span>
                <span>{getRemainingBalance().toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
             <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Durum</h2>
             <select
                value={sale.status}
                onChange={e => setSale({...sale, status: e.target.value as SaleStatus})}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg p-2.5"
             >
                <option value="TASLAK">Taslak</option>
                <option value="TEKLİF">Teklif</option>
                <option value="ONAYLANDI">Onaylandı</option>
                <option value="SİPARİŞ">Sipariş</option>
                <option value="ÜRETİME_GÖNDERİLDİ">Üretime Gönderildi</option>
                <option value="MONTAJA_GÖNDERİLDİ">Montaja Gönderildi</option>
                <option value="TAMAMLANDI">Tamamlandı</option>
                <option value="İPTAL">İptal</option>
             </select>
          </div>
        </div>
      </div>
    </div>
  );
}
