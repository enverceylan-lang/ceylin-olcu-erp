import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore, normalizeRole } from './useAuthStore';

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
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.error('[Zustand Storage] Error reading from localStorage:', e);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
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
            localStorage.setItem(name, sanitizedValue);
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
    try {
      localStorage.removeItem(name);
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
  }[];
}

export const MEASUREMENT_TEMPLATES: Record<string, MeasurementTemplate> = {
  CURTAIN_DETAIL: {
    type: 'CURTAIN_DETAIL',
    fields: [
      { key: 'leftWall', label: 'Sol Duvar (cm)', type: 'number' },
      { key: 'windowWidth', label: 'Pencere Eni (cm)', type: 'number' },
      { key: 'rightWall', label: 'Sağ Duvar (cm)', type: 'number' },
      { key: 'ceilingGap', label: 'Tavan Boşluğu (cm)', type: 'number' },
      { key: 'windowHeight', label: 'Pencere Boyu (cm)', type: 'number' },
      { key: 'floorGap', label: 'Zemin Boşluğu (cm)', type: 'number' },
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
  cariType?: 'CUSTOMER' | 'SUPPLIER' | 'TAILOR' | 'INSTALLER' | 'STAFF' | 'OTHER';
  approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED';
  addressPhotos?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
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

  addCustomer: (customer: Omit<Customer, 'rooms'> & { id?: string }) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  addRoom: (customerId: string, roomName: string) => void;
  deleteRoom: (customerId: string, roomId: string) => void;
  
  addWindow: (customerId: string, roomId: string, windowName: string) => void;
  deleteWindow: (customerId: string, roomId: string, windowId: string) => void;

  updateRoomAttachments: (customerId: string, roomId: string, photos: string[], videos: string[]) => void;
  updateWindowItem: (customerId: string, roomId: string, windowId: string, data: Partial<WindowItem>) => void;

  addProductMeasurement: (customerId: string, roomId: string, windowId: string, measurement: Omit<ProductMeasurement, 'id'>) => void;
  updateProductMeasurement: (customerId: string, roomId: string, windowId: string, measurementId: string, data: Partial<ProductMeasurement>) => void;
  deleteProductMeasurement: (customerId: string, roomId: string, windowId: string, measurementId: string) => void;

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
    (set) => ({
      customers: [],
      products: mockProducts,
      sales: [],
      productionTasks: [],
      montageTasks: [],
      productionItems: [],
      pendingDeletes: [],
      syncStatus: 'synced',

      addCustomer: (data) => set((state) => {
        const newCustomerId = data.id || generateUUID();
        
        // Submission/Id-based duplicate prevention:
        const exists = state.customers.some(c => c.id === newCustomerId);
        if (exists) {
          console.warn('[Store] Duplicate customer add prevented (same ID exists):', newCustomerId);
          return {};
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
          return {};
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
        notifyStoreChanges();
        
        const afterCount = state.customers.length + 1;
        console.log('[Store Save Customer] Local customers count after add:', afterCount);

        return {
          customers: [newCustomer, ...state.customers],
          syncStatus: 'pending'
        };
      }),
      
      updateCustomer: (id, data) => set((state) => {
        const now = new Date().toISOString();
        const updatedCustomers = state.customers.map(c => 
          c.id === id ? { ...c, ...data, updatedAt: now } : c
        );
        notifyStoreChanges();
        return {
          customers: updatedCustomers,
          syncStatus: 'pending'
        };
      }),

      deleteCustomer: (id) => set((state) => {
        const now = new Date().toISOString();
        const updatedCustomers = state.customers.map(c => {
          if (c.id === id) {
            return {
              ...c,
              isDeleted: true,
              deletedAt: now,
              updatedAt: now,
              rooms: c.rooms.map(r => ({
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
          }
          return c;
        });
        notifyStoreChanges();
        return {
          customers: updatedCustomers,
          syncStatus: 'pending'
        };
      }),

      addRoom: (customerId, roomName) => set((state) => {
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
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: [...c.rooms, newRoom]
              };
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      deleteRoom: (customerId, roomId) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.filter(r => r.id !== roomId)
              };
            }
            return c;
          }),
          pendingDeletes: [...state.pendingDeletes, { id: roomId, table: 'rooms' }],
          syncStatus: 'pending'
        };
      }),

      addWindow: (customerId, roomId, windowName) => set((state) => {
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
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      deleteWindow: (customerId, roomId, windowId) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          pendingDeletes: [...state.pendingDeletes, { id: windowId, table: 'openings' }],
          syncStatus: 'pending'
        };
      }),

      updateRoomAttachments: (customerId, roomId, photos, videos) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
                  if (r.id === roomId) {
                    return { ...r, photos, videos, updatedAt: now };
                  }
                  return r;
                })
              };
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      updateWindowItem: (customerId, roomId, windowId, data) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      addProductMeasurement: (customerId, roomId, windowId, measurement) => set((state) => {
        const now = new Date().toISOString();
        const newMeas: ProductMeasurement = {
          ...measurement,
          id: generateUUID(),
          createdAt: now,
          updatedAt: now
        };
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      updateProductMeasurement: (customerId, roomId, windowId, measurementId, data) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          syncStatus: 'pending'
        };
      }),

      deleteProductMeasurement: (customerId, roomId, windowId, measurementId) => set((state) => {
        const now = new Date().toISOString();
        notifyStoreChanges();
        return {
          customers: state.customers.map(c => {
            if (c.id === customerId) {
              return {
                ...c,
                updatedAt: now,
                rooms: c.rooms.map(r => {
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
            }
            return c;
          }),
          pendingDeletes: [...state.pendingDeletes, { id: measurementId, table: 'measurements' }],
          syncStatus: 'pending'
        };
      }),

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
      },
      clearPendingDeletes: () => set({ pendingDeletes: [] }),
    }),
    {
      name: 'curtain-erp-storage-v3', // V3 format
      partialize: (state) => ({
        ...state,
        customers: sanitizeCustomersForPersist(state.customers),
      }),
      storage: createJSONStorage(() => customStoreStorage),
    }
  )
);
