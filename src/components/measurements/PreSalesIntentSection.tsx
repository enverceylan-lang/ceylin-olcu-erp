"use client";

import React, { useState, useEffect } from "react";
import { Customer, RoomProductIntent, ProductIntentItem, generateUUID } from "@/store/useStore";
import { CheckSquare, Square, Save, Loader2 } from "lucide-react";

interface PreSalesIntentSectionProps {
  roomId: string;
  roomName: string;
  intent?: RoomProductIntent;
  onSave: (intent: RoomProductIntent) => Promise<void>;
}

const PRODUCT_TYPES = [
  { id: "TUL", label: "Tül" },
  { id: "GUNESLIK", label: "Güneşlik" },
  { id: "FON", label: "Fon" },
  { id: "RUSTIK", label: "Rustik" },
  { id: "TAVAN_RUSTIK", label: "Tavan Rustik" },
  { id: "STOR", label: "Stor" },
  { id: "ZEBRA", label: "Zebra" },
  { id: "DIKEY_PERDE", label: "Dikey Perde" },
  { id: "AHSAP_JALUZI", label: "Ahşap Jaluzi" },
  { id: "JALUZI", label: "Jaluzi" },
  { id: "PICASSO", label: "Picasso" },
  { id: "PLICELL", label: "Plicell" },
  { id: "DIGER", label: "Diğer" }
];

export function PreSalesIntentSection({ roomId, roomName, intent, onSave }: PreSalesIntentSectionProps) {
  const [localIntent, setLocalIntent] = useState<RoomProductIntent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  useEffect(() => {
    if (intent) {
      setLocalIntent({ ...intent, roomName });
    } else {
      setLocalIntent({
        id: generateUUID(),
        roomId,
        roomName,
        products: PRODUCT_TYPES.map(pt => ({
          id: generateUUID(),
          productType: pt.id,
          label: pt.label,
          selected: false,
          note: ""
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }, [intent, roomId, roomName]);

  const handleToggleProduct = (productType: string) => {
    if (!localIntent) return;
    setLocalIntent(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.map(p => {
          if (p.productType !== productType) return p;
          return { ...p, selected: !p.selected };
        })
      };
    });
  };

  const handleUpdateNote = (productType: string, note: string) => {
    if (!localIntent) return;
    setLocalIntent(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.map(p => {
          if (p.productType !== productType) return p;
          return { ...p, note };
        })
      };
    });
  };

  const handleSave = async () => {
    if (!localIntent) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const intentToSave = {
        ...localIntent,
        updatedAt: new Date().toISOString()
      };
      await onSave(intentToSave);
      
      const hasAnySelection = intentToSave.products.some(p => p.selected);
      
      setSaveMessage({
        text: hasAnySelection ? "Seçimler kaydedildi." : "Seçimler güncellendi.",
        type: "success"
      });
      setLastSaveTime(new Date());

      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);
      
    } catch (error) {
      setSaveMessage({
        text: "Seçimler kaydedilemedi. Lütfen tekrar deneyin.",
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!localIntent) return null;

  return (
    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-800/30 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm">Satışa Hazırlık / Ürün İsteği</h4>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
            Müşteri bu oda için ne istiyor?
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-3">
          {saveMessage && (
            <span className={`text-xs font-medium ${saveMessage.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'} animate-fade-in`}>
              {saveMessage.text}
            </span>
          )}
          {lastSaveTime && (
            <span className="text-[10px] text-emerald-600/50 dark:text-emerald-400/50 hidden sm:inline-block">
              {lastSaveTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' })}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {isSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-3 gap-x-4">
        {localIntent.products.map(product => (
          <div key={product.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleToggleProduct(product.productType)}
              className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left"
            >
              {product.selected ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              )}
              <span className={product.selected ? "font-medium text-gray-900 dark:text-white" : ""}>{product.label}</span>
            </button>
            {product.selected && (
              <div className="pl-5">
                <input
                  type="text"
                  placeholder="Not..."
                  value={product.note || ""}
                  onChange={(e) => handleUpdateNote(product.productType, e.target.value)}
                  className="w-full text-[11px] p-1 border border-emerald-200 dark:border-emerald-700/50 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
