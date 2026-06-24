import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Fallback UUID v4 generator for insecure/HTTP mobile environments
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Role Definitions ───
export type UserRole = 
  | 'ADMIN' 
  | 'OFFICE' | 'SALES'
  | 'FIELD' | 'MEASUREMENT' 
  | 'TAILOR' | 'PRODUCTION' 
  | 'INSTALLER' | 'INSTALLATION'
  | 'ACCOUNTING';

export interface MockUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
  email?: string;
  phone?: string;
  tcNo?: string;
  address?: string;
}

export function normalizeRole(role: UserRole | undefined): 'ADMIN' | 'OFFICE' | 'FIELD' | 'TAILOR' | 'INSTALLER' | 'ACCOUNTING' {
  if (!role) return 'ADMIN';
  if (role === 'SALES') return 'OFFICE';
  if (role === 'MEASUREMENT') return 'FIELD';
  if (role === 'PRODUCTION') return 'TAILOR';
  if (role === 'INSTALLATION') return 'INSTALLER';
  return role;
}

export function getRoleDefaultPermissions(role: UserRole): string[] {
  const normRole = normalizeRole(role);
  const modules = ['dashboard', 'cariler', 'olculer', 'stok', 'satis', 'uretim', 'montaj', 'raporlar', 'ayarlar'];
  return modules.filter(m => canViewModule(normRole, m === 'dashboard' ? '' : m));
}

export function normalizeUser(user: any): MockUser {
  const now = new Date().toISOString();
  if (!user) {
    return {
      id: 'user-admin',
      name: 'Yönetici (Admin)',
      username: 'admin',
      role: 'ADMIN',
      isActive: true,
      permissions: ['dashboard', 'cariler', 'olculer', 'stok', 'satis', 'uretim', 'montaj', 'raporlar', 'ayarlar'],
      createdAt: now,
      updatedAt: now
    };
  }

  const role = user.role || (user.id === 'user-admin' ? 'ADMIN' : 'FIELD');
  const isActive = typeof user.isActive === 'boolean' ? user.isActive : true;
  const username = (user.username || user.name || user.id || '').trim().toLowerCase().replace(/\s+/g, '');
  const password = typeof user.password === 'string' ? user.password.trim() : user.password;
  
  const permissions = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions 
    : getRoleDefaultPermissions(role);

  return {
    ...user,
    id: user.id || 'user-' + Math.random().toString(36).substring(2, 9),
    name: user.name || 'İsimsiz Kullanıcı',
    username,
    password,
    role,
    isActive,
    permissions,
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now
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
  { id: 'user-admin', name: 'Yönetici (Admin)', username: 'admin', role: 'ADMIN', isActive: true, permissions: [], email: 'admin@ceylin.com', phone: '05555555551' },
  { id: 'user-sales', name: 'Ayşe (Satış)', username: 'satis', role: 'OFFICE', isActive: true, permissions: [], email: 'satis@ceylin.com', phone: '05555555552' },
  { id: 'user-nihat', name: 'Nihat (Ölçü)', username: 'nihat', role: 'FIELD', isActive: true, permissions: [], email: 'nihat@ceylin.com', phone: '05555555553' },
  { id: 'user-mehmet', name: 'Mehmet (Ölçü)', username: 'mehmet', role: 'FIELD', isActive: true, permissions: [], email: 'mehmet@ceylin.com', phone: '05555555554' },
  { id: 'user-uretim1', name: 'Hasan (Terzi)', username: 'terzi', role: 'TAILOR', isActive: true, permissions: [], email: 'terzi@ceylin.com', phone: '05555555555' },
  { id: 'user-montaj1', name: 'Ali (Montaj)', username: 'installer', role: 'INSTALLER', isActive: true, permissions: [], email: 'installer@ceylin.com', phone: '05555555556' },
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

export function canCreateCariType(user: any, cariType: string): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  
  if (role === 'SALES') {
    return cariType === 'CUSTOMER';
  }
  
  const normRole = normalizeRole(role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  if (normRole === 'FIELD') {
    return cariType === 'CUSTOMER';
  }
  return false;
}

export function canViewCariType(user: any, cariType: string): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  
  if (role === 'SALES') {
    return cariType === 'CUSTOMER';
  }
  
  const normRole = normalizeRole(role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  if (normRole === 'FIELD') {
    return cariType === 'CUSTOMER';
  }
  if (normRole === 'TAILOR' || normRole === 'INSTALLER') {
    return cariType === 'CUSTOMER';
  }
  return false;
}

export function canViewCariCard(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const userId = safeUser.id;
  
  const cType = customer.cariType || 'CUSTOMER';
  
  if (role === 'SALES') {
    return cType === 'CUSTOMER';
  }
  
  if (!canViewCariType(safeUser, cType)) {
    return false;
  }

  const normRole = normalizeRole(role);

  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }

  if (normRole === 'FIELD') {
    if (cType !== 'CUSTOMER') return false;
    
    const isAssigned = customer.assignedMeasureId === userId;
    const isCreator = customer.createdById === userId;
    const isPendingApproval = customer.approvalStatus === 'PENDING_APPROVAL';
    
    const tookMeasurement = customer.rooms?.some((room: any) =>
      room.windows?.some((win: any) =>
        win.products?.some((p: any) => p.measuredById === userId)
      )
    );
    
    return isAssigned || !!tookMeasurement || (isCreator && isPendingApproval);
  }

  if (normRole === 'TAILOR') {
    if (cType !== 'CUSTOMER') return false;
    return customer.assignedTailorId === userId;
  }

  if (normRole === 'INSTALLER') {
    if (cType !== 'CUSTOMER') return false;
    return customer.assignedInstallerId === userId;
  }

  return false;
}

export function canViewFinancialAreas(user: any): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (role === 'SALES') return false;
  
  return normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING';
}

export function canEditCustomerCoreFields(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  return false;
}

export function canEditCustomerLocation(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  
  if (normRole === 'FIELD') {
    return canViewCariCard(safeUser, customer);
  }
  
  return false;
}

export function canEditCustomerExtraDescription(user: any, customer: any): boolean {
  return canEditCustomerLocation(user, customer);
}

export function canViewCustomerContactFields(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (normRole === 'TAILOR') {
    return false;
  }
  return true;
}

export function canViewMeasurementForWork(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  return canViewCariCard(safeUser, customer);
}

export function canViewProductionFields(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (normRole === 'TAILOR') {
    return true;
  }
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  return false;
}

export function canViewInstallationFields(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (normRole === 'INSTALLER') {
    return true;
  }
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    return true;
  }
  return false;
}

export function canViewCustomer(user: any, customer: any): boolean {
  return canViewCariCard(user, customer);
}

export function canViewCustomerWorkflowReport(user: any, customer: any): boolean {
  if (!user || !customer) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  const userId = safeUser.id;
  
  if (normRole === 'ADMIN' || normRole === 'OFFICE') return true;
  
  if (normRole === 'FIELD') {
    const isAssignedMeasure = customer.assignedMeasureId === userId;
    const isCreator = customer.createdById === userId;
    const tookMeasurement = customer.rooms?.some((room: any) =>
      room.windows?.some((win: any) =>
        win.products?.some((p: any) => p.measuredById === userId)
      )
    );
    return isAssignedMeasure || isCreator || !!tookMeasurement;
  }
  
  if (normRole === 'TAILOR') {
    return customer.assignedTailorId === userId;
  }
  
  if (normRole === 'INSTALLER') {
    return customer.assignedInstallerId === userId;
  }
  
  return false;
}

export function canViewCustomerFinancialReport(user: any): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const role = safeUser.role;
  const normRole = normalizeRole(role);
  
  if (role === 'SALES') return false;
  
  return normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING';
}

export function canViewMeasurement(user: any, measurement: any): boolean {
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  if (normRole === 'ADMIN' || normRole === 'OFFICE' || normRole === 'FIELD') return true;
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
  
  login: (username: string, pin: string) => Promise<boolean>;
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
      currentUser: null, // Start logged out by default
      auditLog: [],
      
      login: async (username: string, pin: string) => {
        const cleanInputUsername = (username || '').trim().toLowerCase();
        const cleanInputPin = (pin || '').trim();
        
        if (!cleanInputUsername || !cleanInputPin) {
          console.log("Login attempt status:", {
            usernameExists: false,
            passwordChanged: false,
            loginAllowed: false,
            usedFallback: false,
            active: false,
            role: undefined
          });
          return false;
        }

        // 1. Try local authentication first
        const usersList = get().users.map((u: MockUser) => normalizeUser(u));
        const localUser = usersList.find((u: MockUser) => {
          const userUsername = (u.username || '').trim().toLowerCase();
          return userUsername === cleanInputUsername;
        });

        if (localUser && localUser.isActive) {
          const userPassword = (localUser.password || '').trim();
          if (userPassword && userPassword === cleanInputPin) {
            const loggedInUser = { ...localUser, password: cleanInputPin };
            set({ currentUser: loggedInUser });
            console.log("Login attempt status:", {
              usernameExists: true,
              passwordChanged: false,
              loginAllowed: true,
              usedFallback: false,
              active: localUser.isActive,
              role: localUser.role
            });
            return true;
          }
        }

        // 2. If local auth fails, try server authentication
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanInputUsername, password: cleanInputPin })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) {
              const remoteUser = normalizeUser(result.user);
              
              // If the user exists locally, we check if the local record is actually newer.
              // If so, it means the password has been changed locally and not synced,
              // rendering the server credentials obsolete. We reject.
              if (localUser) {
                const localUpdate = localUser.updatedAt ? new Date(localUser.updatedAt).getTime() : 0;
                const remoteUpdate = remoteUser.updatedAt ? new Date(remoteUser.updatedAt).getTime() : 0;
                
                if (localUpdate > remoteUpdate) {
                  console.log("Login attempt status:", {
                    usernameExists: true,
                    passwordChanged: false,
                    loginAllowed: false,
                    usedFallback: true,
                    active: localUser.isActive,
                    role: localUser.role
                  });
                  return false;
                }
              }

              // Server has newer record, so update local store
              const loggedInUser = { ...remoteUser, password: cleanInputPin };
              
              // Update in local users list
              const updatedUsers = get().users.map((u: MockUser) => {
                if (u.id === remoteUser.id) {
                  return loggedInUser;
                }
                return u;
              });
              
              // If not found in users list, append it
              const exists = get().users.some((u: MockUser) => u.id === remoteUser.id);
              const finalUsers = exists ? updatedUsers : [...get().users, loggedInUser];

              set({ 
                currentUser: loggedInUser,
                users: finalUsers
              });

              console.log("Login attempt status:", {
                usernameExists: true,
                passwordChanged: false,
                loginAllowed: true,
                usedFallback: true,
                active: remoteUser.isActive,
                role: remoteUser.role
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Client server-login failed:", err);
        }

        console.log("Login attempt status:", {
          usernameExists: !!localUser,
          passwordChanged: false,
          loginAllowed: false,
          usedFallback: true,
          active: localUser ? localUser.isActive : false,
          role: localUser ? localUser.role : undefined
        });
        return false;
      },
      
      logout: () => set({ currentUser: null }),
      
      switchUser: (userId: string) => set((state: AuthState) => {
        const user = state.users.find((u: MockUser) => u.id === userId);
        if (!user || !user.isActive) return {};
        return { currentUser: normalizeUser(user) };
      }),
      
      addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => set((state: AuthState) => ({
        auditLog: [
          { ...entry, id: generateUUID() },
          ...state.auditLog
        ]
      })),
      
      addUser: (user: Omit<MockUser, 'id'>) => set((state: AuthState) => {
        const now = new Date().toISOString();
        const newUser = normalizeUser({
          ...user,
          isActive: true,
          createdAt: now,
          updatedAt: now
        });
        return {
          users: [...state.users, newUser]
        };
      }),
      
      updateUser: (id: string, data: Partial<MockUser>) => set((state: AuthState) => {
        const now = new Date().toISOString();
        const dataCopy = { ...data };
        
        if (dataCopy.hasOwnProperty('password')) {
          if (dataCopy.password === undefined || dataCopy.password === null || dataCopy.password.trim() === '') {
            delete dataCopy.password;
          } else {
            dataCopy.password = dataCopy.password.trim();
          }
        }

        const updatedUsers = state.users.map((u: MockUser) => {
          if (u.id === id) {
            return normalizeUser({ ...u, ...dataCopy, updatedAt: now });
          }
          return u;
        });
        
        let updatedCurrentUser = state.currentUser;
        if (state.currentUser && state.currentUser.id === id) {
          updatedCurrentUser = normalizeUser({ ...state.currentUser, ...dataCopy, updatedAt: now });
        }
          
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
