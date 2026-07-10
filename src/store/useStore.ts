import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore, normalizeRole } from './useAuthStore';
import { saveLocalCustomer, saveLocalCustomers, softDeleteLocalCustomer, loadLocalCustomers } from '@/lib/localCustomerDb';

// ─── Store Change Notification for Sync ───
type StoreChangeListener = () => void;
const storeChangeListeners: StoreChangeListener[] = [];

export function subscribeToStoreChanges(listener: StoreChangeListener) {
  storeChangeListeners.push(listener);
  return () => {
    const idx = storeChangeListeners.indexOf(listener);
    if (idx !== -1) storeChangeListeners.splice(idx, 1);
  };
}

function notifyStoreChanges() {
  setTimeout(() => {
    storeChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error("Store change listener failed:", e);
      }
    });
  }, 100);
}

// Fallback UUID v4 generator for insecure/HTTP mobile environments
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sanitizeCustomersForPersist(customers: Customer[]): Customer[] {
  if (!Array.isArray(customers)) return [];
  
  const isMediaString = (val: any): boolean => {
    if (typeof val !== 'string') return false;
    return val.startsWith('data:') || val.includes(';base64,') || val.length > 5000;
  };

  return customers.map(customer => ({
    ...customer,
    addressPhotos: customer.addressPhotos?.filter(p => !isMediaString(p)) || [],
    rooms: customer.rooms?.map(room => ({
      ...room,
      photos: room.photos?.filter(p => !isMediaString(p)) || [],
      videos: room.videos?.filter(p => !isMediaString(p)) || [],
      windows: room.windows?.map(w => ({
        ...w,
        photos: w.photos?.filter(p => !isMediaString(p)) || [],
        videos: w.videos?.filter(p => !isMediaString(p)) || [],
        products: w.products?.map(p => ({
          ...p,
          photos: p.photos?.filter(photo => !isMediaString(photo)) || [],
          videos: p.videos?.filter(video => !isMediaString(video)) || [],
        })) || []
      })) || []
    })) || []
  }));
}

const customStoreStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(name);
    } catch (e) {
      console.error('[Zustand Storage] Error reading from localStorage:', e);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, value);
    } catch (error: any) {
      if (error.name === 'QuotaExceededError' || error.code === 22 || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn('[Zustand Storage] QuotaExceededError detected. Cleaning up base64 media and retrying...');
        try {
          const parsed = JSON.parse(value);
          if (parsed && parsed.state) {
            if (parsed.state.customers) {
              parsed.state.customers = sanitizeCustomersForPersist(parsed.state.customers);
            }
            const sanitizedValue = JSON.stringify(parsed);
            window.localStorage.setItem(name, sanitizedValue);
            console.log('[Zustand Storage] Successfully saved to localStorage after removing media.');
            return;
          }
        } catch (innerError) {
          console.error('[Zustand Storage] Failed to recover from QuotaExceededError:', innerError);
        }
      }
      throw error;
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch (e) {
      console.error('[Zustand Storage] Error removing from localStorage:', e);
    }
  }
};



export interface Note {
  date: string;
  note: string;
  author: string;
}

export interface MeasurementTemplate {
  type: string;
  fields: { 
    key: string; 
    label: string; 
    type: 'number' | 'text' | 'select'; 
    options?: string[]; 
    defaultValue?: any; 
    optional?: boolean; 
    hidden?: boolean;
  }[];
}

export const MEASUREMENT_TEMPLATES: Record<string, MeasurementTemplate> = {
  CURTAIN_DETAIL: {
    type: 'CURTAIN_DETAIL',
    fields: [
      { key: 'leftWall', label: 'Sol Duvar (cm)', type: 'number', hidden: true },
      { key: 'windowWidth', label: 'Pencere Eni (cm)', type: 'number', hidden: true },
      { key: 'rightWall', label: 'Sağ Duvar (cm)', type: 'number', hidden: true },
      { key: 'ceilingGap', label: 'Tavan Boşluğu (cm)', type: 'number', hidden: true },
      { key: 'windowHeight', label: 'Pencere Boyu (cm)', type: 'number', hidden: true },
      { key: 'floorGap', label: 'Zemin Boşluğu (cm)', type: 'number', hidden: true },
      { key: 'kartonpiyerBoslukCm', label: 'Kartonpiyer Boşluğu', type: 'number' },
      { key: 'camUstuCm', label: 'Cam Üstü', type: 'number' },
      { key: 'camIciCm', label: 'Cam İçi', type: 'number' },
      { key: 'kaloriferMermerBoyuCm', label: 'Kalorifer / Mermer Boyu', type: 'number' },
      { key: 'camAltiCm', label: 'Cam Altı', type: 'number' },
      { key: 'solYukseklikCm', label: 'Sol Yükseklik', type: 'number' },
      { key: 'ortaYukseklikCm', label: 'Orta Yükseklik', type: 'number' },
      { key: 'sagYukseklikCm', label: 'Sağ Yükseklik', type: 'number' },
      { key: 'yukseklikNotu', label: 'Yükseklik Notu', type: 'text' },
    ]
  },
  SIMPLE_WIDTH_HEIGHT: {
    type: 'SIMPLE_WIDTH_HEIGHT',
    fields: [
      { key: 'width', label: 'En (cm)', type: 'number' },
      { key: 'height', label: 'Boy (cm)', type: 'number' },
    ]
  },
  PLICELL: {
    type: 'PLICELL',
    fields: [
      { key: 'glassWidth', label: 'Cam Eni (cm)', type: 'number' },
      { key: 'glassHeight', label: 'Cam Boyu (cm)', type: 'number' },
    ]
  },
  mechanical_curtain: {
    type: 'mechanical_curtain',
    fields: [
      {
        key: 'productType',
        label: 'Ürün Tipi',
        type: 'select',
        options: [
          'Stor Perde',
          'Zebra Perde',
          'Dikey Stor',
          'Dikey Tül',
          'Ahşap Jaluzi',
          'Picasso',
          'Diğer Mekanik Perde'
        ]
      },
      { key: 'quantity', label: 'Adet', type: 'number', defaultValue: 1 },
      { key: 'width', label: 'En (cm)', type: 'number' },
      { key: 'height', label: 'Boy (cm)', type: 'number' },
      { key: 'notes', label: 'Not', type: 'text', defaultValue: '' }
    ]
  }
};

export interface ProductMeasurement {
  id: string;
  templateType: string;
  rawValues: Record<string, any>;
  productId?: string;
  productGroup?: string; 
  productType?: string;  
  calculatedWidth?: number;
  calculatedHeight?: number;
  details?: Record<string, any>; 
  notes: string;
  status: string; 
  // Responsibility tracking
  measuredBy: string;       // display name (legacy compat)
  measuredById?: string;    // user ID of the person who physically measured
  createdById?: string;     // user ID of the person who entered this record
  measuredDate: string;
  createdAt?: string;
  updatedAt?: string;
  notesHistory: Note[];
  photos: string[];
  videos: string[];
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface WindowItem {
  id: string;
  name: string;
  width?: number;
  height?: number;
  fieldNotes?: string;
  photos: string[];
  videos: string[];
  products: ProductMeasurement[];
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Room {
  id: string;
  name: string;
  photos: string[];
  videos: string[];
  windows: WindowItem[];
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  mapLocation: string;
  notes: string;
  rooms: Room[];
  createdAt?: string;
  updatedAt?: string;

  // Assignment metadata
  createdById?: string;
  createdByName?: string;
  assignedSalesId?: string;
  assignedSalesName?: string;
  assignedMeasureId?: string;
  assignedMeasureName?: string;
  assignedTailorId?: string;
  assignedTailorName?: string;
  assignedInstallerId?: string;
  assignedInstallerName?: string;
  workflowStatus?: string;

  // New customer card fields
  customerCode?: string;
  taxNumber?: string;
  phone2?: string;
  extraDescription?: string;
  generalNote?: string;

  // ERP V2 fields
  cariType?: 'CUSTOMER' | 'SUPPLIER' | 'TAILOR' | 'INSTALLER' | 'STAFF' | 'OTHER' | string;
  approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED';
  addressPhotos?: string[];
  isDeleted?: boolean;
  deletedAt?: string;

  // Excel Bridge Fields (Opak & V1-EXCEL)
  balance?: number;
  groupCode?: string;
  groupName?: string;
  reportCode1?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  taxOffice?: string;
  identityNumber?: string;
  dueDay?: number;
  mobile1?: string;
  mobile2?: string;
  email?: string;
  salespersonName?: string;
  isActive?: boolean;
  eInvoice?: boolean;
  authorizedPerson?: string;
  hasRisk?: boolean;
  riskLimit?: number;
  isLockedForAllTransactions?: boolean;
  
  externalSource?: 'OPAK' | 'MANUAL' | 'IMPORT';
  rawImportData?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface Product {
  id: string;
  stockCode: string;
  name: string;
  category: string;
  unit: string;
  cashPrice: number;
  installmentPrice: number;
  dealerPrice: number;
}

export interface SaleItem {
  id: string;
  customerId?: string;
  roomId?: string;
  roomName: string;
  openingId?: string;
  windowName: string; // openingName
  measurementId?: string;
  originalWidth?: number;
  originalHeight?: number;
  productId: string; // stockProductId
  productGroup: string;
  productType: string;
  calculationType?: string;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  pleatType?: string;
  wingQuantity?: number;
}

export interface Sale {
  id: string;
  customerId: string;
  totalAmount: number;
  status: string;
  date: string;
  items: SaleItem[];
}

export interface ProductionTask {
  id: string;
  saleId: string;
  customerId: string;
  items: string;
  status: string;
  deadline: string;
}

export interface MontageTask {
  id: string;
  saleId: string;
  customerId: string;
  address: string;
  date: string;
  time: string;
  status: string;
  installerAssignedTo?: string;
}

export interface ProductionIssue {
  issueType: string;
  issueDescription: string;
  responsibleEmployeeId: string;
  expectedResolutionDate: string;
  expectedMaterialArrivalDate: string;
  additionalCost: number;
  photo?: string;
  createdAt: string;
  createdBy: string;
}

export interface ProductionItemHistory {
  date: string;
  status: string;
  employeeId: string;
  notes?: string;
}

export interface ProductionItem {
  id: string;
  orderId: string;
  saleLineId: string;
  customerId: string;
  roomName: string;
  openingName: string;
  productName: string;
  productType: string;
  width: number;
  height: number;
  quantity: number;
  pleatType?: string;
  productionStatus: string;
  cutCompleted: boolean;
  sewingCompleted: boolean;
  ironingCompleted: boolean;
  packagingCompleted: boolean;
  assignedWorkshopId?: string;
  assignedEmployeeId?: string;
  dueDate: string;
  issue?: ProductionIssue;
  history: ProductionItemHistory[];
  sewingFee?: number;
  approvedExtraWorkFee?: number;
}

interface AppState {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  productionTasks: ProductionTask[];
  montageTasks: MontageTask[];
  productionItems: ProductionItem[];
  pendingDeletes: { id: string; table: 'customers' | 'rooms' | 'openings' | 'measurements' }[];
  syncStatus: 'synced' | 'pending' | 'offline' | 'error';

  addCustomer: (customer: Omit<Customer, 'rooms'> & { id?: string }) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  archiveCustomer: (id: string) => Promise<void>;
  mergeCustomers: (sourceId: string, targetId: string) => Promise<void>;
  
  addRoom: (customerId: string, roomName: string) => Promise<void>;
  deleteRoom: (customerId: string, roomId: string) => Promise<void>;
  moveRoom: (sourceCustomerId: string, targetCustomerId: string, roomId: string) => Promise<void>;
  
  addWindow: (customerId: string, roomId: string, windowName: string) => Promise<void>;
  deleteWindow: (customerId: string, roomId: string, windowId: string) => Promise<void>;

  updateRoomAttachments: (customerId: string, roomId: string, photos: string[], videos: string[]) => Promise<void>;
  updateWindowItem: (customerId: string, roomId: string, windowId: string, data: Partial<WindowItem>) => Promise<void>;

  addProductMeasurement: (customerId: string, roomId: string, windowId: string, measurement: Omit<ProductMeasurement, 'id'>) => Promise<void>;
  updateProductMeasurement: (customerId: string, roomId: string, windowId: string, measurementId: string, data: Partial<ProductMeasurement>) => Promise<void>;
  deleteProductMeasurement: (customerId: string, roomId: string, windowId: string, measurementId: string) => Promise<void>;

  initializeCustomersFromDb: () => Promise<void>;

  addSale: (saleData: { customerId: string; amount: number; items: SaleItem[]; address: string }) => void;
  updateProductionStatus: (id: string, status: string) => void;
  updateMontageStatus: (id: string, status: string) => void;
  updateMontageTask: (id: string, data: Partial<MontageTask>) => void;
  
  addProductionItem: (item: ProductionItem) => void;
  updateProductionItem: (id: string, data: Partial<ProductionItem>) => void;
  setProductionItems: (items: ProductionItem[]) => void;

  setSyncStatus: (status: 'synced' | 'pending' | 'offline' | 'error') => void;
  setCustomers: (customers: Customer[]) => void;
  clearPendingDeletes: () => void;
}

const mockProducts: Product[] = [
  { id: '1', stockCode: 'TUL-001', name: 'Keten Görünümlü Tül', category: 'Tül', unit: 'Metre', cashPrice: 150, installmentPrice: 180, dealerPrice: 100 },
  { id: '2', stockCode: 'GUN-002', name: 'Blackout Güneşlik', category: 'Güneşlik', unit: 'Metre', cashPrice: 200, installmentPrice: 240, dealerPrice: 130 },
  { id: '3', stockCode: 'JAL-003', name: 'Ahşap Jaluzi 50mm', category: 'Jaluzi', unit: 'm²', cashPrice: 850, installmentPrice: 950, dealerPrice: 600 },
  { id: '4', stockCode: 'FON-004', name: 'Kadife Fon Perde', category: 'Fon', unit: 'Metre', cashPrice: 400, installmentPrice: 450, dealerPrice: 300 },
  { id: '5', stockCode: 'ZEB-005', name: 'Bambu Zebra Stor', category: 'Zebra', unit: 'm²', cashPrice: 350, installmentPrice: 400, dealerPrice: 250 },
  { id: '6', stockCode: 'RUS-006', name: 'Ahşap Rustik Boru', category: 'Rustik', unit: 'Metre', cashPrice: 600, installmentPrice: 650, dealerPrice: 400 },
  { id: '7', stockCode: 'PLI-007', name: 'Cam Balkon Plicell', category: 'Plicell', unit: 'm²', cashPrice: 450, installmentPrice: 500, dealerPrice: 350 },
  { id: '8', stockCode: 'STO-008', name: 'Düz Stor Perde', category: 'Stor', unit: 'm²', cashPrice: 300, installmentPrice: 350, dealerPrice: 200 },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      customers: [],
      products: mockProducts,
      sales: [],
      productionTasks: [],
      montageTasks: [],
      productionItems: [],
      pendingDeletes: [],
      syncStatus: 'synced',

      addCustomer: async (data) => {
        const state = get();
        const newCustomerId = data.id || generateUUID();
        
        // Submission/Id-based duplicate prevention:
        const exists = state.customers.some(c => c.id === newCustomerId);
        if (exists) {
          console.warn('[Store] Duplicate customer add prevented (same ID exists):', newCustomerId);
          return;
        }

        // Secondary defense: Name-based duplicate protection (within 15 seconds)
        const nowMs = Date.now();
        const isDuplicateName = state.customers.some(c => {
          const nameMatches = c.name.trim().toLowerCase() === data.name.trim().toLowerCase();
          const createdRecently = nowMs - new Date(c.createdAt || 0).getTime() < 15000;
          return nameMatches && createdRecently;
        });

        if (isDuplicateName) {
          console.warn('[Store] Duplicate customer add prevented (same name recently created):', data.name);
          return;
        }

        const now = new Date().toISOString();
        const currentUser = useAuthStore.getState().currentUser;
        
        let initialApprovalStatus: 'PENDING_APPROVAL' | 'APPROVED' = 'APPROVED';
        if (currentUser) {
          const normRole = normalizeRole(currentUser.role);
          if (normRole === 'FIELD') {
            initialApprovalStatus = 'PENDING_APPROVAL';
          }
        }

        const newCustomer: Customer = {
          ...data,
          id: newCustomerId,
          rooms: [],
          createdAt: now,
          updatedAt: now,
          createdById: currentUser?.id || "",
          createdByName: currentUser?.name || "",
          assignedSalesId: "",
          assignedSalesName: "",
          assignedMeasureId: "",
          assignedMeasureName: "",
          assignedTailorId: "",
          assignedTailorName: "",
          assignedInstallerId: "",
          assignedInstallerName: "",
          workflowStatus: "YENI",
          customerCode: data.customerCode || "",
          taxNumber: data.taxNumber || "",
          phone2: data.phone2 || "",
          extraDescription: data.extraDescription || "",
          generalNote: data.generalNote || "",
          cariType: data.cariType || "CUSTOMER",
          approvalStatus: data.approvalStatus || initialApprovalStatus,
          addressPhotos: data.addressPhotos || []
        };

        // 1. Write to IndexedDB first
        await saveLocalCustomer(newCustomer);

        // 2. Then update Zustand state
        set((state) => {
          notifyStoreChanges();
          return {
            customers: [newCustomer, ...state.customers],
            syncStatus: 'pending'
          };
        });
      },
      
      updateCustomer: async (id, data) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === id);
        if (target) {
          const updatedCustomer = {
            ...target,
            ...data,
            updatedAt: now
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === id ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      deleteCustomer: async (id) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === id);
        if (target) {
          const updatedCustomer = {
            ...target,
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            rooms: target.rooms.map(r => ({
              ...r,
              isDeleted: true,
              deletedAt: now,
              updatedAt: now,
              windows: r.windows.map(w => ({
                ...w,
                isDeleted: true,
                deletedAt: now,
                updatedAt: now,
                products: w.products.map(p => ({
                  ...p,
                  isDeleted: true,
                  deletedAt: now,
                  updatedAt: now
                }))
              }))
            }))
          };
          
          await saveLocalCustomer(updatedCustomer);
          
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === id ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },
      
      archiveCustomer: async (id) => {
        // Alias for soft-delete
        await get().deleteCustomer(id);
      },
      
      mergeCustomers: async (sourceId, targetId) => {
        const state = get();
        const sourceCustomer = state.customers.find(c => c.id === sourceId);
        const targetCustomer = state.customers.find(c => c.id === targetId);
        
        if (!sourceCustomer || !targetCustomer) return;
        
        const now = new Date().toISOString();
        
        // 1. Move rooms to target and append source details to notes
        const mergeNotes = `\n\n--- Birleştirilen Cariden Gelen Bilgiler ---\nAd: ${sourceCustomer.name}\nKod: ${sourceCustomer.customerCode || '-'}\nTel: ${sourceCustomer.phone || '-'}\nAdres: ${sourceCustomer.address || '-'}\nEski Not: ${sourceCustomer.notes || '-'}\n-----------------------------------------`;

        const updatedTargetCustomer = {
          ...targetCustomer,
          updatedAt: now,
          notes: (targetCustomer.notes || '') + mergeNotes,
          rooms: [...(targetCustomer.rooms || []), ...(sourceCustomer.rooms || [])]
        };
        
        // 2. Mark source as merged
        const updatedSourceCustomer = {
          ...sourceCustomer,
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          status: 'MERGED',
          customFields: {
            ...(sourceCustomer.customFields || {}),
            mergeHistory: {
              sourceCustomerId: sourceId,
              targetCustomerId: targetId,
              mergedAt: now,
              movedRoomsCount: sourceCustomer.rooms?.length || 0
            }
          },
          rooms: [] // Clear rooms from source to prevent duplicate rendering if un-deleted
        };
        
        await saveLocalCustomer(updatedTargetCustomer);
        await saveLocalCustomer(updatedSourceCustomer);
        
        set((state) => {
          notifyStoreChanges();
          return {
            customers: state.customers.map(c => {
              if (c.id === targetId) return updatedTargetCustomer;
              if (c.id === sourceId) return updatedSourceCustomer as any;
              return c;
            }),
            syncStatus: 'pending'
          };
        });
      },
      
      moveRoom: async (sourceCustomerId, targetCustomerId, roomId) => {
        const state = get();
        const sourceCustomer = state.customers.find(c => c.id === sourceCustomerId);
        const targetCustomer = state.customers.find(c => c.id === targetCustomerId);
        
        if (!sourceCustomer || !targetCustomer) return;
        
        const roomToMove = sourceCustomer.rooms?.find(r => r.id === roomId);
        if (!roomToMove) return;
        
        const now = new Date().toISOString();
        
        const updatedSourceCustomer = {
          ...sourceCustomer,
          updatedAt: now,
          rooms: sourceCustomer.rooms.filter(r => r.id !== roomId)
        };
        
        const updatedTargetCustomer = {
          ...targetCustomer,
          updatedAt: now,
          rooms: [...(targetCustomer.rooms || []), roomToMove]
        };
        
        await saveLocalCustomer(updatedSourceCustomer);
        await saveLocalCustomer(updatedTargetCustomer);
        
        set((state) => {
          notifyStoreChanges();
          return {
            customers: state.customers.map(c => {
              if (c.id === sourceCustomerId) return updatedSourceCustomer;
              if (c.id === targetCustomerId) return updatedTargetCustomer;
              return c;
            }),
            syncStatus: 'pending'
          };
        });
      },

      addRoom: async (customerId, roomName) => {
        const state = get();
        const now = new Date().toISOString();
        const defaultWindow: WindowItem = {
          id: generateUUID(),
          name: "Pencere 1",
          photos: [],
          videos: [],
          products: [],
          createdAt: now,
          updatedAt: now
        };
        const newRoom: Room = {
          id: generateUUID(),
          name: roomName,
          photos: [],
          videos: [],
          windows: [defaultWindow],
          createdAt: now,
          updatedAt: now
        };

        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: [...target.rooms, newRoom]
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      deleteRoom: async (customerId, roomId) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.filter(r => r.id !== roomId)
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              pendingDeletes: [...state.pendingDeletes, { id: roomId, table: 'rooms' }],
              syncStatus: 'pending'
            };
          });
        }
      },

      addWindow: async (customerId, roomId, windowName) => {
        const state = get();
        const now = new Date().toISOString();
        const newWindow: WindowItem = {
          id: generateUUID(),
          name: windowName,
          photos: [],
          videos: [],
          products: [],
          createdAt: now,
          updatedAt: now
        };

        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: [...r.windows, newWindow]
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      deleteWindow: async (customerId, roomId, windowId) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: r.windows.filter(w => w.id !== windowId)
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              pendingDeletes: [...state.pendingDeletes, { id: windowId, table: 'openings' }],
              syncStatus: 'pending'
            };
          });
        }
      },

      updateRoomAttachments: async (customerId, roomId, photos, videos) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return { ...r, photos, videos, updatedAt: now };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      updateWindowItem: async (customerId, roomId, windowId, data) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: r.windows.map(w => {
                    if (w.id === windowId) {
                      return { ...w, ...data, updatedAt: now };
                    }
                    return w;
                  })
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      addProductMeasurement: async (customerId, roomId, windowId, measurement) => {
        const state = get();
        const now = new Date().toISOString();
        const newMeas: ProductMeasurement = {
          ...measurement,
          id: generateUUID(),
          createdAt: now,
          updatedAt: now
        };

        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: r.windows.map(w => {
                    if (w.id === windowId) {
                      return {
                        ...w,
                        updatedAt: now,
                        products: [...w.products, newMeas]
                      };
                    }
                    return w;
                  })
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      updateProductMeasurement: async (customerId, roomId, windowId, measurementId, data) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: r.windows.map(w => {
                    if (w.id === windowId) {
                      return {
                        ...w,
                        updatedAt: now,
                        products: w.products.map(p => {
                          if (p.id === measurementId) {
                            return { ...p, ...data, updatedAt: now };
                          }
                          return p;
                        })
                      };
                    }
                    return w;
                  })
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              syncStatus: 'pending'
            };
          });
        }
      },

      deleteProductMeasurement: async (customerId, roomId, windowId, measurementId) => {
        const state = get();
        const now = new Date().toISOString();
        const target = state.customers.find(c => c.id === customerId);
        if (target) {
          const updatedCustomer = {
            ...target,
            updatedAt: now,
            rooms: target.rooms.map(r => {
              if (r.id === roomId) {
                return {
                  ...r,
                  updatedAt: now,
                  windows: r.windows.map(w => {
                    if (w.id === windowId) {
                      return {
                        ...w,
                        updatedAt: now,
                        products: w.products.filter(p => p.id !== measurementId)
                      };
                    }
                    return w;
                  })
                };
              }
              return r;
            })
          };
          await saveLocalCustomer(updatedCustomer);
          set((state) => {
            notifyStoreChanges();
            return {
              customers: state.customers.map(c => c.id === customerId ? updatedCustomer : c),
              pendingDeletes: [...state.pendingDeletes, { id: measurementId, table: 'measurements' }],
              syncStatus: 'pending'
            };
          });
        }
      },

      initializeCustomersFromDb: async () => {
        try {
          const dbCustomers = await loadLocalCustomers();
          if (Array.isArray(dbCustomers)) {
            set({ customers: dbCustomers });
            console.log(`[Store] Loaded ${dbCustomers.length} customers from IndexedDB.`);
          }
        } catch (err) {
          console.error('[Store] Failed to load customers from IndexedDB:', err);
        }
      },

      addSale: (saleData) => set((state) => {
        const saleId = Math.floor(1000 + Math.random() * 9000).toString();
        const date = new Date().toLocaleDateString('tr-TR');
        const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR');
        const montageDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR');

        const itemsString = saleData.items.map(i => `${i.roomName} (${i.windowName}): ${i.productType}`).join(', ');

        const newProductionItems: ProductionItem[] = saleData.items.map(item => {
          const prod = state.products.find(p => p.id === item.productId);
          const productName = prod ? prod.name : item.productType || 'Bilinmeyen Ürün';

          return {
            id: generateUUID(),
            orderId: saleId,
            saleLineId: item.id,
            customerId: saleData.customerId,
            roomName: item.roomName,
            openingName: item.windowName,
            productName: productName,
            productType: item.productType || item.productGroup || 'Ürün',
            width: item.width,
            height: item.height,
            quantity: item.quantity,
            pleatType: item.pleatType,
            productionStatus: 'READY_FOR_CUTTING',
            cutCompleted: false,
            sewingCompleted: false,
            ironingCompleted: false,
            packagingCompleted: false,
            dueDate: deadline,
            history: [
              {
                date: new Date().toISOString(),
                status: 'READY_FOR_CUTTING',
                employeeId: 'system',
                notes: 'Üretim kaydı oluşturuldu.'
              }
            ],
            sewingFee: 150,
            approvedExtraWorkFee: 0
          };
        });

        return {
          sales: [
            { id: saleId, customerId: saleData.customerId, totalAmount: saleData.amount, status: 'Üretimde', date, items: saleData.items },
            ...state.sales
          ],
          productionTasks: [
            { id: generateUUID(), saleId, customerId: saleData.customerId, items: itemsString, status: 'Kesim Bekliyor', deadline },
            ...state.productionTasks
          ],
          montageTasks: [
            { id: generateUUID(), saleId, customerId: saleData.customerId, address: saleData.address, date: montageDate, time: '10:00', status: 'Planlandı', installerAssignedTo: 'user-montaj1' },
            ...state.montageTasks
          ],
          productionItems: [
            ...newProductionItems,
            ...state.productionItems
          ]
        };
      }),

      addProductionItem: (item) => set((state) => ({
        productionItems: [item, ...state.productionItems]
      })),

      updateProductionItem: (id, data) => set((state) => {
        const updatedItems = state.productionItems.map(item => 
          item.id === id ? { ...item, ...data } : item
        );
        
        const updatedItem = updatedItems.find(item => item.id === id);
        if (updatedItem) {
          const orderId = updatedItem.orderId;
          const orderItems = updatedItems.filter(item => item.orderId === orderId);
          
          const allComplete = orderItems.length > 0 && orderItems.every(item => 
            item.productionStatus === 'READY' || item.productionStatus === 'CANCELLED'
          );
          
          const newStatus = allComplete ? 'Tamamlandı' : 'Üretimde';
          
          return {
            productionItems: updatedItems,
            productionTasks: state.productionTasks.map(t => 
              t.saleId === orderId ? { ...t, status: newStatus } : t
            ),
            sales: state.sales.map(s => 
              s.id === orderId ? { ...s, status: newStatus } : s
            )
          };
        }
        
        return { productionItems: updatedItems };
      }),

      setProductionItems: (items) => set({ productionItems: items }),

      updateProductionStatus: (id, status) => set((state) => ({
        productionTasks: state.productionTasks.map(t => t.id === id ? { ...t, status } : t)
      })),

      updateMontageStatus: (id, status) => set((state) => ({
        montageTasks: state.montageTasks.map(t => t.id === id ? { ...t, status } : t)
      })),

      updateMontageTask: (id, data) => set((state) => ({
        montageTasks: state.montageTasks.map(t => t.id === id ? { ...t, ...data } : t)
      })),

      setSyncStatus: (status) => set({ syncStatus: status }),
      setCustomers: (customers) => {
        const sanitized = sanitizeCustomersForPersist(customers);
        set({ customers: sanitized });
        saveLocalCustomers(sanitized).catch((err: any) => {
          console.error('[Store] Failed to save customers to IndexedDB in setCustomers:', err);
        });
      },
      clearPendingDeletes: () => set({ pendingDeletes: [] }),
    }),
    {
      name: 'curtain-erp-storage-v3', // V3 format
      partialize: (state) => {
        const { customers, ...rest } = state;
        return rest;
      },
      storage: createJSONStorage(() => customStoreStorage),
    }
  )
);

// ─── Local Database Backup & Wiping Protection Watchdog ───
let lastKnownCustomers: Customer[] = [];

if (typeof window !== 'undefined') {
  // 1. Initialize lastKnownCustomers from local backup on startup
  try {
    const rawBackup = window.localStorage.getItem('ceylin_customers_backup');
    if (rawBackup) {
      lastKnownCustomers = JSON.parse(rawBackup);
    }
  } catch (e) {
    console.error('[Store Backup] Failed to parse initial backup:', e);
  }

  // 2. Subscribe to store changes to protect against wipes
  useStore.subscribe((state) => {
    const current = state.customers;
    if (Array.isArray(current) && current.length > 0) {
      lastKnownCustomers = current;
      try {
        const sanitized = sanitizeCustomersForPersist(current);
        window.localStorage.setItem('ceylin_customers_backup', JSON.stringify(sanitized));
      } catch (err) {
        console.error('[Store Backup] Failed to save backup:', err);
      }
    } else if (Array.isArray(current) && current.length === 0 && lastKnownCustomers.length > 0) {
      console.warn('[Store Watchdog] Customers state was wiped! Restoring from last known local backup...');
      setTimeout(() => {
        useStore.setState({ customers: lastKnownCustomers });
      }, 0);
    }
  });
}
