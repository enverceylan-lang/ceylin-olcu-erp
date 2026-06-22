import React from 'react';
import { X, Printer } from 'lucide-react';
import { Customer, MEASUREMENT_TEMPLATES, WindowItem, ProductMeasurement } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions } from '@/lib/measurementAdapter';
import { calculatePlicellM2 } from '@/lib/reportFormatters';
import { renderSimpleWidthHeightDiagram, renderCurtainDetailDiagram } from '@/lib/measurementDiagram';

interface MeasurementVisualReportProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  users: { id: string; name: string }[];
}

export function MeasurementVisualReport({ isOpen, onClose, customer, users }: MeasurementVisualReportProps) {
  if (!isOpen) return null;

  // Determine global "Ölçüyü Alan"
  const allMeasuredBy = new Set<string>();
  customer.rooms?.forEach(room => {
    room.windows?.forEach(window => {
      window.products?.forEach(p => {
        if (p.measuredBy) allMeasuredBy.add(p.measuredBy);
      });
    });
  });
  const sameMeasuredBy = allMeasuredBy.size === 1 ? Array.from(allMeasuredBy)[0] : null;

  // Date checks
  const uniqueDays = new Set<string>();
  customer.rooms?.forEach(room => {
    room.windows?.forEach(window => {
      window.products?.forEach(p => {
        if (p.measuredDate) {
          const dayStr = new Date(p.measuredDate).toLocaleDateString('tr-TR');
          uniqueDays.add(dayStr);
        }
      });
    });
  });
  const showDateOnMeasurements = uniqueDays.size > 1;

  let globalPlicellCount = 0;
  let globalPlicellM2 = 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print">
      {/* Injecting print-specific CSS directly via style tag to isolate print layout */}
      <style>{`
        @media print {
          /* Hide everything except the print container */
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          #visual-report-print-area, #visual-report-print-area * {
            visibility: visible !important;
          }
          #visual-report-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 20px !important;
            page-break-inside: avoid !important;
          }
          .print-svg {
            max-width: 180px !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in text-white">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Görsel Ölçü Raporu</span>
            </h2>
            <p className="text-xs text-slate-400">Yazdırılabilir saha ve üretim teknik raporu.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Yazdır / PDF Al
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/20">
          <div id="visual-report-print-area" className="bg-slate-900 text-white font-sans max-w-4xl mx-auto rounded-xl p-6 border border-slate-800 shadow-sm print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
            
            {/* Report Header Title */}
            <div className="text-center pb-6 border-b border-slate-800 print:border-slate-300">
              <h1 className="text-2xl font-black tracking-wider text-blue-500 print:text-blue-700">CEYLİN ÖLÇÜ ERP</h1>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 print:text-slate-600 mt-1">Saha Ölçü Raporu</h2>
            </div>

            {/* Customer Information Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-b border-slate-800 print:border-slate-300 text-sm print:text-xs">
              <div className="space-y-1.5">
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Müşteri:</span> <span className="font-bold text-slate-100 print:text-black">{customer.name}</span></p>
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Telefon:</span> <span className="font-semibold text-slate-200 print:text-black">{customer.phone || '-'}</span></p>
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Adres:</span> <span className="text-slate-200 print:text-black">{customer.address || customer.mapLocation || '-'}</span></p>
              </div>
              <div className="space-y-1.5 md:text-right print:text-left">
                <p><span className="text-slate-400 print:text-slate-600 font-medium">Rapor Tarihi:</span> <span className="text-slate-200 print:text-black">{new Date().toLocaleString('tr-TR')}</span></p>
                {sameMeasuredBy && (
                  <p><span className="text-slate-400 print:text-slate-600 font-medium">Ölçüyü Alan:</span> <span className="font-semibold text-blue-400 print:text-blue-700">{sameMeasuredBy}</span></p>
                )}
              </div>
            </div>

            {/* Room Iteration */}
            <div className="py-6 space-y-8">
              {(!customer.rooms || customer.rooms.length === 0) ? (
                <p className="text-center text-slate-400 print:text-slate-600 py-8 italic text-sm">Oda ve ölçü kaydı bulunmuyor.</p>
              ) : (
                customer.rooms.map((room, roomIdx) => {
                  const windows = room.windows || [];
                  
                  // Split products inside room into plicell and standard
                  const plicellProducts: { p: ProductMeasurement; index: number; winName: string }[] = [];
                  const standardOpenings: { winName: string; winItem: WindowItem; products: ProductMeasurement[] }[] = [];

                  let plicellCounter = 0;
                  windows.forEach(win => {
                    const plicellItems = win.products?.filter(p => p.templateType === 'PLICELL') || [];
                    const standardItems = win.products?.filter(p => p.templateType !== 'PLICELL') || [];

                    if (plicellItems.length > 0) {
                      plicellItems.forEach(p => {
                        plicellProducts.push({ p, index: ++plicellCounter, winName: win.name });
                      });
                    }
                    if (standardItems.length > 0) {
                      standardOpenings.push({ winName: win.name, winItem: win, products: standardItems });
                    }
                  });

                  return (
                    <div key={room.id} className="space-y-4 print-card print:border-slate-200 print:rounded-lg print:p-4">
                      {/* Room Header */}
                      <h3 className="text-md font-bold text-slate-100 print:text-black border-l-4 border-blue-500 print:border-blue-700 pl-3 flex items-center justify-between">
                        <span>{roomIdx + 1}. ODA: {room.name}</span>
                        {(room.photos?.length > 0 || room.videos?.length > 0) && (
                          <span className="text-[10px] font-normal text-slate-400 print:text-slate-500">
                            ({(room.photos||[]).length} Foto, {(room.videos||[]).length} Video eklenmiş)
                          </span>
                        )}
                      </h3>

                      {windows.length === 0 ? (
                        <p className="text-xs text-slate-400 print:text-slate-600 pl-4 italic">Bu oda altında açıklık kaydı yok.</p>
                      ) : (
                        <div className="space-y-6 pl-2">
                          
                          {/* A. Render Standard Openings */}
                          {standardOpenings.map(({ winName, winItem, products }) => {
                            const showWinHeader = windows.length > 1;

                            return (
                              <div key={winItem.id} className="space-y-4">
                                {showWinHeader && (
                                  <h4 className="text-xs font-bold text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200 pb-1 flex items-center justify-between">
                                    <span>[Açıklık: {winName}]</span>
                                    {(winItem.photos?.length > 0 || winItem.videos?.length > 0) && (
                                      <span className="text-[9px] font-normal">
                                        ({(winItem.photos||[]).length} Foto, {(winItem.videos||[]).length} Video)
                                      </span>
                                    )}
                                  </h4>
                                )}

                                <div className="space-y-4">
                                  {products.map((p, pIdx) => {
                                    const dims = getMeasurementDimensions(p);
                                    const isSimple = p.templateType === 'SIMPLE_WIDTH_HEIGHT';
                                    const isCurtain = p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN';

                                    return (
                                      <div key={p.id} className="flex flex-col md:flex-row gap-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 print:bg-slate-50/20 print:border-slate-200">
                                        
                                        {/* Dimension Info */}
                                        <div className="flex-1 space-y-3">
                                          <div>
                                            <div className="font-semibold text-sm text-slate-200 print:text-black">
                                              Ölçü {pIdx + 1}: {getTemplateLabel(p.templateType)}
                                            </div>
                                            <div className="text-[10px] text-slate-400 print:text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                                              {!sameMeasuredBy && p.measuredBy && <span>Ölçen: {p.measuredBy}</span>}
                                              {showDateOnMeasurements && p.measuredDate && <span>Tarih: {new Date(p.measuredDate).toLocaleDateString('tr-TR')}</span>}
                                              {(p.photos?.length > 0 || p.videos?.length > 0) && (
                                                <span className="text-blue-400 print:text-blue-700">📷 {(p.photos||[]).length} Foto, {(p.videos||[]).length} Video var</span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Table of raw parameters */}
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            {isCurtain ? (
                                              <>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Sol Duvar</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.leftWall ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Pencere Eni</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.windowWidth ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Sağ Duvar</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.rightWall ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Tavan Boşluğu</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.ceilingGap ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Pencere Boyu</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.windowHeight ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Zemin Boşluğu</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.floorGap ?? '0'} cm</span>
                                                </div>
                                                <div className="col-span-2 bg-blue-950/10 print:bg-blue-50/20 p-2 rounded border border-blue-900/30 print:border-blue-200 font-bold flex justify-between">
                                                  <span className="text-slate-300 print:text-slate-700">Toplam Ölçü:</span>
                                                  <span className="text-blue-400 print:text-blue-700">{dims.structuralWidth} × {dims.structuralHeight} cm</span>
                                                </div>
                                              </>
                                            ) : isSimple ? (
                                              <>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Genişlik (En)</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.width ?? '0'} cm</span>
                                                </div>
                                                <div className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                  <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">Yükseklik (Boy)</span>
                                                  <span className="font-bold text-slate-200 print:text-black">{p.rawValues?.height ?? '0'} cm</span>
                                                </div>
                                                <div className="col-span-2 bg-blue-950/10 print:bg-blue-50/20 p-2 rounded border border-blue-900/30 print:border-blue-200 font-bold flex justify-between">
                                                  <span className="text-slate-300 print:text-slate-700">Toplam Ölçü:</span>
                                                  <span className="text-blue-400 print:text-blue-700">{dims.structuralWidth} × {dims.structuralHeight} cm</span>
                                                </div>
                                              </>
                                            ) : (
                                              // Unknown template custom fields mapping
                                              Object.entries(p.rawValues || {}).map(([k, v]) => {
                                                const template = MEASUREMENT_TEMPLATES[p.templateType];
                                                const label = template?.fields.find(f => f.key === k)?.label || k;
                                                return (
                                                  <div key={k} className="bg-slate-950/30 print:bg-white p-1.5 rounded border border-slate-800/40 print:border-slate-200">
                                                    <span className="text-[9px] text-slate-400 print:text-slate-500 block uppercase font-medium">{label}</span>
                                                    <span className="font-bold text-slate-200 print:text-black">{String(v)}</span>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>

                                          {/* Saha Notu */}
                                          {p.notes && p.notes.trim() && (
                                            <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200 print:bg-amber-50/30 print:border-amber-200 print:text-black">
                                              <span className="font-bold text-[9.5px] uppercase text-amber-400 print:text-amber-700 block mb-0.5">Saha Notu:</span>
                                              {p.notes.trim()}
                                            </div>
                                          )}
                                        </div>

                                        {/* Diagram Canvas */}
                                        <div className="w-full md:w-auto flex items-center justify-center print-svg">
                                          {isSimple && renderSimpleWidthHeightDiagram(Number(p.rawValues?.width || 0), Number(p.rawValues?.height || 0))}
                                          {isCurtain && renderCurtainDetailDiagram(p.rawValues)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* B. Render Plicell Group (Tablo) */}
                          {plicellProducts.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200 pb-1">
                                [Ölçü Grubu: Plicell Cam İçi Ölçüsü]
                              </h4>
                              
                              <div className="overflow-x-auto rounded-lg border border-slate-850 print:border-slate-200">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-950/60 print:bg-slate-100 text-slate-400 print:text-slate-700 font-bold border-b border-slate-850 print:border-slate-200">
                                      <th className="p-2.5 text-center w-12">No</th>
                                      <th className="p-2.5">Açıklık Adı</th>
                                      <th className="p-2.5 text-right">Gerçek En</th>
                                      <th className="p-2.5 text-right">Gerçek Boy</th>
                                      <th className="p-2.5 text-right">Hesap En</th>
                                      <th className="p-2.5 text-right">Hesap Boy</th>
                                      <th className="p-2.5 text-right w-24">Hesap m²</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      let roomPlicellM2 = 0;
                                      const notesList: { idx: number; note: string }[] = [];

                                      const rows = plicellProducts.map(({ p, index, winName }) => {
                                        const w = Number(p.rawValues?.glassWidth || 0);
                                        const h = Number(p.rawValues?.glassHeight || 0);
                                        const calc = calculatePlicellM2(w, h);

                                        roomPlicellM2 += calc.chargeableM2;
                                        globalPlicellCount++;
                                        globalPlicellM2 += calc.chargeableM2;

                                        if (p.notes && p.notes.trim()) {
                                          notesList.push({ idx: index, note: p.notes.trim() });
                                        }

                                        return (
                                          <tr key={p.id} className="border-b border-slate-900 last:border-0 print:border-slate-200 hover:bg-slate-900/30 print:hover:bg-transparent">
                                            <td className="p-2.5 text-center font-semibold text-slate-400 print:text-slate-500">{index}</td>
                                            <td className="p-2.5 font-medium text-slate-200 print:text-black">{winName}</td>
                                            <td className="p-2.5 text-right font-semibold">{w.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-semibold">{h.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calc.roundedWidth} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calc.roundedHeight} cm</td>
                                            <td className="p-2.5 text-right font-bold text-green-400 print:text-green-700">{calc.chargeableM2.toFixed(2)} m²</td>
                                          </tr>
                                        );
                                      });

                                      return (
                                        <>
                                          {rows}
                                          <tr className="bg-slate-950/40 print:bg-slate-50 font-bold border-t-2 border-slate-850 print:border-slate-300">
                                            <td colSpan={2} className="p-3 text-slate-300 print:text-slate-700">Toplam Cam Adedi: {plicellProducts.length}</td>
                                            <td colSpan={4} className="p-3 text-right text-slate-400 print:text-slate-600">Toplam Oda m²:</td>
                                            <td className="p-3 text-right text-green-400 print:text-green-700 text-sm">{roomPlicellM2.toFixed(2)} m²</td>
                                          </tr>
                                          {notesList.length > 0 && (
                                            <tr>
                                              <td colSpan={7} className="p-3 bg-slate-950/20 border-t border-slate-900 print:border-slate-200">
                                                <div className="space-y-1 text-slate-300 print:text-slate-700">
                                                  <span className="font-bold uppercase text-[9.5px] text-amber-500 print:text-amber-700 block">Notlar:</span>
                                                  {notesList.map(n => (
                                                    <div key={n.idx} className="text-[11px]">- {n.idx}. Cam: <span className="font-medium text-slate-200 print:text-black">{n.note}</span></div>
                                                  ))}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Grand Totals Section */}
            {globalPlicellCount > 0 && (
              <div className="my-6 p-4 rounded-xl bg-slate-950/60 print:bg-slate-50 border border-slate-850 print:border-slate-300 flex justify-between items-center text-sm font-bold print:text-xs">
                <span className="text-slate-300 print:text-slate-700">Genel Plicell Rapor Toplamı:</span>
                <span className="text-green-400 print:text-green-700 text-lg print:text-sm">{globalPlicellCount} Adet Cam / {globalPlicellM2.toFixed(2)} m²</span>
              </div>
            )}

            {/* Google Maps Location */}
            {(customer.mapLocation || customer.address) && (
              <div className="py-4 border-t border-slate-800 print:border-slate-300 text-xs text-slate-400 print:text-slate-500 mt-6 flex justify-between items-center flex-wrap gap-2">
                <span>Konum: {customer.address || customer.mapLocation}</span>
                {customer.mapLocation && (
                  <span className="text-blue-400 print:text-blue-700">
                    https://maps.google.com/?q={customer.mapLocation}
                  </span>
                )}
              </div>
            )}

            {/* Document footer signature */}
            <div className="text-center text-[10px] text-slate-500 print:text-slate-600 mt-6 pt-4 border-t border-slate-850/50 print:border-slate-200">
              <p>Ölçü ERP V1.0.1 - Saha Pilot Uygulaması</p>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
