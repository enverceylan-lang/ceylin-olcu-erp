import React from 'react';
import { X, Printer, Share2, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Customer, MEASUREMENT_TEMPLATES, WindowItem, ProductMeasurement } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions } from '@/lib/measurementAdapter';
import { generateMeasurementPdfBlob } from '@/lib/measurementPdfGenerator';
import { calculatePlicellM2, calculateMechanicalCurtainM2, getValidNote } from '@/lib/reportFormatters';
import { renderSimpleWidthHeightDiagram, renderCurtainDetailDiagram } from '@/lib/measurementDiagram';
import { TechnicalMeasurementSketch } from './TechnicalMeasurementSketch';
import { PlicellMeasurementSketch } from './PlicellMeasurementSketch';
import { formatFacadeForReport } from '@/lib/facadeHelper';

interface MeasurementVisualReportProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  users: { id: string; name: string }[];
}

export function MeasurementVisualReport({ isOpen, onClose, customer, users }: MeasurementVisualReportProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

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
  let globalMechanicalCount = 0;
  let globalMechanicalM2 = 0;

  const handlePrint = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await generateMeasurementPdfBlob(customer, sameMeasuredBy);
      const url = URL.createObjectURL(pdfFile);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('PDF generation error', error);
      alert('PDF oluşturulurken bir hata meydana geldi.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await generateMeasurementPdfBlob(customer, sameMeasuredBy);
      
      // Web Share API with files support
      if (pdfFile && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: 'CEYLİN ÖLÇÜ ERP',
            files: [pdfFile]
          });
        } catch (err) {
          console.error('Share error:', err);
          fallbackWhatsApp(pdfFile);
        }
      } else {
        fallbackWhatsApp(pdfFile);
      }
    } catch (error) {
      console.error('PDF generate/share error:', error);
      alert('PDF oluşturulamadı veya paylaşılamadı.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const fallbackWhatsApp = (file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("Bu cihaz PDF dosya paylaşımını doğrudan desteklemiyor. PDF indirildi, WhatsApp'tan dosya olarak gönderebilirsiniz.");
    } else {
      alert("PDF oluşturulamadı.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:bg-white print:p-0 print:block">
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

      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in text-white print:shadow-none print:border-none print:max-h-none print:overflow-visible">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 no-print">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Görsel Ölçü Raporu</span>
            </h2>
            <p className="text-xs text-slate-400">Yazdırılabilir saha ve üretim teknik raporu.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Paylaş
            </button>
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
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/20 print:p-0 print:overflow-visible print:bg-white">
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
                  
                  // Split products inside room into plicell, mechanical curtain, and standard
                  const plicellProducts: { p: ProductMeasurement; index: number; winName: string }[] = [];
                  const mechanicalCurtainProducts: { p: ProductMeasurement; index: number; winName: string }[] = [];
                  const standardOpenings: { winName: string; winItem: WindowItem; products: ProductMeasurement[] }[] = [];

                  let plicellCounter = 0;
                  let mechanicalCurtainCounter = 0;
                  windows.forEach(win => {
                    const plicellItems = win.products?.filter(p => p.templateType === 'PLICELL') || [];
                    const mechanicalCurtainItems = win.products?.filter(p => p.templateType === 'mechanical_curtain') || [];
                    const standardItems = win.products?.filter(p => p.templateType !== 'PLICELL' && p.templateType !== 'mechanical_curtain') || [];

                    if (plicellItems.length > 0) {
                      plicellItems.forEach(p => {
                        plicellProducts.push({ p, index: ++plicellCounter, winName: win.name });
                      });
                    }
                    if (mechanicalCurtainItems.length > 0) {
                      mechanicalCurtainItems.forEach(p => {
                        mechanicalCurtainProducts.push({ p, index: ++mechanicalCurtainCounter, winName: win.name });
                      });
                    }
                    if (standardItems.length > 0) {
                      standardOpenings.push({ winName: win.name, winItem: win, products: standardItems });
                    }
                  });

                      const hasAnyProducts = plicellProducts.length > 0 || mechanicalCurtainProducts.length > 0 || standardOpenings.length > 0;

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

                          {!hasAnyProducts ? (
                            <p className="text-xs text-slate-400 print:text-slate-600 pl-4 italic">Bu oda için ölçü detayı yok.</p>
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

                                <div className="flex flex-wrap gap-6 print:block">
                                  {products.map((p, pIdx) => {
                                    const isSimple = p.templateType === 'SIMPLE_WIDTH_HEIGHT';
                                    const isCurtain = p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN';
                                    
                                    let segmentsToDraw = [];
                                    let widthToDraw = 0;
                                    let heightToDraw = 0;
                                    let totalWidth = 0;

                                    if (isSimple) {
                                      widthToDraw = Number(p.rawValues?.width || 0);
                                      heightToDraw = Number(p.rawValues?.height || 0);
                                      totalWidth = widthToDraw;
                                    } else if (isCurtain) {
                                      segmentsToDraw = p.rawValues?.facadeSegments || [];
                                      totalWidth = Number(p.rawValues?.totalFacadeWidthCm || 0);

                                      if (!segmentsToDraw.length && (Number(p.rawValues?.leftWall) > 0 || Number(p.rawValues?.windowWidth) > 0 || Number(p.rawValues?.rightWall) > 0)) {
                                          if (Number(p.rawValues?.leftWall) > 0) segmentsToDraw.push({ widthCm: p.rawValues.leftWall, type: 'WALL', label: 'Duvar' });
                                          if (Number(p.rawValues?.windowWidth) > 0) segmentsToDraw.push({ widthCm: p.rawValues.windowWidth, type: 'WINDOW', label: 'Pencere' });
                                          if (Number(p.rawValues?.rightWall) > 0) segmentsToDraw.push({ widthCm: p.rawValues.rightWall, type: 'WALL', label: 'Duvar' });
                                      }

                                      if (segmentsToDraw.length > 0 && totalWidth === 0) {
                                          totalWidth = segmentsToDraw.reduce((sum: number, s: any) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);
                                      }
                                    }

                                    return (
                                      <div key={p.id} className="w-full xl:w-[calc(50%-12px)] print:w-full mb-6 print:mb-8 break-inside-avoid bg-white print:bg-white rounded-lg p-5 print:p-0 shadow-sm print:shadow-none border border-slate-200 print:border-none">
                                        <div className="flex justify-between items-start mb-3">
                                          <div>
                                            <h4 className="text-sm font-bold text-slate-800 print:text-black">
                                              {winName} - Ölçü {pIdx + 1}: {getTemplateLabel(p.templateType)}
                                            </h4>
                                            <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
                                              {!sameMeasuredBy && p.measuredBy && <span>Ölçen: {p.measuredBy}</span>}
                                              {showDateOnMeasurements && p.measuredDate && <span>Tarih: {new Date(p.measuredDate).toLocaleDateString('tr-TR')}</span>}
                                              {(p.photos?.length > 0 || p.videos?.length > 0) && (
                                                <span className="text-blue-600">📷 {(p.photos||[]).length} Foto, {(p.videos||[]).length} Video</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {(() => {
                                          const validNote = getValidNote(p.notes);
                                          if (!validNote) return null;
                                          return (
                                            <div className="mb-4 p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 print:bg-white print:border-slate-300 print:text-black">
                                              <span className="font-bold text-[9.5px] uppercase block mb-0.5">Saha Notu:</span>
                                              {validNote}
                                            </div>
                                          );
                                        })()}

                                        <div className="w-full flex justify-center mt-2 print:mt-4">
                                          {isSimple || isCurtain ? (
                                            <TechnicalMeasurementSketch 
                                              facadeSegments={segmentsToDraw}
                                              width={widthToDraw}
                                              height={heightToDraw}
                                              totalFacadeWidthCm={totalWidth}
                                              kartonpiyerBoslukCm={Number(p.rawValues?.kartonpiyerBoslukCm || p.rawValues?.ceilingGap || 0)}
                                              camUstuCm={Number(p.rawValues?.camUstuCm || 0)}
                                              camIciCm={Number(p.rawValues?.camIciCm || p.rawValues?.windowHeight || 0)}
                                              kaloriferMermerBoyuCm={Number(p.rawValues?.kaloriferMermerBoyuCm || 0)}
                                              camAltiCm={Number(p.rawValues?.camAltiCm || p.rawValues?.floorGap || 0)}
                                              solYukseklikCm={Number(p.rawValues?.solYukseklikCm || 0)}
                                              ortaYukseklikCm={Number(p.rawValues?.ortaYukseklikCm || 0)}
                                              sagYukseklikCm={Number(p.rawValues?.sagYukseklikCm || 0)}
                                            />
                                          ) : (
                                            <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                              {Object.entries(p.rawValues || {}).map(([k, v]) => {
                                                const template = MEASUREMENT_TEMPLATES[p.templateType];
                                                const label = template?.fields.find((f: any) => f.key === k)?.label || k;
                                                return (
                                                  <div key={k} className="bg-slate-50 print:bg-white p-2 rounded border border-slate-200 print:border-slate-300">
                                                    <span className="text-[9px] text-slate-500 block uppercase font-medium">{label}</span>
                                                    <span className="font-bold text-slate-800 print:text-black">{String(v)}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* B. Render Plicell Group */}
                          {plicellProducts.length > 0 && (
                            <div className="space-y-4">
                              {plicellProducts.map(({ p, index, winName }) => {
                                const camListesi = p.rawValues?.plicellCamListesi;

                                if (camListesi && Array.isArray(camListesi) && camListesi.length > 0) {
                                  const validCamListesi = camListesi.filter((cam: any) => Number(cam.widthCm) > 0 && Number(cam.heightCm) > 0);
                                  
                                  if (validCamListesi.length === 0) {
                                    return (
                                      <div key={p.id}>
                                        <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                          {winName} - Ölçü {index}: Plicell Cam İçi
                                        </h4>
                                        <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 italic text-sm rounded">
                                          Geçerli Plicell cam ölçüsü girilmemiş.
                                        </div>
                                      </div>
                                    );
                                  }

                                  const ortakBoy = Number(p.rawValues?.ortakCamBoyuCm || 0);
                                  const profilRengi = p.rawValues?.profilRengi || '';
                                  const camAdedi = validCamListesi.length;

                                  validCamListesi.forEach((cam: any) => {
                                    const w = Number(cam.widthCm) || 0;
                                    const h = Number(cam.heightCm) || 0;
                                    globalPlicellCount++;
                                    globalPlicellM2 += calculatePlicellM2(w, h).chargeableM2;
                                  });

                                  return (
                                    <div key={p.id}>
                                      <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                        {winName} - Ölçü {index}: Plicell Cam İçi
                                      </h4>
                                      <PlicellMeasurementSketch 
                                        camAdedi={camAdedi}
                                        ortakCamBoyuCm={ortakBoy}
                                        profilRengi={profilRengi}
                                        plicellCamListesi={validCamListesi}
                                      />
                                    </div>
                                  );
                                } else {
                                  // Eski format: Tek cam
                                  const w = Number(p.rawValues?.glassWidth || 0);
                                  const h = Number(p.rawValues?.glassHeight || 0);
                                  const calc = calculatePlicellM2(w, h);
                                  
                                  globalPlicellCount++;
                                  globalPlicellM2 += calc.chargeableM2;

                                  const singleCamItem = {
                                    widthCm: w,
                                    heightCm: h,
                                    note: p.notes
                                  };

                                  return (
                                    <div key={p.id}>
                                      <h4 className="text-sm font-bold text-slate-800 print:text-black mb-2">
                                        {winName} - Ölçü {index}: Plicell Cam İçi
                                      </h4>
                                      <PlicellMeasurementSketch 
                                        camAdedi={1}
                                        ortakCamBoyuCm={h}
                                        plicellCamListesi={[singleCamItem]}
                                      />
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          )}

                          {/* C. Render Mechanical Curtain Group (Tablo) */}
                          {mechanicalCurtainProducts.length > 0 && (
                            <div className="space-y-3 mt-4">
                              <h4 className="text-xs font-bold text-slate-400 print:text-slate-600 border-b border-slate-800 print:border-slate-200 pb-1">
                                [Ölçü Grubu: Mekanik Perde Ölçüsü]
                              </h4>
                              
                              <div className="overflow-x-auto rounded-lg border border-slate-850 print:border-slate-200">
                                <table className="w-full text-xs text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-950/60 print:bg-slate-100 text-slate-400 print:text-slate-700 font-bold border-b border-slate-850 print:border-slate-200">
                                      <th className="p-2.5 text-center w-12">No</th>
                                      <th className="p-2.5">Açıklık Adı</th>
                                      <th className="p-2.5">Ürün Tipi</th>
                                      <th className="p-2.5 text-right">Gerçek En</th>
                                      <th className="p-2.5 text-right">Gerçek Boy</th>
                                      <th className="p-2.5 text-right">Hesap En</th>
                                      <th className="p-2.5 text-right">Hesap Boy</th>
                                      <th className="p-2.5 text-center w-16">Adet</th>
                                      <th className="p-2.5 text-right w-24">Hesap m²</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      let roomMechanicalM2 = 0;
                                      const notesList: { idx: number; note: string }[] = [];

                                      const rows = mechanicalCurtainProducts.map(({ p, index, winName }) => {
                                        const w = Number(p.rawValues?.width || 0);
                                        const h = Number(p.rawValues?.height || 0);
                                        const q = Number(p.rawValues?.quantity || 1);
                                        const productType = p.rawValues?.productType || 'Stor Perde';
                                        const calc = calculateMechanicalCurtainM2(w, h, q);

                                        roomMechanicalM2 += calc.totalM2;
                                        globalMechanicalCount += q;
                                        globalMechanicalM2 += calc.totalM2;

                                        const validMechNote = getValidNote(p.notes);
                                        if (validMechNote) {
                                          notesList.push({ idx: index, note: validMechNote });
                                        }

                                        return (
                                          <tr key={p.id} className="border-b border-slate-900 last:border-0 print:border-slate-200 hover:bg-slate-900/30 print:hover:bg-transparent">
                                            <td className="p-2.5 text-center font-semibold text-slate-400 print:text-slate-500">{index}</td>
                                            <td className="p-2.5 font-medium text-slate-200 print:text-black">{winName}</td>
                                            <td className="p-2.5 font-medium text-blue-400 print:text-blue-700">{productType}</td>
                                            <td className="p-2.5 text-right font-semibold">{w.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-semibold">{h.toFixed(1)} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calc.billingWidth} cm</td>
                                            <td className="p-2.5 text-right font-bold text-blue-400 print:text-blue-700">{calc.billingHeight} cm</td>
                                            <td className="p-2.5 text-center font-semibold">{q} Adet</td>
                                            <td className="p-2.5 text-right font-bold text-green-400 print:text-green-700">{calc.totalM2.toFixed(2)} m²</td>
                                          </tr>
                                        );
                                      });

                                      return (
                                        <>
                                          {rows}
                                          <tr className="bg-slate-950/40 print:bg-slate-50 font-bold border-t-2 border-slate-850 print:border-slate-300">
                                            <td colSpan={3} className="p-3 text-slate-300 print:text-slate-700">Toplam Mekanik Adedi: {mechanicalCurtainProducts.reduce((acc, curr) => acc + Number(curr.p.rawValues?.quantity || 1), 0)}</td>
                                            <td colSpan={5} className="p-3 text-right text-slate-400 print:text-slate-600">Toplam Oda m²:</td>
                                            <td className="p-3 text-right text-green-400 print:text-green-700 text-sm">{roomMechanicalM2.toFixed(2)} m²</td>
                                          </tr>
                                          {notesList.length > 0 && (
                                            <tr>
                                              <td colSpan={9} className="p-3 bg-slate-950/20 border-t border-slate-900 print:border-slate-200">
                                                <div className="space-y-1 text-slate-300 print:text-slate-700">
                                                  <span className="font-bold uppercase text-[9.5px] text-amber-500 print:text-amber-700 block">Notlar:</span>
                                                  {notesList.map(n => (
                                                    <div key={n.idx} className="text-[11px]">- {n.idx}. Mekanik: <span className="font-medium text-slate-200 print:text-black">{n.note}</span></div>
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

            {globalMechanicalCount > 0 && (
              <div className="my-4 p-4 rounded-xl bg-slate-950/60 print:bg-slate-50 border border-slate-850 print:border-slate-300 flex justify-between items-center text-sm font-bold print:text-xs">
                <span className="text-slate-300 print:text-slate-700">Genel Mekanik Perde Rapor Toplamı:</span>
                <span className="text-green-400 print:text-green-700 text-lg print:text-sm">{globalMechanicalCount} Adet Mekanik Perde / {globalMechanicalM2.toFixed(2)} m²</span>
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
