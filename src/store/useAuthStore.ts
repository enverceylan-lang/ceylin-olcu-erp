import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Role Definitions ───
export type UserRole = 
  | 'ADMIN' 
  | 'OFFICE' | 'SALES'
  | 'FIELD' | 'MEASUREMENT' 
  | 'TAILOR' | 'PRODUCTION' 
  | 'INSTALLER' | 'INSTALLATION';

export interface MockUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  permissions?: string[];
}

export function normalizeRole(role: UserRole | undefined): 'ADMIN' | 'OFFICE' | 'FIELD' | 'TAILOR' | 'INSTALLER' {
  if (!role) return 'ADMIN';
  if (role === 'SALES') return 'OFFICE';
  if (role === 'MEASUREMENT') return 'FIELD';
  if (role === 'PRODUCTION') return 'TAILOR';
  if (role === 'INSTALLATION') return 'INSTALLER';
  return role as any;
}

export function normalizeUser(user: any): MockUser {
  if (!user) {
    return {
      id: 'user-admin',
      name: 'Yönetici (Admin)',
      username: 'admin',
      role: 'ADMIN',
      isActive: true,
      permissions: []
    };
  }

  const role = user.role || 'ADMIN';
  const isActive = typeof user.isActive === 'boolean' ? user.isActive : true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];

  return {
    ...user,
    role,
    isActive,
    permissions
  };
}

export function getUserPermissions(user: any): string[] {
  if (!user) return [];
  const normalized = normalizeUser(user);
  return normalized.permissions || [];
}

// ─── Role-based access labels ───
export const ROLE_PERMISSIONS: Record<string, { label: string; canOverrideMeasuredBy: boolean; canAccessOfficeMode: boolean }> = {
  ADMIN: { label: 'Yönetici (Admin)', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
  OFFICE: { label: 'Ofis / Moderatör', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
  SALES: { label: 'Ofis / Moderatör', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
  FIELD: { label: 'Saha / Plasiyer', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
  MEASUREMENT: { label: 'Saha / Plasiyer', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
  TAILOR: { label: 'Terzi / Üretici', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
  PRODUCTION: { label: 'Terzi / Üretici', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
  INSTALLER: { label: 'Montaj Ekibi', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
  INSTALLATION: { label: 'Montaj Ekibi', canOverrideMeasuredBy: false, canAccessOfficeMode: false },
};

export const INITIAL_USERS: MockUser[] = [
  { id: 'user-admin', name: 'Yönetici (Admin)', username: 'admin', password: '123', role: 'ADMIN', isActive: true, permissions: [] },
  { id: 'user-sales', name: 'Ayşe (Satış)', username: 'satis', password: '123', role: 'OFFICE', isActive: true, permissions: [] },
  { id: 'user-nihat', name: 'Nihat (Ölçü)', username: 'nihat', password: '123', role: 'FIELD', isActive: true, permissions: [] },
  { id: 'user-mehmet', name: 'Mehmet (Ölçü)', username: 'mehmet', password: '123', role: 'FIELD', isActive: true, permissions: [] },
  { id: 'user-uretim1', name: 'Hasan (Terzi)', username: 'terzi', password: '123', role: 'TAILOR', isActive: true, permissions: [] },
  { id: 'user-montaj1', name: 'Ali (Montaj)', username: 'installer', password: '123', role: 'INSTALLER', isActive: true, permissions: [] },
];

// Re-export for legacy file compatibility
export const MOCK_USERS = INITIAL_USERS;

// ─── Permission Helpers ───

export function canViewModule(role: UserRole | undefined, modulePath: string): boolean {
  const normRole = normalizeRole(role);
  if (normRole === 'ADMIN') return true;
  
  // Normalize layout paths or names
  const clean = modulePath.toLowerCase().replace('/', '').split('?')[0].split('#')[0];
  
  if (normRole === 'OFFICE') {
    // Allowed: dashboard, cariler, olculer, satis, raporlar
    return clean === '' || clean.startsWith('cariler') || clean.startsWith('olculer') || clean.startsWith('satis') || clean.startsWith('raporlar');
  }
  if (normRole === 'FIELD') {
    // Allowed: dashboard, cariler, olculer
    return clean === '' || clean.startsWith('cariler') || clean.startsWith('olculer');
  }
  if (normRole === 'TAILOR') {
    // Allowed: uretim
    return clean.startsWith('uretim');
  }
  if (normRole === 'INSTALLER') {
    // Allowed: montaj
    return clean.startsWith('montaj');
  }
  return false;
}

export function canEditModule(role: UserRole | undefined, modulePath: string): boolean {
  const normRole = normalizeRole(role);
  if (normRole === 'ADMIN') return true;
  
  const clean = modulePath.toLowerCase().replace('/', '').split('?')[0].split('#')[0];

  if (normRole === 'OFFICE') {
    // Cannot edit settings
    if (clean.startsWith('ayarlar')) return false;
    return true;
  }
  if (normRole === 'FIELD') {
    return clean.startsWith('cariler') || clean.startsWith('olculer');
  }
  if (normRole === 'TAILOR') {
    return clean.startsWith('uretim');
  }
  if (normRole === 'INSTALLER') {
    return clean.startsWith('montaj');
  }
  return false;
}

export function canViewCustomer(user: any, customer: any): boolean {
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE') return true;
  if (normRole === 'FIELD') {
    // If a customer has no rooms/openings/measurements, any field personnel can see them to start
    if (!customer.rooms || customer.rooms.length === 0) return true;
    
    const hasMeasurements = customer.rooms.some((r: any) => 
      r.windows && r.windows.some((w: any) => w.products && w.products.length > 0)
    );
    if (!hasMeasurements) return true;
    
    // Otherwise, must have been created or measured by this user
    return customer.rooms.some((r: any) => 
      r.windows && r.windows.some((w: any) => 
        w.products && w.products.some((p: any) => 
          p.measuredById === safeUser.id || 
          p.createdById === safeUser.id || 
          p.measuredBy === safeUser.name
        )
      )
    );
  }
  return false;
}

export function canViewMeasurement(user: any, measurement: any): boolean {
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE') return true;
  if (normRole === 'FIELD') {
    return (
      measurement.measuredById === safeUser.id ||
      measurement.createdById === safeUser.id ||
      measurement.measuredBy === safeUser.name
    );
  }
  return false;
}

export function canViewProductionTask(user: any, task: any): boolean {
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE') return true;
  if (normRole === 'TAILOR') {
    // Tailor sees only production tasks assigned to self
    return task.assignedEmployeeId === safeUser.id;
  }
  return false;
}

export function canViewInstallationTask(user: any, task: any): boolean {
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE') return true;
  if (normRole === 'INSTALLER') {
    // Installer sees only installation tasks assigned to self
    return task.installerAssignedTo === safeUser.id;
  }
  return false;
}

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
  users: MockUser[];
  currentUser: MockUser | null;
  auditLog: AuditEntry[];
  
  login: (username: string, pin: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => void;
  
  // User Management
  addUser: (user: Omit<MockUser, 'id'>) => void;
  updateUser: (id: string, data: Partial<MockUser>) => void;
  deleteUser: (id: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: INITIAL_USERS,
      currentUser: INITIAL_USERS[0], // Keep first user logged in by default
      auditLog: [],
      
      login: (username: string, pin: string) => {
        const user = get().users.find((u: MockUser) => u.username.toLowerCase() === username.toLowerCase() && u.password === pin);
        if (user && user.isActive) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },
      
      logout: () => set({ currentUser: null }),
      
      switchUser: (userId: string) => set((state: AuthState) => {
        const user = state.users.find((u: MockUser) => u.id === userId);
        if (!user || !user.isActive) return {};
        return { currentUser: user };
      }),
      
      addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => set((state: AuthState) => ({
        auditLog: [
          { ...entry, id: crypto.randomUUID() },
          ...state.auditLog
        ]
      })),
      
      addUser: (user: Omit<MockUser, 'id'>) => set((state: AuthState) => ({
        users: [...state.users, { ...user, id: 'user-' + Math.random().toString(36).substring(2, 9) }]
      })),
      
      updateUser: (id: string, data: Partial<MockUser>) => set((state: AuthState) => {
        const updatedUsers = state.users.map((u: MockUser) => u.id === id ? { ...u, ...data } : u);
        // Sync currentUser if it's the one modified
        const updatedCurrentUser = state.currentUser && state.currentUser.id === id 
          ? { ...state.currentUser, ...data } 
          : state.currentUser;
        return {
          users: updatedUsers,
          currentUser: updatedCurrentUser
        };
      }),
      
      deleteUser: (id: string) => set((state: AuthState) => ({
        users: state.users.filter((u: MockUser) => u.id !== id),
        currentUser: state.currentUser && state.currentUser.id === id ? null : state.currentUser
      })),
    }),
    {
      name: 'curtain-erp-auth-v1',
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState) return currentState;
        
        // ─── Run Migration/Normalizations ───
        let changed = false;
        let users = persistedState.users;
        if (Array.isArray(users)) {
          users = users.map((u: any) => {
            const norm = normalizeUser(u);
            if (JSON.stringify(norm) !== JSON.stringify(u)) {
              changed = true;
            }
            return norm;
          });
        } else {
          users = currentState.users;
          changed = true;
        }

        let currentUser = persistedState.currentUser;
        if (currentUser) {
          const normCur = normalizeUser(currentUser);
          const isValid = users.some((u: any) => u.id === normCur.id && u.isActive);
          if (!isValid) {
            currentUser = null; // log out invalid/inactive user
            changed = true;
          } else if (JSON.stringify(normCur) !== JSON.stringify(currentUser)) {
            currentUser = normCur;
            changed = true;
          }
        }

        return {
          ...currentState,
          ...persistedState,
          users,
          currentUser
        };
      }
    }
  )
);
