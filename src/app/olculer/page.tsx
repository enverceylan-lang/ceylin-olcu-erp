"use client";

import { Search, Ruler, ArrowRight, ChevronDown, ChevronUp, User, Calendar, Layers, Image, Video as VideoIcon, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useStore, MEASUREMENT_TEMPLATES } from "@/store/useStore";
import { useEffect, useState } from "react";
import { getMeasurementDimensions, getTemplateLabel } from "@/lib/measurementAdapter";
import { useAuthStore, canViewCustomer } from "@/store/useAuthStore";

export default function OlculerPage() {
  const { customers } = useStore();
  const { currentUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  // Process customer stats and search
  const customerStats = customers
    .filter(c => !currentUser || canViewCustomer(currentUser, c))
    .map(customer => {
      const roomCount = customer.rooms.length;
      let openingCount = 0;
      let measurementCount = 0;
      let photoCount = 0;
      let videoCount = 0;
      let latestDate: Date | null = null;
      let latestMeasuredBy = "";

      for (const room of customer.rooms) {
        photoCount += (room.photos || []).length;
        videoCount += (room.videos || []).length;
        openingCount += room.windows.length;

        for (const window of room.windows) {
          photoCount += (window.photos || []).length;
          videoCount += (window.videos || []).length;
          measurementCount += window.products.length;

          for (const p of window.products) {
            photoCount += (p.photos || []).length;
            videoCount += (p.videos || []).length;
            if (p.measuredDate) {
              const d = new Date(p.measuredDate);
              if (!latestDate || d.getTime() > latestDate.getTime()) {
                latestDate = d;
                latestMeasuredBy = p.measuredBy || "";
              }
            }
          }
        }
      }

      return {
        customer,
        roomCount,
        openingCount,
        measurementCount,
        photoCount,
        videoCount,
        latestDateStr: latestDate ? latestDate.toLocaleDateString('tr-TR') : '-',
        latestMeasuredBy: latestMeasuredBy || '-'
      };
    })
    .filter(item => 
      item.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer.phone.includes(searchTerm)
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Ruler className="w-6 h-6 text-blue-500" />
          Ölçüler ve Projeler
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Müşteri bazında alınan saha ölçüleri ve durum takibi.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Müşteri veya telefon ara..." 
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow text-sm"
        />
      </div>

      <div className="space-y-4">
        {customerStats.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500 dark:text-gray-400">
            <Ruler className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4 mx-auto" />
            <p>Aradığınız kriterlere uygun ölçü kaydı bulunamadı.</p>
          </div>
        ) : null}

        {customerStats.map(({ customer, roomCount, openingCount, measurementCount, photoCount, videoCount, latestDateStr, latestMeasuredBy }) => {
          const isExpanded = !!expandedCustomers[customer.id];

          return (
            <div key={customer.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors overflow-hidden">
              {/* TOP LEVEL ROW / CARD HEADER */}
              <div 
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                onClick={() => toggleCustomer(customer.id)}
              >
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white hover:underline">
                    <Link href={`/cariler/${customer.id}`} onClick={e => e.stopPropagation()}>
                      {customer.name}
                    </Link>
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Son Ölçüm: {latestDateStr}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Ölçen: {latestMeasuredBy}
                    </span>
                  </div>
                </div>

                {/* STATS CHIPS */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    {roomCount} Oda
                  </span>
                  <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    {openingCount} Açıklık
                  </span>
                  <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-lg text-xs font-semibold">
                    {measurementCount} Ölçü Profile
                  </span>
                  {photoCount > 0 && (
                    <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                      <Image className="w-3.5 h-3.5" /> {photoCount} Foto
                    </span>
                  )}
                  {videoCount > 0 && (
                    <span className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1">
                      <VideoIcon className="w-3.5 h-3.5" /> {videoCount} Video
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                  <button 
                    className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? "Ölçüleri Gizle" : "Ölçüleri Gör"}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <Link 
                    href={`/cariler/${customer.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                  >
                    Detaya Git <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* EXPANDED HIERARCHY */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 p-5 space-y-6">
                  {customer.rooms.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Oda bulunamadı.</p>
                  ) : null}

                  {customer.rooms.map(room => (
                    <div key={room.id} className="space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-800">
                      {/* Room Header */}
                      <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        {room.name}
                        {(room.photos?.length > 0 || room.videos?.length > 0) && (
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({(room.photos || []).length} Foto, {(room.videos || []).length} Video)
                          </span>
                        )}
                      </h4>

                      {/* Openings */}
                      <div className="space-y-4 pl-4">
                        {room.windows.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Açıklık bulunmuyor.</p>
                        ) : null}

                        {room.windows.map(window => (
                          <div key={window.id} className="space-y-2">
                            <h5 className="font-semibold text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-gray-400" />
                              {window.name}
                            </h5>

                            {/* Raw Measurements */}
                            <div className="space-y-2 pl-5">
                              {window.products.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic">Alınmış ölçü kaydı yok.</p>
                              ) : null}

                              {window.products.map(p => {
                                const dims = getMeasurementDimensions(p);
                                const isAssigned = !!(p.productId || p.productType);

                                return (
                                  <div key={p.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                          {getTemplateLabel(dims.templateType)}
                                        </span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                                          {dims.summaryLabel}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                        <span>Ölçen: {p.measuredBy}</span>
                                        {p.measuredDate && <span>• {new Date(p.measuredDate).toLocaleDateString('tr-TR')}</span>}
                                        {p.notes && <span className="text-yellow-600 dark:text-yellow-500 font-medium">• Saha Notu: {p.notes}</span>}
                                      </div>
                                    </div>

                                    {/* Assignment Status Badge */}
                                    <div className="flex items-center gap-2">
                                      {isAssigned ? (
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                            Ürün Atandı
                                          </span>
                                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                            {p.productGroup} / {p.productType}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/40 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3 text-orange-500" />
                                          Ürün Atanmadı
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
