import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FacadeSegment, parseFacadeInput } from '@/lib/facadeHelper';
import { generateUUID } from '@/store/useStore';

interface FacadeSegmentsEditorProps {
  segments: FacadeSegment[];
  onChange: (segments: FacadeSegment[]) => void;
}

export const FacadeSegmentsEditor: React.FC<FacadeSegmentsEditorProps> = ({ segments, onChange }) => {
  const [fastInput, setFastInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFastInputSubmit = () => {
    setErrorMsg(null);
    const { segments: parsedSegments, errors } = parseFacadeInput(fastInput);
    if (errors.length > 0) {
      setErrorMsg(errors.join(' | '));
      // Do not save if there are structural errors with segments being 0
      if (parsedSegments.length === 0) return;
    }
    onChange(parsedSegments);
    setFastInput('');
  };

  const handleAddSegment = (type: 'WALL' | 'GLASS' | 'WINDOW' | 'DOOR', label: string) => {
    const newSegment: FacadeSegment = {
      id: generateUUID(),
      order: segments.length + 1,
      widthCm: 0,
      type,
      label,
    };
    onChange([...segments, newSegment]);
  };

  const handleUpdateSegment = (id: string, field: keyof FacadeSegment, value: any) => {
    const updated = segments.map(s => {
      if (s.id === id) {
        let newVal = value;
        if (field === 'type') {
           const labelMap: any = { WALL: 'Duvar', GLASS: 'Cam', WINDOW: 'Pencere', DOOR: 'Kapı' };
           return { ...s, type: newVal, label: labelMap[newVal] || newVal };
        }
        return { ...s, [field]: newVal };
      }
      return s;
    });
    onChange(updated);
  };

  const handleRemoveSegment = (id: string) => {
    onChange(segments.filter(s => s.id !== id));
  };

  const totalWidth = segments.reduce((sum, s) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">Cephe En Dizilimi</h3>
        <span className="font-bold text-blue-600 dark:text-blue-400">Toplam En: {totalWidth} cm</span>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
        <label className="block text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
          Hızlı Tek Satır Giriş (örn: 60 D 70 C 80 P 70 C 20 D 80 K 15 D)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={fastInput}
            onChange={(e) => setFastInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFastInputSubmit();
              }
            }}
            placeholder="60 D 70 C 80 P..."
            className="flex-1 p-2 text-sm border border-blue-200 dark:border-blue-800 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleFastInputSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            Çözümle / Tabloya Aktar
          </button>
        </div>
        {errorMsg && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900/30">
            Hata/Uyarı: {errorMsg}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-2 py-2">Sıra</th>
              <th className="px-2 py-2">Ölçü (cm)</th>
              <th className="px-2 py-2">Tür</th>
              <th className="px-2 py-2">Not</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, idx) => (
              <tr key={seg.id} className="border-b dark:border-gray-700">
                <td className="px-2 py-1">{idx + 1}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={seg.widthCm || ''}
                    onChange={(e) => handleUpdateSegment(seg.id, 'widthCm', parseFloat(e.target.value))}
                    className="w-20 p-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={seg.type}
                    onChange={(e) => handleUpdateSegment(seg.id, 'type', e.target.value)}
                    className="p-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  >
                    <option value="WALL">Duvar</option>
                    <option value="GLASS">Cam</option>
                    <option value="WINDOW">Pencere</option>
                    <option value="DOOR">Kapı</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={seg.note || ''}
                    onChange={(e) => handleUpdateSegment(seg.id, 'note', e.target.value)}
                    placeholder="Not..."
                    className="w-full p-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveSegment(seg.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {segments.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500 italic text-xs">
                  Henüz segment eklenmedi. Hızlı giriş alanını kullanın veya butonlarla ekleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 self-center mr-2">Ekle:</span>
        <button type="button" onClick={() => handleAddSegment('WALL', 'Duvar')} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Duvar</button>
        <button type="button" onClick={() => handleAddSegment('GLASS', 'Cam')} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Cam</button>
        <button type="button" onClick={() => handleAddSegment('WINDOW', 'Pencere')} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Pencere</button>
        <button type="button" onClick={() => handleAddSegment('DOOR', 'Kapı')} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded flex items-center gap-1"><Plus className="w-3 h-3"/> Kapı</button>
        <button type="button" onClick={() => handleAddSegment('WALL', 'Duvar')} className="text-xs bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded ml-auto flex items-center gap-1"><Plus className="w-3 h-3"/> Satır Ekle</button>
      </div>
    </div>
  );
};
