"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, Trash2, Edit2, CheckCircle, Calculator } from "lucide-react";
import { FileDown } from "lucide-react";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { useSalesStore, Sale, SaleStatus, SaleItem, PaymentMethod } from "@/store/salesStore";
import InstallmentPlanPanel from "@/components/sales/InstallmentPlanPanel";
import { generateSalesPdfFile, openSalesPdfPreview } from "@/lib/salesPdfGenerator";
import { prepareSaleForApproval } from "@/lib/salesApproval";

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
  const [downPaymentMethod, setDownPaymentMethod] =
    useState<PaymentMethod | "">("");
  const [generalDueDate, setGeneralDueDate] =
    useState("");
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
        setDownPaymentMethod(found.downPaymentMethod || "");
        setGeneralDueDate(
          found.generalDueDate || ""
        );
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

  const saleForFinance: Sale = {
    ...sale,
    discount: globalDiscount,
    downPayment,
    downPaymentMethod: downPaymentMethod || undefined,
    generalDueDate:
      generalDueDate || undefined,
    remainingBalance: getRemainingBalance()
  };

  const handleSave = async () => {
    if (
      Number(downPayment || 0) > 0 &&
      !downPaymentMethod
    ) {
      alert("Peşinat ödeme yöntemini seçiniz.");
      return;
    }

    const openBalance =
      getRemainingBalance();

    if (
      openBalance > 0 &&
      Number(downPayment || 0) <= 0 &&
      !generalDueDate
    ) {
      alert(
        "Peşinat yoksa genel vade tarihi zorunludur."
      );
      return;
    }

    try {
      const updatedSale: Sale = {
        ...sale,
        cashPrice,
        installmentPrice,
        downPayment,
        downPaymentMethod:
          Number(downPayment || 0) > 0
            ? downPaymentMethod || undefined
            : undefined,
        generalDueDate:
          generalDueDate || undefined,
        discount: globalDiscount,
        remainingBalance: getRemainingBalance(),
        updatedAt: new Date().toISOString()
      };

      await updateSale(updatedSale);
      router.replace("/satis");
    } catch (error) {
      console.error(
        "[Sales] Satış kaydedilemedi.",
        error
      );

      alert(
        "Satış kaydedilemedi. Kayıt ekranı açık bırakıldı."
      );
    }
  };
  const handleSendApprovalWhatsApp = async () => {
    try {
      if (!customer?.phone) {
        alert("Müşteri telefon numarası bulunamadı.");
        return;
      }

      const prepared = prepareSaleForApproval({
        sale: saleForFinance,
        origin: window.location.origin,
        customerName: customer.name || "Müşteri",
        customerPhone: customer.phone
      });

      await updateSale(prepared.sale);
      setSale(JSON.parse(JSON.stringify(prepared.sale)));
      window.open(
        prepared.whatsappUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "[Sales Approval] WhatsApp onay bağlantısı hazırlanamadı.",
        error
      );
      alert("WhatsApp müşteri onayı hazırlanamadı.");
    }
  };

  const handlePreviewPdf = async () => {
    const previewWindow =
      window.open(
        '',
        '_blank',
        'noopener,noreferrer'
      );

    if (!previewWindow) {
      alert(
        "PDF önizleme açılamadı. Tarayıcı açılır pencere iznini etkinleştirin."
      );
      return;
    }

    previewWindow.document.write(
      '<!doctype html>' +
      '<html lang="tr">' +
      '<head>' +
      '<meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<title>Satış PDF hazırlanıyor</title>' +
      '</head>' +
      '<body style="font-family:Arial,sans-serif;padding:24px;text-align:center">' +
      '<p>Satış PDF hazırlanıyor...</p>' +
      '</body>' +
      '</html>'
    );

    previewWindow.document.close();

    try {
      const currentSale: Sale = {
        ...saleForFinance,
        updatedAt: new Date().toISOString(),
        pdfGeneratedAt: new Date().toISOString()
      };

      const file = await generateSalesPdfFile(
        currentSale,
        customer
      );

      openSalesPdfPreview(
        file,
        previewWindow
      );

      const saleWithPdf: Sale = {
        ...currentSale,
        pdfFileName: file.name
      };

      setSale(saleWithPdf);
      await updateSale(saleWithPdf);
    } catch (error) {
      if (!previewWindow.closed) {
        previewWindow.close();
      }

      console.error(
        "[Sales PDF] PDF önizlemesi oluşturulamadı.",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Satış PDF'si oluşturulamadı."
      );
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
            type="button"
            onClick={handleSendApprovalWhatsApp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 font-bold shadow-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Onay
          </button>
          <button
            type="button"
            onClick={handlePreviewPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold shadow-sm transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF Görüntüle
          </button>
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
            Kaydet ve Çık
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
                    <th className="px-4 py-3 text-right">Birim</th>
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
                          step="0.01"
                          value={Number(Number(item.metricSize || 0).toFixed(2))}
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

              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center text-green-600">
                  <span>Peşinat</span>

                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={downPayment}
                    onChange={event => {
                      const value = Math.max(
                        0,
                        parseFloat(event.target.value) || 0
                      );

                      setDownPayment(value);

                      if (value === 0) {
                        setDownPaymentMethod("");
                      }
                    }}
                    className="w-28 text-right border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
                  />
                </div>

                {downPayment > 0 && (
                  <label className="block space-y-1">
                    <span className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Peşinat Ödeme Yöntemi
                    </span>

                    <select
                      value={downPaymentMethod}
                      onChange={event =>
                        setDownPaymentMethod(
                          event.target.value as PaymentMethod
                        )
                      }
                      className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg p-2"
                    >
                      <option value="">
                        Ödeme yöntemi seçiniz
                      </option>

                      <option value="NAKIT">
                        Nakit
                      </option>

                      <option value="KART">
                        Kredi Kartı
                      </option>

                      <option value="HAVALE">
                        Banka Havalesi
                      </option>
                    </select>
                  </label>
                )}
              </div>
              <label className="block space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Genel Ödeme Vadesi
                </span>

                <input
                  type="date"
                  value={generalDueDate}
                  onChange={event =>
                    setGeneralDueDate(
                      event.target.value
                    )
                  }
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg p-2"
                />

                {
                  getRemainingBalance() > 0 &&
                  downPayment <= 0 &&
                  !generalDueDate && (
                    <span className="block text-xs text-red-600">
                      Peşinat yoksa zorunludur.
                    </span>
                  )
                }
              </label>

              <div className="flex justify-between font-bold text-orange-600 text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>Kalan Bakiye</span>
                <span>{getRemainingBalance().toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
              </div>
            </div>
          </div>

          <InstallmentPlanPanel
            sale={saleForFinance}
            onChange={updatedSale => {
              setSale(updatedSale);
              setDownPayment(updatedSale.downPayment);
              setGlobalDiscount(updatedSale.discount);
            }}
          />

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
