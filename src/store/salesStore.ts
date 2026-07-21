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

export type CustomerApprovalStatus =
  | 'BEKLIYOR'
  | 'ONAYLANDI'
  | 'DUZELTME_ISTENDI'
  | 'IPTAL_EDILDI';

export type InstallmentStatus =
  | 'BEKLIYOR'
  | 'KISMI_ODENDI'
  | 'ODENDI'
  | 'GECIKTI'
  | 'IPTAL';

export type PaymentMethod =
  | 'NAKIT'
  | 'KART'
  | 'HAVALE'
  | 'EFT'
  | 'DIGER';

export interface SalePayment {
  id: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  installmentId?: string;
  note?: string;
  receivedBy?: string;
}

export interface SaleInstallment {
  id: string;
  sequence: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: InstallmentStatus;
  lastPaymentAt?: string;
  note?: string;
}

export interface SaleInstallmentPlan {
  id: string;
  createdAt: string;
  firstDueDate: string;
  installmentCount: number;
  frequency: 'MONTHLY' | 'CUSTOM';
  totalPlannedAmount: number;
  installments: SaleInstallment[];
}

export interface SaleCustomerApproval {
  status: CustomerApprovalStatus;
  token?: string;
  tokenCreatedAt?: string;
  tokenExpiresAt?: string;
  sentAt?: string;
  respondedAt?: string;
  customerNote?: string;
  approvedName?: string;
  approvedPhone?: string;
}
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
  productionWidthCm?: number;
  productionHeightCm?: number;
  fabricMeters?: number;
  calculationVersion?: string;
  pleatDetails?: string;
  unitPrice: number;
  discount: number;
  rowTotal: number;
  note?: string;
  parentProductRelation?: string;
  isJumboComponent?: boolean;
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
  installmentPlan?: SaleInstallmentPlan;
  payments?: SalePayment[];
  customerApproval?: SaleCustomerApproval;
  pdfGeneratedAt?: string;
  pdfFileName?: string;
  whatsappApprovalSentAt?: string;
  
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteBatchId?: string;
  deleteSource?: string;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archiveBatchId?: string;
  archiveSource?: string;
}

interface SalesState {
  sales: Sale[];
  isLoading: boolean;
  loadSales: () => Promise<void>;
  addSale: (sale: Sale) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  removeSale: (id: string) => Promise<void>;
  transferSales: (sourceCustomerId: string, targetCustomerId: string) => Promise<void>;
  cascadeArchiveCustomer: (customerId: string, batchId: string, username: string) => Promise<void>;
  cascadeRestoreArchivedCustomer: (customerId: string, batchId: string) => Promise<void>;
  cascadeMoveToTrash: (customerId: string, batchId: string, username: string) => Promise<void>;
  cascadeRestoreFromTrash: (customerId: string, batchId: string) => Promise<void>;
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

    if (sale.status === 'ÜRETİME_GÖNDERİLDİ') {
      const { syncCentralSaleToTailorProduction } =
        await import('@/lib/productionBridge');

      await syncCentralSaleToTailorProduction(sale);
    }

    set(state => ({
      sales: state.sales.map(s => (s.id === sale.id ? sale : s))
    }));
  },

  removeSale: async (id: string) => {
    await deleteLocalSale(id);
    set(state => ({
      sales: state.sales.filter(s => s.id !== id)
    }));
  },

  
  cascadeArchiveCustomer: async (customerId, batchId, username) => {
    const state = get();
    const now = new Date().toISOString();
    let updated = false;

    const newSales = state.sales.map(sale => {
      if (sale.customerId === customerId && !sale.isDeleted && !sale.isArchived) {
        updated = true;
        const upSale = {
          ...sale,
          isArchived: true,
          archivedAt: now,
          archivedBy: username,
          archiveBatchId: batchId,
          archiveSource: 'CUSTOMER_CASCADE'
        };
        saveLocalSale(upSale).catch(console.error);
        return upSale;
      }
      return sale;
    });

    if (updated) set({ sales: newSales });
  },

  cascadeRestoreArchivedCustomer: async (customerId, batchId) => {
    const state = get();
    let updated = false;

    const newSales = state.sales.map(sale => {
      if (sale.customerId === customerId && sale.isArchived && sale.archiveBatchId === batchId) {
        updated = true;
        const upSale = {
          ...sale,
          isArchived: false,
          archivedAt: undefined,
          archivedBy: undefined,
          archiveBatchId: undefined,
          archiveSource: undefined
        };
        saveLocalSale(upSale).catch(console.error);
        return upSale;
      }
      return sale;
    });

    if (updated) set({ sales: newSales });
  },

  cascadeMoveToTrash: async (customerId, batchId, username) => {
    const state = get();
    const now = new Date().toISOString();
    let updated = false;

    const newSales = state.sales.map(sale => {
      if (sale.customerId === customerId && !sale.isDeleted) {
        updated = true;
        const upSale = {
          ...sale,
          isDeleted: true,
          deletedAt: now,
          deletedBy: username,
          deleteBatchId: batchId,
          deleteSource: 'CUSTOMER_CASCADE'
        };
        saveLocalSale(upSale).catch(console.error);
        return upSale;
      }
      return sale;
    });

    if (updated) set({ sales: newSales });
  },

  cascadeRestoreFromTrash: async (customerId, batchId) => {
    const state = get();
    let updated = false;

    const newSales = state.sales.map(sale => {
      if (sale.customerId === customerId && sale.isDeleted && sale.deleteBatchId === batchId) {
        updated = true;
        const upSale = {
          ...sale,
          isDeleted: false,
          deletedAt: undefined,
          deletedBy: undefined,
          deleteBatchId: undefined,
          deleteSource: undefined
        };
        saveLocalSale(upSale).catch(console.error);
        return upSale;
      }
      return sale;
    });

    if (updated) set({ sales: newSales });
  },

  transferSales: async (sourceCustomerId: string, targetCustomerId: string) => {
    try {
      const sales = get().sales;
      const updatedSales = [...sales];
      let hasChanges = false;
      
      for (let i = 0; i < updatedSales.length; i++) {
        if (updatedSales[i].customerId === sourceCustomerId) {
          updatedSales[i] = {
            ...updatedSales[i],
            customerId: targetCustomerId,
            updatedAt: new Date().toISOString()
          };
          await saveLocalSale(updatedSales[i]);
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        set({ sales: updatedSales });
      }
    } catch (err) {
      console.error('Error transferring sales:', err);
    }
  }
}));
