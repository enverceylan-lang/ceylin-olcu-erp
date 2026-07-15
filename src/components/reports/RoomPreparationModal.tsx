import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Sparkles } from 'lucide-react';
import { Customer, Room, SelectedProductItem } from '@/store/useStore';
import { MeasurementRecord } from '@/store/measurementStore';
import { getTemplateLabel, getMeasurementDimensions, resolveMeasurementProductType } from '@/lib/measurementAdapter';

interface RoomPreparationModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  customerId: string;
  measurements: MeasurementRecord[];
  onSave: (updated: MeasurementRecord[], transferToSale: boolean) => Promise<void>;
}

const PRODUCT_TYPES_OPTIONS = [
  { type: 'TUL', label: 'Tül' },
  { type: 'GUNESLIK', label: 'Güneşlik' },
  { type: 'FON', label: 'Fon' },
  { type: 'RUSTIK', label: 'Rustik' },
  { type: 'TAVAN_RUSTIK', label: 'Tavan Rustik' },
  { type: 'STOR', label: 'Stor' },
  { type: 'ZEBRA', label: 'Zebra' },
  { type: 'DIKEY_STOR', label: 'Dikey Stor' },
  { type: 'DIKEY_TUL', label: 'Dikey Tül' },
  { type: 'AHSAP_JALUZI', label: 'Ahşap Jaluzi' },
  { type: 'JALUZI', label: 'Jaluzi' },
  { type: 'PICASSO', label: 'Picasso' },
  { type: 'PLICELL', label: 'Plicell' },
  { type: 'BIRIZ', label: 'Biriz' }
];

export function RoomPreparationModal({ isOpen, onClose, room, customerId, measurements, onSave }: RoomPreparationModalProps) {
  const [localSelections, setLocalSelections] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, string[]> = {};
    const roomMeas = measurements.filter(m => m.roomId === room.id && !m.isDeleted);
    roomMeas.forEach(m => {
      if (m.selectedProducts && m.selectedProducts.length > 0) {
        initial[m.id] = m.selectedProducts.filter(sp => sp.isActive).map(sp => sp.productType);
      } else {
        const t = resolveMeasurementProductType(m);
        initial[m.id] = t ? [t] : [];
      }
    });
    setLocalSelections(initial);
  }, [isOpen, room.id, measurements]);

  if (!isOpen) return null;

  const roomMeas = measurements.filter(m => m.roomId === room.id && !m.isDeleted);

  const handleToggle = (measId: string, type: string) => {
    const current = localSelections[measId] || [];
    let updated: string[];
    if (current.includes(type)) {
      updated = current.filter(t => t !== type);
    } else {
      updated = [...current, type];
    }
    setLocalSelections({
      ...localSelections,
      [measId]: updated
    });
  };

  const handleSaveClick = async (transferToSale: boolean) => {
    try {
      setIsSaving(true);
      const updatedList: MeasurementRecord[] = roomMeas.map(m => {
        const selectedTypes = localSelections[m.id] || [];
        
        // Rebuild selectedProducts
        const newSelected: SelectedProductItem[] = selectedTypes.map(t => {
          const existing = m.selectedProducts?.find(sp => sp.productType === t);
          return {
            productType: t,
            isActive: true,
            stockId: existing?.stockId,
            applicationType: existing?.applicationType || (t === 'DIKEY_STOR' ? 'DIKEY_STOR' : undefined),
            calculation: existing?.calculation,
            userOverrides: existing?.userOverrides,
            addedAt: existing?.addedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
        
        // Retain inactive ones for history/reversibility
        m.selectedProducts?.forEach(existing => {
          if (!selectedTypes.includes(existing.productType)) {
            newSelected.push({
              ...existing,
              isActive: false,
              updatedAt: new Date().toISOString()
            });
          }
        });
        
        return {
          ...m,
          selectedProducts: newSelected
        };
      });

      await onSave(updatedList, transferToSale);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Seçimler kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-slate-100 font-sans">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-wide uppercase text-white">{room.name}</h3>
              <p className="text-xs text-slate-400">Satışa Hazırlık / Oda Ürün Seçimleri</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {roomMeas.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <AlertCircle className="w-12 h-12 text-slate-500 mx-auto" />
              <p className="text-slate-400 font-medium">Bu odada henüz ölçü kaydı bulunmuyor.</p>
            </div>
          ) : (
            roomMeas.map(m => {
              const dims = getMeasurementDimensions(m);
              const selectedTypes = localSelections[m.id] || [];
              const win = room.windows?.find(w => w.id === m.windowId);
              
              return (
                <div key={m.id} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
                  
                  {/* Title and measurements details */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-slate-850">
                    <div>
                      <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">
                        {win?.name || 'Açıklık'}
                      </span>
                      <h4 className="font-bold text-white text-md">
                        Ham Ölçü: <span className="text-slate-300 font-normal">{getTemplateLabel(m.templateType)}</span>
                      </h4>
                    </div>
                    <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300 self-start">
                      Ölçü: {m.rawValues?.width || 0} × {m.rawValues?.height || 0} cm
                    </div>
                  </div>

                  {/* Checklist Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                    {PRODUCT_TYPES_OPTIONS.map(opt => {
                      const isChecked = selectedTypes.includes(opt.type);
                      return (
                        <label 
                          key={opt.type} 
                          className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'bg-blue-600/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5' 
                              : 'bg-slate-900/50 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(m.id, opt.type)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer text-center"
            disabled={isSaving}
          >
            İptal
          </button>
          <button 
            onClick={() => handleSaveClick(false)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? 'Kaydediliyor...' : (
              <>
                <Save className="w-4 h-4" /> Kaydet
              </>
            )}
          </button>
          <button 
            onClick={() => handleSaveClick(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            Kaydet ve Satışa Aktar
          </button>
        </div>

      </div>
    </div>
  );
}
