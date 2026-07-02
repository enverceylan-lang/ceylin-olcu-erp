import { create } from 'zustand';
import { loadLocalSales, saveLocalSale, deleteLocalSale } from '@/lib/localSalesDb';

export type SaleStatus = 
  | 'TASLAK' 
  | 'TEKLİF' 
  | 'ONAYLANDI' 
  | 'SİPARİŞ' 
  | 'ÜRETİME_GÖNDERİLDİ' 
  | 'MONTAJA_GÖNDERİLDİ' 
  | 'TAMAMLANDI' 
  | 'İPTAL';

export interface SaleItem {
  id: string; 
  measurementId?: string;
  roomName: string;
  windowName: string;
  productType: string;
  productGroup: string;
  width: number;
  height: number;
  calcWidth: number;
  calcHeight: number;
  quantity: number;
  metricSize: number;
  metricUnit: 'm2' | 'mt' | 'adet';
  pleatDetails?: string;
  unitPrice: number;
  discount: number;
  rowTotal: number;
  note?: string;
}

export interface Sale {
  id: string;
  saleNo: string;
  customerId: string;
  status: SaleStatus;
  items: SaleItem[];
  
  priceSource: 'STOCK' | 'MANUAL' | 'CAMPAIGN' | 'SERVICE';
  totalAmount: number; // Sum of rowTotal
  cashPrice: number; // Peşin fiyat
  installmentPrice: number; // Taksitli fiyat
  discount: number; // Genel iskonto
  downPayment: number; // Kapora
  remainingBalance: number; // Kalan bakiye
  
  createdAt: string;
  updatedAt: string;
}

interface SalesState {
  sales: Sale[];
  isLoading: boolean;
  loadSales: () => Promise<void>;
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  removeSale: (id: string) => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  isLoading: false,

  loadSales: async () => {
    set({ isLoading: true });
    try {
      const data = await loadLocalSales();
      set({ sales: data, isLoading: false });
    } catch (err) {
      console.error('Error loading sales:', err);
      set({ isLoading: false });
    }
  },

  addSale: async (sale: Sale) => {
    await saveLocalSale(sale);
    set(state => ({ sales: [...state.sales, sale] }));
  },

  updateSale: async (sale: Sale) => {
    await saveLocalSale(sale);
    set(state => ({
      sales: state.sales.map(s => (s.id === sale.id ? sale : s))
    }));
  },

  removeSale: async (id: string) => {
    await deleteLocalSale(id);
    set(state => ({
      sales: state.sales.filter(s => s.id !== id)
    }));
  }
}));
