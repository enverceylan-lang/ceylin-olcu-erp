"use client";

import { useState, useMemo } from "react";
import { X, Search, MoveRight, AlertTriangle } from "lucide-react";
import { useStore, Customer, Room } from "@/store/useStore";

interface MoveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceCustomer: Customer;
  roomToMove: Room | null;
  onConfirm: (targetId: string, roomId: string) => Promise<void>;
}

export function MoveRoomModal({ isOpen, onClose, sourceCustomer, roomToMove, onConfirm }: MoveRoomModalProps) {
  const { customers } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableTargets = useMemo(() => {
    let filtered = customers.filter(c => c.id !== sourceCustomer.id && !c.isDeleted);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(lower) || 
        c.phone?.toLowerCase().includes(lower) ||
        c.customerCode?.toLowerCase().includes(lower)
      );
    }
    
    return filtered.slice(0, 10);
  }, [customers, sourceCustomer.id, searchTerm]);

  if (!isOpen || !roomToMove) return null;

  const handleConfirm = async () => {
    if (!targetId || !roomToMove) return;
    setIsProcessing(true);
    try {
      await onConfirm(targetId, roomToMove.id);
      onClose();
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MoveRight className="w-5 h-5 text-indigo-600" />
              Odayı Başka Cariye Taşı
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Odalar arası transfer işlemi
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 bg-gray-50 dark:bg-gray-900/50">
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-xl flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Taşınacak Oda</p>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">{roomToMove.name}</p>
            </div>
            <MoveRight className="text-indigo-400 w-6 h-6" />
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>Taşınan odaya bağlı tüm pencereler ve ölçüler hedef cariye aktarılacaktır. Eğer odanın satış veya siparişi yapıldıysa satış kaydının da güncellenmesi veya yeniden yapılması gerekebilir.</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Hedef Cari Ara
            </label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="İsim, telefon veya kod ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableTargets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Kayıt bulunamadı.</p>
            ) : (
              availableTargets.map(target => (
                <label 
                  key={target.id}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    targetId === target.id 
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" 
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="targetCustomer" 
                    checked={targetId === target.id}
                    onChange={() => setTargetId(target.id)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {target.name}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      <span>{target.customerCode || 'Kod Yok'}</span>
                      {target.phone && <span>• {target.phone}</span>}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-2xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            İptal
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!targetId || isProcessing}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing ? "Taşınıyor..." : "Odayı Taşı"}
          </button>
        </div>
      </div>
    </div>
  );
}
