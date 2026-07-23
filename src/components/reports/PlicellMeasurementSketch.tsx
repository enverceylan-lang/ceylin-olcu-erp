import React from 'react';

export interface PlicellCamItem {
  id?: string;
  order?: number;
  widthCm?: string | number;
  heightCm?: number;
  note?: string;
}

export interface PlicellCalculatedCam {
  id?: string;
  generatedItemId?: string;
  realWidthCm?: number;
  realHeightCm?: number;
  actualWidthCm?: number;
  actualHeightCm?: number;
  widthCm?: number;
  heightCm?: number;
  billingWidthCm?: number;
  billingHeightCm?: number;
  calculatedWidthCm?: number;
  calculatedHeightCm?: number;
  roundedWidth?: number;
  roundedHeight?: number;
  unitM2?: number;
  totalM2?: number;
  chargeableM2?: number;
  note?: string;
}

export interface PlicellStoredCalculation {
  cams?: PlicellCalculatedCam[];
  groups?: PlicellCalculatedCam[];
  totalM2?: number;
  totalSystemM2?: number;
  quantity?: number;
  systemType?: string;
}

export interface PlicellMeasurementSketchProps {
  camAdedi: number;
  ortakCamBoyuCm: number;
  profilRengi?: string;
  plicellCamListesi: PlicellCamItem[];
  calculation?: PlicellStoredCalculation;
}

export function PlicellMeasurementSketch({
  camAdedi = 0,
  ortakCamBoyuCm = 0,
  profilRengi = '',
  plicellCamListesi = [],
  calculation
}: PlicellMeasurementSketchProps) {
  const calculatedCams = Array.isArray(calculation?.cams)
    ? calculation.cams
    : Array.isArray(calculation?.groups)
      ? calculation.groups
      : [];

  const totalM2 = Number(
    calculation?.totalSystemM2 ??
    calculation?.totalM2 ??
    0
  );

  if (calculatedCams.length === 0) {
    return (
      <div className="w-full rounded border border-amber-300 bg-amber-50 p-4 print:bg-white">
        <div className="text-sm font-semibold text-amber-700">
          Merkezi Plicell hesap sonucu bulunamadı.
        </div>

        <div className="mt-1 text-xs text-slate-500">
          Bu çizim bileşeni ham ölçüden yeniden hesap yapmaz.
        </div>
      </div>
    );
  }

  const blocks = calculatedCams.map((cam, index) => {
    const rawCam = plicellCamListesi[index];

    const realWidth = Number(
      cam.realWidthCm ??
      cam.actualWidthCm ??
      cam.widthCm ??
      rawCam?.widthCm ??
      0
    );

    const realHeight = Number(
      cam.realHeightCm ??
      cam.actualHeightCm ??
      cam.heightCm ??
      rawCam?.heightCm ??
      ortakCamBoyuCm ??
      0
    );

    const billingWidth = Number(
      cam.billingWidthCm ??
      cam.calculatedWidthCm ??
      cam.roundedWidth ??
      0
    );

    const billingHeight = Number(
      cam.billingHeightCm ??
      cam.calculatedHeightCm ??
      cam.roundedHeight ??
      0
    );

    const camM2 = Number(
      cam.totalM2 ??
      cam.chargeableM2 ??
      cam.unitM2 ??
      0
    );

    const note = cam.note || rawCam?.note;

    return (
      <div
        key={cam.generatedItemId || cam.id || index}
        className="flex min-h-[150px] w-[150px] flex-col items-center justify-center border border-gray-300 bg-white p-3 shadow-sm"
      >
        <span className="mb-2 w-full border-b border-gray-200 pb-1 text-center text-sm font-bold text-gray-800">
          {index + 1}
        </span>

        <span className="text-sm font-semibold text-gray-700">
          Gerçek: {realWidth} × {realHeight}
        </span>

        <span className="mt-1 text-xs font-semibold text-blue-700">
          Hesap: {billingWidth} × {billingHeight}
        </span>

        <span className="mt-1 text-xs font-bold text-green-700">
          {camM2.toFixed(2)} m²
        </span>

        {note && (
          <span
            className="mt-2 w-full truncate text-center text-[10px] text-gray-500"
            title={note}
          >
            {note}
          </span>
        )}
      </div>
    );
  });

  return (
    <div className="w-full rounded border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
      <div className="mb-4 flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 print:border-slate-300">
        <div className="text-sm">
          {profilRengi && (
            <div className="mb-1">
              <span className="font-medium text-slate-500 print:text-slate-600">
                Profil Rengi:
              </span>{' '}
              <span className="font-bold text-slate-800 print:text-black">
                {profilRengi}
              </span>
            </div>
          )}

          {ortakCamBoyuCm > 0 && (
            <div className="mb-1">
              <span className="font-medium text-slate-500 print:text-slate-600">
                Ortak Cam Boyu:
              </span>{' '}
              <span className="font-bold text-slate-800 print:text-black">
                {ortakCamBoyuCm} cm
              </span>
            </div>
          )}

          <div>
            <span className="font-medium text-slate-500 print:text-slate-600">
              Cam Adedi:
            </span>{' '}
            <span className="font-bold text-slate-800 print:text-black">
              {camAdedi || calculatedCams.length}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500 print:text-slate-600">
            Merkezi Kasa Toplamı
          </div>

          <div className="text-lg font-bold text-green-600 print:text-green-700">
            {totalM2.toFixed(2)} m²
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap justify-start gap-4">
        {blocks}
      </div>
    </div>
  );
}