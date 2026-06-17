import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Role Definitions ───
export type UserRole = 'ADMIN' | 'SALES' | 'MEASUREMENT' | 'PRODUCTION' | 'INSTALLATION';

export interface MockUser {
  id: string;
  name: string;
  role: UserRole;
}

// ─── Role-based access map ───
export const ROLE_PERMISSIONS: Record<UserRole, {
  label: string;
  allowedRoutes: string[];
  canOverrideMeasuredBy: boolean;
  canAccessOfficeMode: boolean;
}> = {
  ADMIN: {
    label: 'Yönetici',
    allowedRoutes: ['/', '/cariler', '/olculer', '/stok', '/satis', '/uretim', '/montaj', '/raporlar', '/ayarlar'],
    canOverrideMeasuredBy: true,
    canAccessOfficeMode: true,
  },
  SALES: {
    label: 'Satış',
    allowedRoutes: ['/', '/cariler', '/olculer', '/satis', '/stok'],
    canOverrideMeasuredBy: false,
    canAccessOfficeMode: true,
  },
  MEASUREMENT: {
    label: 'Ölçü Ekibi',
    allowedRoutes: ['/', '/cariler', '/olculer'],
    canOverrideMeasuredBy: false,
    canAccessOfficeMode: false,
  },
  PRODUCTION: {
    label: 'Üretim',
    allowedRoutes: ['/', '/uretim'],
    canOverrideMeasuredBy: false,
    canAccessOfficeMode: false,
  },
  INSTALLATION: {
    label: 'Montaj',
    allowedRoutes: ['/', '/montaj'],
    canOverrideMeasuredBy: false,
    canAccessOfficeMode: false,
  },
};

// ─── Mock Users ───
export const MOCK_USERS: MockUser[] = [
  { id: 'user-admin', name: 'Yönetici', role: 'ADMIN' },
  { id: 'user-nihat', name: 'Nihat', role: 'MEASUREMENT' },
  { id: 'user-mehmet', name: 'Mehmet', role: 'MEASUREMENT' },
  { id: 'user-mustafa', name: 'Mustafa', role: 'MEASUREMENT' },
  { id: 'user-ismail', name: 'İsmail', role: 'MEASUREMENT' },
  { id: 'user-satis1', name: 'Ayşe (Satış)', role: 'SALES' },
  { id: 'user-uretim1', name: 'Hasan (Üretim)', role: 'PRODUCTION' },
  { id: 'user-montaj1', name: 'Ali (Montaj)', role: 'INSTALLATION' },
];

// ─── Audit Entry ───
export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

// ─── Auth State ───
interface AuthState {
  currentUser: MockUser;
  auditLog: AuditEntry[];
  
  switchUser: (userId: string) => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: MOCK_USERS[0], // Default: Admin
      auditLog: [],
      
      switchUser: (userId) => set(() => {
        const user = MOCK_USERS.find(u => u.id === userId);
        if (!user) return {};
        return { currentUser: user };
      }),
      
      addAuditEntry: (entry) => set((state) => ({
        auditLog: [
          { ...entry, id: crypto.randomUUID() },
          ...state.auditLog
        ]
      })),
    }),
    {
      name: 'curtain-erp-auth-v1',
    }
  )
);
