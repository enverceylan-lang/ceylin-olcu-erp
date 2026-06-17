import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Note {
  date: string;
  note: string;
  author: string;
}

export interface MeasurementTemplate {
  type: string;
  fields: { key: string; label: string; type: 'number' | 'text' }[];
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
}

export interface Room {
  id: string;
  name: string;
  photos: string[];
  videos: string[];
  windows: WindowItem[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  mapLocation: string;
  notes: string;
  rooms: Room[];
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

  addCustomer: (customer: Omit<Customer, 'id' | 'rooms'>) => void;
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
  
  addProductionItem: (item: ProductionItem) => void;
  updateProductionItem: (id: string, data: Partial<ProductionItem>) => void;
  setProductionItems: (items: ProductionItem[]) => void;
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

      addCustomer: (data) => set((state) => ({
        customers: [{ ...data, id: crypto.randomUUID(), rooms: [] }, ...state.customers]
      })),
      
      updateCustomer: (id, data) => set((state) => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...data } : c)
      })),

      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.id !== id)
      })),

      addRoom: (customerId, roomName) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return { ...c, rooms: [...c.rooms, { id: crypto.randomUUID(), name: roomName, photos: [], videos: [], windows: [] }] };
          }
          return c;
        })
      })),

      deleteRoom: (customerId, roomId) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return { ...c, rooms: c.rooms.filter(r => r.id !== roomId) };
          }
          return c;
        })
      })),

      addWindow: (customerId, roomId, windowName) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return {
                    ...r,
                    windows: [...r.windows, { id: crypto.randomUUID(), name: windowName, photos: [], videos: [], products: [] }]
                  };
                }
                return r;
              })
            };
          }
          return c;
        })
      })),

      deleteWindow: (customerId, roomId, windowId) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return { ...r, windows: r.windows.filter(w => w.id !== windowId) };
                }
                return r;
              })
            };
          }
          return c;
        })
      })),

      updateRoomAttachments: (customerId, roomId, photos, videos) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return { ...r, photos, videos };
                }
                return r;
              })
            };
          }
          return c;
        })
      })),

      updateWindowItem: (customerId, roomId, windowId, data) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return {
                    ...r,
                    windows: r.windows.map(w => {
                      if (w.id === windowId) {
                        return { ...w, ...data };
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
        })
      })),

      addProductMeasurement: (customerId, roomId, windowId, measurement) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return {
                    ...r,
                    windows: r.windows.map(w => {
                      if (w.id === windowId) {
                        return { ...w, products: [...w.products, { ...measurement, id: crypto.randomUUID() }] };
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
        })
      })),

      updateProductMeasurement: (customerId, roomId, windowId, measurementId, data) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return {
                    ...r,
                    windows: r.windows.map(w => {
                      if (w.id === windowId) {
                        return {
                          ...w,
                          products: w.products.map(p => {
                            if (p.id === measurementId) {
                              return { ...p, ...data };
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
        })
      })),

      deleteProductMeasurement: (customerId, roomId, windowId, measurementId) => set((state) => ({
        customers: state.customers.map(c => {
          if (c.id === customerId) {
            return {
              ...c,
              rooms: c.rooms.map(r => {
                if (r.id === roomId) {
                  return {
                    ...r,
                    windows: r.windows.map(w => {
                      if (w.id === windowId) {
                        return { ...w, products: w.products.filter(p => p.id !== measurementId) };
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
        })
      })),

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
            id: crypto.randomUUID(),
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
            { id: crypto.randomUUID(), saleId, customerId: saleData.customerId, items: itemsString, status: 'Kesim Bekliyor', deadline },
            ...state.productionTasks
          ],
          montageTasks: [
            { id: crypto.randomUUID(), saleId, customerId: saleData.customerId, address: saleData.address, date: montageDate, time: '10:00', status: 'Planlandı' },
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

    }),
    {
      name: 'curtain-erp-storage-v3', // V3 format
    }
  )
);
