"use client";

import React, { useState, useEffect } from "react";
import { Factory, Search, ChevronDown, ChevronUp, Check, AlertTriangle, AlertCircle, RefreshCw, Clock, Scissors, Package, CheckCircle2, DollarSign, Image as ImageIcon, Plus, X } from "lucide-react";
import { useStore, ProductionItem, ProductionIssue, Sale } from "@/store/useStore";
import { getTemplateLabel } from "@/lib/measurementAdapter";
import { MOCK_USERS } from "@/store/useAuthStore";

const STATUS_LABELS: Record<string, string> = {
  WAITING_MATERIAL: "Malzeme Bekliyor",
  WAITING_FACTORY: "Fabrikadan Bekleniyor",
  READY_FOR_CUTTING: "Kesim Bekliyor",
  CUT: "Kesildi",
  SEWING: "Dikimde",
  SEWN: "Dikildi",
  IRONING: "Ütüde",
  PACKAGING: "Paketleniyor",
  READY: "Hazır",
  PROBLEM: "Sorun Var",
  REWORK: "Yeniden Yapılacak",
  CANCELLED: "İptal"
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

const getStatusBadgeColorClass = (status: string) => {
  switch (status) {
    case "WAITING_MATERIAL":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
    case "WAITING_FACTORY":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30";
    case "READY_FOR_CUTTING":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30";
    case "CUT":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30";
    case "SEWING":
      return "bg-pink-500/10 text-pink-650 border-pink-500/20 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/30";
    case "SEWN":
      return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30";
    case "IRONING":
      return "bg-sky-500/10 text-sky-550 border-sky-500/20 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30";
    case "PACKAGING":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
    case "READY":
      return "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30";
    case "PROBLEM":
      return "bg-red-500/10 text-red-550 border-red-500/20 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30";
    case "REWORK":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
    case "CANCELLED":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/30";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

const WORKSHOPS = [
  { id: "atolye-a", name: "Atölye A (Tül & Fon)" },
  { id: "atolye-b", name: "Atölye B (Stor & Zebra)" },
  { id: "atolye-c", name: "Atölye C (Plicell & Mekanik)" }
];

export default function UretimPage() {
  const { sales, customers, products, productionItems, setProductionItems, updateProductionItem } = useStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  
  // Issue Modal State
  const [issueModalItem, setIssueModalItem] = useState<ProductionItem | null>(null);
  const [issueType, setIssueType] = useState("Malzeme Eksik");
  const [issueDescription, setIssueDescription] = useState("");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState("");
  const [expectedResolutionDate, setExpectedResolutionDate] = useState("");
  const [expectedMaterialArrivalDate, setExpectedMaterialArrivalDate] = useState("");
  const [additionalCost, setAdditionalCost] = useState(0);
  const [isReworkType, setIsReworkType] = useState(false); // If true, sets status to REWORK, else PROBLEM

  // Sewing Fee inline editor state
  const [editingFeeItemId, setEditingFeeItemId] = useState<string | null>(null);
  const [tempSewingFee, setTempSewingFee] = useState("");
  const [tempExtraFee, setTempExtraFee] = useState("");

  // Migration Effect: create production items for legacy sales orders if missing
  useEffect(() => {
    setMounted(true);
    
    const migratedItems: ProductionItem[] = [];
    let needsMigration = false;
    
    sales.forEach(sale => {
      const hasItems = productionItems.some(pi => pi.orderId === sale.id);
      if (!hasItems && sale.items && sale.items.length > 0) {
        needsMigration = true;
        sale.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const productName = prod ? prod.name : item.productType || 'Bilinmeyen Ürün';
          const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR');

          migratedItems.push({
            id: crypto.randomUUID(),
            orderId: sale.id,
            saleLineId: item.id,
            customerId: sale.customerId,
            roomName: item.roomName,
            openingName: item.windowName,
            productName: productName,
            productType: item.productType || item.productGroup || 'Ürün',
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            pleatType: item.pleatType,
            productionStatus: 'READY_FOR_CUTTING',
            cutCompleted: false,
            sewingCompleted: false,
            ironingCompleted: false,
            packagingCompleted: false,
            dueDate: deadline,
            history: [
              {
                date: new Date().toISOString(),
                status: 'READY_FOR_CUTTING',
                employeeId: 'system',
                notes: 'Göç işlemiyle üretim kaydı oluşturuldu.'
              }
            ],
            sewingFee: 150,
            approvedExtraWorkFee: 0
          });
        });
      }
    });
    
    if (needsMigration) {
      setProductionItems([...migratedItems, ...productionItems]);
    }
  }, [sales, products, productionItems, setProductionItems]);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleStatusChange = (itemId: string, status: string) => {
    const data: Partial<ProductionItem> = {
      productionStatus: status
    };

    // Auto flag updates
    if (status === 'CUT') data.cutCompleted = true;
    if (status === 'SEWN') data.sewingCompleted = true;
    if (status === 'IRONING') data.ironingCompleted = true;
    if (status === 'PACKAGING') data.packagingCompleted = true;
    
    if (status === 'READY') {
      data.cutCompleted = true;
      data.sewingCompleted = true;
      data.ironingCompleted = true;
      data.packagingCompleted = true;
    }

    // Append to history
    const item = productionItems.find(pi => pi.id === itemId);
    if (item) {
      data.history = [
        ...(item.history || []),
        {
          date: new Date().toISOString(),
          status,
          employeeId: "workshop",
          notes: `Aşama "${getStatusLabel(status)}" olarak güncellendi.`
        }
      ];
    }

    updateProductionItem(itemId, data);
  };

  const openIssueModal = (item: ProductionItem, isRework: boolean) => {
    setIssueModalItem(item);
    setIsReworkType(isRework);
    setIssueType(isRework ? "Hatalı Dikiş" : "Malzeme Eksik");
    setIssueDescription("");
    setResponsibleEmployeeId("");
    setExpectedResolutionDate("");
    setExpectedMaterialArrivalDate("");
    setAdditionalCost(0);
  };

  const handleSaveIssue = () => {
    if (!issueModalItem) return;
    
    const issue: ProductionIssue = {
      issueType,
      issueDescription,
      responsibleEmployeeId,
      expectedResolutionDate,
      expectedMaterialArrivalDate,
      additionalCost,
      createdAt: new Date().toISOString(),
      createdBy: "Workshop Staff"
    };

    const targetStatus = isReworkType ? "REWORK" : "PROBLEM";
    const data: Partial<ProductionItem> = {
      productionStatus: targetStatus,
      issue,
      history: [
        ...(issueModalItem.history || []),
        {
          date: new Date().toISOString(),
          status: targetStatus,
          employeeId: "workshop",
          notes: `Sorun Bildirildi: ${issueType} - ${issueDescription}`
        }
      ]
    };

    updateProductionItem(issueModalItem.id, data);
    setIssueModalItem(null);
  };

  const startEditingFee = (item: ProductionItem) => {
    setEditingFeeItemId(item.id);
    setTempSewingFee(String(item.sewingFee || 0));
    setTempExtraFee(String(item.approvedExtraWorkFee || 0));
  };

  const saveFees = (itemId: string) => {
    updateProductionItem(itemId, {
      sewingFee: Number(tempSewingFee) || 0,
      approvedExtraWorkFee: Number(tempExtraFee) || 0
    });
    setEditingFeeItemId(null);
  };

  // Group items by order
  const ordersData = sales.map(sale => {
    const customer = customers.find(c => c.id === sale.customerId);
    const orderItems = productionItems.filter(item => item.orderId === sale.id);
    
    const totalCount = orderItems.length;
    const readyCount = orderItems.filter(i => i.productionStatus === 'READY' || i.productionStatus === 'CANCELLED').length;
    const waitingCount = orderItems.filter(i => i.productionStatus !== 'READY' && i.productionStatus !== 'CANCELLED' && i.productionStatus !== 'PROBLEM' && i.productionStatus !== 'REWORK').length;
    const problemCount = orderItems.filter(i => i.productionStatus === 'PROBLEM' || i.productionStatus === 'REWORK').length;
    
    const completionPercent = totalCount === 0 ? 0 : Math.round((readyCount / totalCount) * 100);

    return {
      sale,
      customerName: customer ? customer.name : "Müşteri Bulunamadı",
      totalCount,
      readyCount,
      waitingCount,
      problemCount,
      completionPercent,
      items: orderItems
    };
  }).filter(o => 
    o.sale.id.includes(searchTerm) || 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-500" />
            Üretim Takip (İş Akışı)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Atölye işçi seviyesinde parça detaylı üretim ve montaj öncesi takip.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Sipariş no veya müşteri ara..." 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
          />
        </div>
      </div>

      <div className="space-y-4">
        {ordersData.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500">
            <Factory className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4 mx-auto" />
            <p>Üretimde bekleyen sipariş bulunmamaktadır.</p>
          </div>
        ) : null}

        {ordersData.map(({ sale, customerName, totalCount, readyCount, waitingCount, problemCount, completionPercent, items }) => {
          const isExpanded = expandedOrders[sale.id] !== false;

          return (
            <div key={sale.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Order Header Summary */}
              <div 
                onClick={() => toggleOrder(sale.id)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Sipariş: #SIP-{sale.id}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">• Müşteri: <span className="font-semibold text-gray-800 dark:text-gray-200">{customerName}</span></span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>Teslim Tarihi: <span className="font-medium text-gray-700 dark:text-gray-300">{sale.items[0]?.roomName ? "Saha Siparişi" : sale.date}</span></span>
                  </div>
                </div>

                {/* Statistics indicators */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs">
                    Toplam: {totalCount} Parça
                  </span>
                  <span className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Hazır: {readyCount}
                  </span>
                  <span className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Bekleyen: {waitingCount}
                  </span>
                  {problemCount > 0 && (
                    <span className="bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sorunlu: {problemCount}
                    </span>
                  )}
                </div>

                {/* Progress bar and Toggle */}
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden shrink-0">
                    <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${completionPercent}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-10 text-right">{completionPercent}%</span>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>

              {/* Items details list */}
              {isExpanded && (
                <div className="p-5 space-y-4 bg-gray-50/20 dark:bg-gray-950/10">
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-4">Ürün detayları yükleniyor...</p>
                  ) : null}

                  {items.map((item) => {
                    const isEditingFee = editingFeeItemId === item.id;

                    return (
                      <div key={item.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800/80 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Room, Opening & Product Description */}
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                              <span className="w-2 h-4 rounded-full bg-blue-600"></span>
                              {item.roomName} / {item.openingName}
                            </h4>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              Ürün: <span className="font-bold text-gray-800 dark:text-gray-200">{item.productName}</span> • Tip: {item.productType}
                            </div>
                            <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                              <span>Ölçü: <span className="font-bold text-blue-600 dark:text-blue-400">{item.width} × {item.height} cm</span></span>
                              <span>Miktar: <span className="font-medium text-gray-700 dark:text-gray-300">{item.quantity} m/m²</span></span>
                              {item.pleatType && <span>Pile/Dikiş: {item.pleatType}</span>}
                            </div>
                          </div>

                          {/* Middle: Tailor Assignments & Fees (Tailor can see this) */}
                          <div className="bg-gray-50 dark:bg-gray-800/30 border dark:border-gray-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
                            <div className="space-y-1">
                              <label className="block text-[10px] text-gray-400 font-bold uppercase">Atölye</label>
                              <select 
                                value={item.assignedWorkshopId || ""}
                                onChange={(e) => updateProductionItem(item.id, { assignedWorkshopId: e.target.value })}
                                className="bg-transparent border-none outline-none font-medium text-gray-800 dark:text-gray-200 cursor-pointer"
                              >
                                <option value="" className="bg-gray-900 text-white">Atölye Atanmadı</option>
                                {WORKSHOPS.map(w => <option key={w.id} value={w.id} className="bg-gray-900 text-white">{w.name}</option>)}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] text-gray-400 font-bold uppercase">Terzi</label>
                              <select 
                                value={item.assignedEmployeeId || ""}
                                onChange={(e) => updateProductionItem(item.id, { assignedEmployeeId: e.target.value })}
                                className="bg-transparent border-none outline-none font-medium text-gray-800 dark:text-gray-200 cursor-pointer"
                              >
                                <option value="" className="bg-gray-900 text-white">Terzi Seçilmedi</option>
                                {MOCK_USERS.map(u => <option key={u.id} value={u.id} className="bg-gray-900 text-white">{u.name}</option>)}
                              </select>
                            </div>

                            <div className="space-y-1 border-t sm:border-t-0 sm:border-l dark:border-gray-800 pt-2 sm:pt-0 sm:pl-4">
                              <label className="block text-[10px] text-gray-400 font-bold uppercase">Hakediş Ücretleri</label>
                              {isEditingFee ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <input 
                                    type="number" 
                                    placeholder="Dikiş" 
                                    value={tempSewingFee}
                                    onChange={(e) => setTempSewingFee(e.target.value)}
                                    className="w-14 p-1 rounded bg-white dark:bg-gray-950 text-xs border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white"
                                  />
                                  <input 
                                    type="number" 
                                    placeholder="Ek iş" 
                                    value={tempExtraFee}
                                    onChange={(e) => setTempExtraFee(e.target.value)}
                                    className="w-14 p-1 rounded bg-white dark:bg-gray-950 text-xs border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white"
                                  />
                                  <button onClick={() => saveFees(item.id)} className="bg-green-600 hover:bg-green-700 text-white p-1 rounded"><Check className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200 mt-1">
                                  <span>Dikiş: {item.sewingFee || 0} ₺</span>
                                  <span>Ek İş: {item.approvedExtraWorkFee || 0} ₺</span>
                                  <button onClick={() => startEditingFee(item)} className="text-blue-500 hover:underline text-[10px] ml-1">Düzenle</button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Current Item status badge */}
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Durum</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeColorClass(item.productionStatus)}`}>
                              {getStatusLabel(item.productionStatus)}
                            </span>
                          </div>
                        </div>

                        {/* Workflow action button groups */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          {/* Standard Workflow steps buttons */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button 
                              onClick={() => handleStatusChange(item.id, 'CUT')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${item.cutCompleted ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'}`}
                            >
                              <Scissors className="w-3.5 h-3.5" /> Kesildi
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'SEWN')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${item.sewingCompleted ? 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'}`}
                            >
                              Dikildi
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'IRONING')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${item.ironingCompleted ? 'bg-sky-500/20 text-sky-550 border-sky-500/30' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'}`}
                            >
                              Ütülendi
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'PACKAGING')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors ${item.packagingCompleted ? 'bg-blue-500/20 text-blue-600 border-blue-500/30' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'}`}
                            >
                              <Package className="w-3.5 h-3.5" /> Paketlendi
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'READY')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-colors ${item.productionStatus === 'READY' ? 'bg-green-600 text-white border-green-700' : 'bg-green-50/50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 border-green-500/20'}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Hazır / Tamam
                            </button>
                          </div>

                          {/* Exception actions buttons */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button 
                              onClick={() => handleStatusChange(item.id, 'WAITING_MATERIAL')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${item.productionStatus === 'WAITING_MATERIAL' ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20'}`}
                            >
                              Malzeme Bekliyor
                            </button>
                            <button 
                              onClick={() => handleStatusChange(item.id, 'WAITING_FACTORY')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${item.productionStatus === 'WAITING_FACTORY' ? 'bg-purple-500 text-white border-purple-600' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border-purple-500/20'}`}
                            >
                              Fabrikadan Bekleniyor
                            </button>
                            <button 
                              onClick={() => openIssueModal(item, false)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${item.productionStatus === 'PROBLEM' ? 'bg-red-600 text-white border-red-700' : 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20'}`}
                            >
                              Sorun Var
                            </button>
                            <button 
                              onClick={() => openIssueModal(item, true)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${item.productionStatus === 'REWORK' ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/20'}`}
                            >
                              Yeniden Yapılacak
                            </button>
                          </div>
                        </div>

                        {/* Render active issues display */}
                        {item.issue && (item.productionStatus === 'PROBLEM' || item.productionStatus === 'REWORK') && (
                          <div className="mt-3 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10 space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Üretim Sorunu ({item.issue.issueType})</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal ml-auto">Bildiren: {item.issue.createdBy} • {new Date(item.issue.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-800 dark:text-gray-300 font-medium">Açıklama: {item.issue.issueDescription}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t dark:border-red-900/30">
                              <div>Sorumlu: <span className="font-semibold text-gray-800 dark:text-gray-200">{MOCK_USERS.find(u => u.id === item.issue?.responsibleEmployeeId)?.name || item.issue?.responsibleEmployeeId || 'Belirtilmedi'}</span></div>
                              {item.issue.expectedResolutionDate && <div>Çözüm Hedefi: <span className="font-semibold text-gray-855 dark:text-gray-250">{new Date(item.issue.expectedResolutionDate).toLocaleDateString('tr-TR')}</span></div>}
                              {item.issue.expectedMaterialArrivalDate && <div>Kumaş/Mlz Geliş: <span className="font-semibold text-gray-855 dark:text-gray-250">{new Date(item.issue.expectedMaterialArrivalDate).toLocaleDateString('tr-TR')}</span></div>}
                              {item.issue.additionalCost > 0 && <div className="text-rose-600 dark:text-rose-400">Ekstra Maliyet: <span className="font-bold">{item.issue.additionalCost} ₺</span></div>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ISSUE MODAL PANEL OVERLAY */}
      {issueModalItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-50 dark:bg-red-950/20 p-4 border-b border-red-100 dark:border-red-900/30 flex justify-between items-center">
              <h3 className="font-bold text-red-900 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {isReworkType ? "Yeniden Yapılacak Bildirimi" : "Sorun Bildirimi"}
              </h3>
              <button onClick={() => setIssueModalItem(null)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-gray-500">
                Parça: <span className="font-bold text-gray-800 dark:text-gray-300">{issueModalItem.roomName} ({issueModalItem.openingName}) - {issueModalItem.productName}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Sorun Kategorisi</label>
                  <select 
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {isReworkType ? (
                      <>
                        <option>Dikiş Hatası</option>
                        <option>Ölçü Hatalı Dikilmiş</option>
                        <option>Kumaş Hasarlı</option>
                        <option>Montaj Aparat Uyumsuzluğu</option>
                        <option>Diğer</option>
                      </>
                    ) : (
                      <>
                        <option>Malzeme Eksik</option>
                        <option>Kumaş Defolu</option>
                        <option>Fabrikadan Yanlış Geldi</option>
                        <option>Ölçü Hatası Var</option>
                        <option>Diğer</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Sorumlu Sürücü / Personel</label>
                  <select 
                    value={responsibleEmployeeId}
                    onChange={(e) => setResponsibleEmployeeId(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Seçiniz...</option>
                    {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Sorun Detayı (Açıklama)*</label>
                <textarea 
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Detaylı sorun açıklaması giriniz..."
                  className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-xs outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Hedef Çözüm Tarihi*</label>
                  <input 
                    type="date"
                    value={expectedResolutionDate}
                    onChange={(e) => setExpectedResolutionDate(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Malzeme Geliş Tarihi (Varsa)</label>
                  <input 
                    type="date"
                    value={expectedMaterialArrivalDate}
                    onChange={(e) => setExpectedMaterialArrivalDate(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tahmini Ekstra Maliyet (₺)</label>
                <input 
                  type="number"
                  value={additionalCost}
                  onChange={(e) => setAdditionalCost(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-950 dark:border-gray-800 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-gray-800">
                <button 
                  onClick={handleSaveIssue}
                  disabled={!issueDescription.trim() || !expectedResolutionDate}
                  className="flex-1 bg-red-600 hover:bg-red-750 disabled:bg-gray-400 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg text-xs transition-colors"
                >
                  Sorunu Kaydet
                </button>
                <button 
                  onClick={() => setIssueModalItem(null)}
                  className="px-5 bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-755 text-gray-800 dark:text-gray-200 py-2.5 rounded-lg text-xs"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
