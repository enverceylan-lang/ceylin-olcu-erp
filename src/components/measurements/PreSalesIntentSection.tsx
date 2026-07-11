"use client";

import React, { useState, useEffect } from "react";
import { Customer, RoomProductIntent, ProductIntentItem, generateUUID } from "@/store/useStore";
import { CheckSquare, Square, Save, Loader2 } from "lucide-react";

interface PreSalesIntentSectionProps {
  customer: Customer;
  onSave: (intents: RoomProductIntent[]) => Promise<void>;
}

const PRODUCT_TYPES = [
  { id: "TUL", label: "Tül" },
  { id: "GUNESLIK", label: "Güneşlik" },
  { id: "FON", label: "Fon" },
  { id: "RUSTIK", label: "Rustik" },
  { id: "STOR", label: "Stor" },
  { id: "ZEBRA", label: "Zebra" },
  { id: "DIKEY_PERDE", label: "Dikey Perde" },
  { id: "AHSAP_JALUZI", label: "Ahşap Jaluzi" },
  { id: "JALUZI", label: "Jaluzi" },
  { id: "PICASSO", label: "Picasso" },
  { id: "PLICELL", label: "Plicell" },
  { id: "DIGER", label: "Diğer" }
];

export function PreSalesIntentSection({ customer, onSave }: PreSalesIntentSectionProps) {
  const [intents, setIntents] = useState<RoomProductIntent[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const existingIntents = customer.roomProductIntents || [];
    const currentRooms = customer.rooms || [];
    
    const workingIntents = currentRooms.map(room => {
      const existing = existingIntents.find(i => i.roomId === room.id);
      if (existing) {
        return { ...existing, roomName: room.name };
      }
      
      const newIntent: RoomProductIntent = {
        id: generateUUID(),
        roomId: room.id,
        roomName: room.name,
        products: PRODUCT_TYPES.map(pt => ({
          id: generateUUID(),
          productType: pt.id,
          label: pt.label,
          selected: false,
          note: ""
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return newIntent;
    });

    setIntents(workingIntents);
  }, [customer.roomProductIntents, customer.rooms]);

  const handleToggleProduct = (roomId: string, productType: string) => {
    setIntents(prev => prev.map(intent => {
      if (intent.roomId !== roomId) return intent;
      return {
        ...intent,
        products: intent.products.map(p => {
          if (p.productType !== productType) return p;
          return { ...p, selected: !p.selected };
        })
      };
    }));
  };

  const handleUpdateNote = (roomId: string, productType: string, note: string) => {
    setIntents(prev => prev.map(intent => {
      if (intent.roomId !== roomId) return intent;
      return {
        ...intent,
        products: intent.products.map(p => {
          if (p.productType !== productType) return p;
          return { ...p, note };
        })
      };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const intentsToSave = intents.map(intent => ({
        ...intent,
        updatedAt: new Date().toISOString()
      }));
      await onSave(intentsToSave);
    } finally {
      setIsSaving(false);
    }
  };

  if (!customer.rooms || customer.rooms.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6 border-l-4 border-emerald-500">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Satışa Hazırlık / Ürün İsteği</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Önce oda ekleyin. Odalar eklendikten sonra ürün isteği seçimi yapabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6 border-t-4 border-t-emerald-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Satışa Hazırlık / Ürün İsteği</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Her oda için müşterinin talep ettiği ürünleri seçin ve gerekirse not ekleyin.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mt-4 sm:mt-0 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Seçimleri Kaydet
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {intents.map(intent => (
          <div key={intent.roomId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 uppercase mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              {intent.roomName}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
              {intent.products.map(product => (
                <div key={product.id} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleProduct(intent.roomId, product.productType)}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left"
                  >
                    {product.selected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className={product.selected ? "font-medium text-gray-900 dark:text-white" : ""}>{product.label}</span>
                  </button>
                  {product.selected && (
                    <div className="pl-6">
                      <input
                        type="text"
                        placeholder="Not ekleyin..."
                        value={product.note || ""}
                        onChange={(e) => handleUpdateNote(intent.roomId, product.productType, e.target.value)}
                        className="w-full text-xs p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
