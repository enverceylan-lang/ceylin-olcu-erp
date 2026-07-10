import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface PlicellCamItem {
  id: string;
  order: number;
  widthCm: string;
  heightCm: number;
  note: string;
}

export interface PlicellCamListEditorProps {
  camAdedi?: number;
  ortakCamBoyuCm?: number;
  profilRengi?: string;
  plicellCamListesi?: PlicellCamItem[];
  onChange: (data: { camAdedi: number, ortakCamBoyuCm: number, profilRengi: string, plicellCamListesi: PlicellCamItem[] }) => void;
}

export function PlicellCamListEditor({
  camAdedi = 0,
  ortakCamBoyuCm = 0,
  profilRengi = '',
  plicellCamListesi = [],
  onChange
}: PlicellCamListEditorProps) {
  const [localAdet, setLocalAdet] = useState<string>(camAdedi ? String(camAdedi) : '');
  const [localBoy, setLocalBoy] = useState<string>(ortakCamBoyuCm ? String(ortakCamBoyuCm) : '');
  const [localRenk, setLocalRenk] = useState<string>(profilRengi || '');

  // Keep internal copy of rows for quick edits
  const [rows, setRows] = useState<PlicellCamItem[]>(plicellCamListesi || []);

  useEffect(() => {
    setRows(plicellCamListesi || []);
    if (camAdedi) setLocalAdet(String(camAdedi));
    if (ortakCamBoyuCm) setLocalBoy(String(ortakCamBoyuCm));
    if (profilRengi) setLocalRenk(profilRengi);
  }, [plicellCamListesi, camAdedi, ortakCamBoyuCm, profilRengi]);

  const normalizeNumber = (val: string) => {
    const normalized = val.replace(',', '.').replace(/[^0-9.]/g, '');
    return normalized;
  };

  const handleGenerate = () => {
    const adet = parseInt(localAdet, 10);
    const boyStr = normalizeNumber(localBoy);
    const boy = parseFloat(boyStr);

    if (isNaN(adet) || adet <= 0) {
      alert("Lütfen geçerli bir cam adedi giriniz.");
      return;
    }
    if (isNaN(boy) || boy <= 0) {
      alert("Lütfen geçerli bir ortak cam boyu giriniz.");
      return;
    }

    const newRows: PlicellCamItem[] = [];
    for (let i = 0; i < adet; i++) {
      // Retain existing if available
      if (i < rows.length) {
        newRows.push({ ...rows[i], order: i + 1, heightCm: boy });
      } else {
        newRows.push({
          id: Math.random().toString(36).substr(2, 9),
          order: i + 1,
          widthCm: '',
          heightCm: boy,
          note: ''
        });
      }
    }
    
    setRows(newRows);
    onChange({ camAdedi: adet, ortakCamBoyuCm: boy, profilRengi: localRenk, plicellCamListesi: newRows });
  };

  const handleRenkChange = (val: string) => {
    setLocalRenk(val);
    const adet = parseInt(localAdet, 10) || rows.length;
    const boy = parseFloat(normalizeNumber(localBoy)) || 0;
    onChange({ camAdedi: adet, ortakCamBoyuCm: boy, profilRengi: val, plicellCamListesi: rows });
  };

  const handleRowChange = (index: number, field: keyof PlicellCamItem, value: string) => {
    const newRows = [...rows];
    if (field === 'widthCm') {
      newRows[index][field] = normalizeNumber(value);
    } else {
      newRows[index] = { ...newRows[index], [field]: value } as any;
    }
    setRows(newRows);
    
    const adet = parseInt(localAdet, 10) || newRows.length;
    const boy = parseFloat(normalizeNumber(localBoy)) || 0;
    onChange({ camAdedi: adet, ortakCamBoyuCm: boy, profilRengi: localRenk, plicellCamListesi: newRows });
  };

  const handleAddMore = (count: number) => {
    const currentBoy = parseFloat(normalizeNumber(localBoy)) || 0;
    const currentAdet = rows.length;
    const newRows = [...rows];
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: Math.random().toString(36).substr(2, 9),
        order: currentAdet + i + 1,
        widthCm: '',
        heightCm: currentBoy,
        note: ''
      });
    }
    setLocalAdet(String(newRows.length));
    setRows(newRows);
    onChange({ camAdedi: newRows.length, ortakCamBoyuCm: currentBoy, profilRengi: localRenk, plicellCamListesi: newRows });
  };

  const handleRemoveRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 }));
    setRows(newRows);
    setLocalAdet(String(newRows.length));
    const currentBoy = parseFloat(normalizeNumber(localBoy)) || 0;
    onChange({ camAdedi: newRows.length, ortakCamBoyuCm: currentBoy, profilRengi: localRenk, plicellCamListesi: newRows });
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3">Plicell Çoklu Cam Üretimi</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Kaç Cam Var?</label>
            <input
              type="number"
              min="1"
              value={localAdet}
              onChange={e => setLocalAdet(e.target.value)}
              className="w-full p-2 border border-blue-200 dark:border-blue-800/50 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Örn: 10"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ortak Cam Boyu (cm)</label>
            <input
              type="text"
              value={localBoy}
              onChange={e => setLocalBoy(e.target.value)}
              className="w-full p-2 border border-blue-200 dark:border-blue-800/50 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Örn: 176"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Profil Rengi</label>
            <select
              value={localRenk}
              onChange={e => handleRenkChange(e.target.value)}
              className="w-full p-2 border border-blue-200 dark:border-blue-800/50 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">Seçiniz...</option>
              <option value="BEYAZ">BEYAZ</option>
              <option value="KREM">KREM</option>
              <option value="GRİ">GRİ</option>
              <option value="ANTRASİT">ANTRASİT</option>
              <option value="BAKIR">BAKIR</option>
              <option value="KAHVE">KAHVE</option>
              <option value="SİYAH">SİYAH</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Üret
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200">Cam Enleri</h4>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleAddMore(1)} className="cursor-pointer text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Plus className="w-3 h-3"/> 1 Ekle</button>
              <button type="button" onClick={() => handleAddMore(5)} className="cursor-pointer text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1"><Plus className="w-3 h-3"/> 5 Ekle</button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {rows.map((row, index) => (
              <div key={row.id} className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                <div className="w-full sm:w-16 text-center font-bold text-gray-500 dark:text-gray-400">
                  {row.order}. Cam
                </div>
                <div className="flex-1 w-full relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">En:</span>
                  <input
                    type="text"
                    value={row.widthCm}
                    onChange={(e) => handleRowChange(index, 'widthCm', e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Örn: 56.70"
                  />
                </div>
                <div className="flex-1 w-full relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Boy:</span>
                   <input
                    type="text"
                    value={row.heightCm}
                    disabled
                    className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-500 cursor-not-allowed"
                   />
                </div>
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    value={row.note}
                    onChange={(e) => handleRowChange(index, 'note', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Not (Opsiyonel)"
                  />
                </div>
                <button type="button" onClick={() => handleRemoveRow(index)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded cursor-pointer transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
