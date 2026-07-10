import React from 'react';
import { calculatePlicellM2 } from '@/lib/reportFormatters';

export interface PlicellCamItem {
  id?: string;
  order?: number;
  widthCm?: string | number;
  heightCm?: number;
  note?: string;
}

export interface PlicellMeasurementSketchProps {
  camAdedi: number;
  ortakCamBoyuCm: number;
  profilRengi?: string;
  plicellCamListesi: PlicellCamItem[];
}

export function PlicellMeasurementSketch({
  camAdedi = 0,
  ortakCamBoyuCm = 0,
  profilRengi = '',
  plicellCamListesi = [],
}: PlicellMeasurementSketchProps) {
  
  if (plicellCamListesi.length === 0) return null;

  let totalM2 = 0;
  
  const blocks = plicellCamListesi.map((cam, i) => {
    const w = Number(cam.widthCm) || 0;
    const h = Number(cam.heightCm) || ortakCamBoyuCm || 0;
    const calc = calculatePlicellM2(w, h);
    totalM2 += calc.chargeableM2;

    return (
      <div key={i} className="flex flex-col items-center justify-center p-3 border border-gray-300 bg-white shadow-sm" style={{ width: '120px', height: '140px' }}>
        <span className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-200 pb-1 w-full text-center">{i + 1}</span>
        <span className="text-sm font-semibold text-gray-700">{w} × {h}</span>
        {cam.note && (
          <span className="text-[10px] text-gray-500 mt-2 truncate w-full text-center" title={cam.note}>
            {cam.note}
          </span>
        )}
      </div>
    );
  });

  return (
    <div className="w-full bg-slate-50 print:bg-white rounded border border-slate-200 print:border-slate-300 p-4">
      
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between mb-4 pb-2 border-b border-slate-200 print:border-slate-300">
        <div className="text-sm">
          {profilRengi && (
            <div className="mb-1"><span className="text-slate-500 print:text-slate-600 font-medium">Profil Rengi:</span> <span className="font-bold text-slate-800 print:text-black">{profilRengi}</span></div>
          )}
          {ortakCamBoyuCm > 0 && (
            <div className="mb-1"><span className="text-slate-500 print:text-slate-600 font-medium">Ortak Cam Boyu:</span> <span className="font-bold text-slate-800 print:text-black">{ortakCamBoyuCm} cm</span></div>
          )}
          <div><span className="text-slate-500 print:text-slate-600 font-medium">Cam Adedi:</span> <span className="font-bold text-slate-800 print:text-black">{camAdedi}</span></div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 print:text-slate-600">Toplam m²</div>
          <div className="text-lg font-bold text-green-600 print:text-green-700">{totalM2.toFixed(2)} m²</div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 justify-start mb-6">
        {blocks}
      </div>
    </div>
  );
}
