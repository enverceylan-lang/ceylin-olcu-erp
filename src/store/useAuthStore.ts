import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { normalizeUsername } from '@/lib/usernameHelper';

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
  | 'MODERATOR'
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
  profileCompletedAt?: string;
  hasPassword?: boolean;
}

export function normalizeRole(role: UserRole | undefined): 'ADMIN' | 'MODERATOR' | 'OFFICE' | 'FIELD' | 'TAILOR' | 'INSTALLER' | 'ACCOUNTING' {
  if (!role) return 'ADMIN';
  if (role === 'SALES') return 'OFFICE';
  if (role === 'MEASUREMENT') return 'FIELD';
  if (role === 'PRODUCTION') return 'TAILOR';
  if (role === 'INSTALLATION') return 'INSTALLER';
  return role;
}

export function sanitizeAuditSnapshot(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeAuditSnapshot(item));
  }
  if (typeof obj === 'object') {
    const redactedFields = new Set([
      'password', 'pin', 'passwordhash', 'hash', 'salt', 'token',
      'accesstoken', 'refreshtoken', 'sessiontoken', 'jwt',
      'recoverytoken', 'secret', 'servicerolekey'
    ]);
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      if (redactedFields.has(key.toLowerCase())) {
        continue;
      }
      cleaned[key] = sanitizeAuditSnapshot(obj[key]);
    }
    return cleaned;
  }
  return obj;
}

export function sanitizeAuditEntry(entry: any): any {
  if (!entry) return entry;
  const cleaned = { ...entry };
  if (cleaned.beforeSnapshot) {
    cleaned.beforeSnapshot = sanitizeAuditSnapshot(cleaned.beforeSnapshot);
  }
  if (cleaned.afterSnapshot) {
    cleaned.afterSnapshot = sanitizeAuditSnapshot(cleaned.afterSnapshot);
  }
  if (cleaned.previousValue) {
    try {
      const parsed = JSON.parse(cleaned.previousValue);
      cleaned.previousValue = JSON.stringify(sanitizeAuditSnapshot(parsed));
    } catch (e) {
      // If it's not JSON, do nothing
    }
  }
  if (cleaned.newValue) {
    try {
      const parsed = JSON.parse(cleaned.newValue);
      cleaned.newValue = JSON.stringify(sanitizeAuditSnapshot(parsed));
    } catch (e) {
      // If it's not JSON, do nothing
    }
  }
  return cleaned;
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

  // Normalize legacy fields
  const rawName = (user.name && user.name !== 'İsimsiz Kullanıcı') ? user.name : '';
  const legacyName = (rawName || user.fullName || user.adSoyad || user.displayName || '').trim();
  const legacyEmail = (user.email || user.emailAddress || user.mail || '').trim();
  const legacyPhone = (user.phone || user.phoneNumber || user.telefon || '').trim();

  const role = user.role || (user.id === 'user-admin' ? 'ADMIN' : 'FIELD');
  const isActive = typeof user.isActive === 'boolean' ? user.isActive : true;
  const username = (user.username || legacyName || user.id || '').trim().toLowerCase().replace(/\s+/g, '');
  const password = typeof user.password === 'string' ? user.password.trim() : user.password;
  
  const permissions = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions 
    : getRoleDefaultPermissions(role);

    const profileCompletedAt =
    typeof user.profileCompletedAt === 'string' &&
    user.profileCompletedAt.trim() !== ''
      ? user.profileCompletedAt
      : undefined;

  return {
    ...user,
    id: user.id || 'user-' + Math.random().toString(36).substring(2, 9),
    name: legacyName || 'İsimsiz Kullanıcı',
    email: legacyEmail || undefined,
    phone: legacyPhone || undefined,
    username,
    password,
    role,
    isActive,
    permissions,
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now,
    profileCompletedAt
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
  MODERATOR: { label: 'Moderatör', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
  OFFICE: { label: 'Ofis', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
  SALES: { label: 'Satış', canOverrideMeasuredBy: true, canAccessOfficeMode: true },
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
  
  if (normRole === 'MODERATOR') {
    // Allowed: dashboard, cariler, olculer, satis, stok, uretim, montaj, raporlar (Everything EXCEPT ayarlar)
    return clean !== 'ayarlar';
  }
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

  if (normRole === 'MODERATOR') {
    // Cannot edit settings, cannot change roles (handled in settings usually)
    if (clean.startsWith('ayarlar')) return false;
    return true;
  }
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
  const normRole = normalizeRole(safeUser.role);
  
  if (normRole === 'ADMIN') return true;
  
  if (normRole === 'MODERATOR' || normRole === 'OFFICE' || normRole === 'ACCOUNTING') {
    return cariType === 'CUSTOMER';
  }
  
  return false;
}

export function canViewCariList(user: any): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  // ADMIN and MODERATOR can see the list. SAHA, TERZİ, MONTAJCI cannot.
  return normRole === 'ADMIN' || normRole === 'MODERATOR' || normRole === 'OFFICE' || normRole === 'ACCOUNTING';
}

export function canAddCustomer(user: any): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  // ADMIN, MODERATOR, SAHA can add customers
  return normRole === 'ADMIN' || normRole === 'MODERATOR' || normRole === 'OFFICE' || normRole === 'ACCOUNTING' || normRole === 'FIELD';
}

export function canImportExportExcel(user: any): boolean {
  if (!user) return false;
  const safeUser = normalizeUser(user);
  const normRole = normalizeRole(safeUser.role);
  return normRole === 'ADMIN';
}

export function canEditCari(user: any, cariType: string): boolean {
  if (!user) return false;
  const normRole = normalizeRole(user.role || normalizeUser(user).role);
  if (normRole === 'ADMIN') return true;
  if ((normRole === 'MODERATOR' || normRole === 'OFFICE' || normRole === 'ACCOUNTING') && (cariType === 'CUSTOMER' || !cariType)) return true;
  return false;
}

export function canMergeCari(user: any): boolean {
  if (!user) return false;
  return normalizeRole(user.role || normalizeUser(user).role) === 'ADMIN';
}

export function canArchiveCari(user: any, cariType: string): boolean {
  if (!user) return false;
  const normRole = normalizeRole(user.role || normalizeUser(user).role);
  if (normRole === 'ADMIN') return true;
  return false;
}

export function canChangeCariCode(user: any): boolean {
  if (!user) return false;
  return normalizeRole(user.role || normalizeUser(user).role) === 'ADMIN';
}

export function canMoveMeasurementBetweenCustomers(user: any): boolean {
  if (!user) return false;
  return normalizeRole(user.role || normalizeUser(user).role) === 'ADMIN';
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
  
  const normRole = normalizeRole(role);

  if (normRole === 'ADMIN' || normRole === 'OFFICE' || role === 'ACCOUNTING') {
    if (!canViewCariType(safeUser, cType)) return false;
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
  beforeSnapshot?: any;
  afterSnapshot?: any;
  changedFields?: string[];
}

// ─── Auth State ───
interface AuthState {
  users: MockUser[];
  currentUser: MockUser | null;
  auditLog: AuditEntry[];
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  rememberMe: boolean;

  login: (username: string, pin: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => void;
  
  // User Management
  addUser: (user: Omit<MockUser, 'id'>) => Promise<boolean>;
  updateUser: (id: string, data: Partial<MockUser>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  fetchUsers: () => Promise<boolean>;
}

const safeAuthStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(name) || window.sessionStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;

    try {
      const parsed = JSON.parse(value);
      const rememberMe = parsed?.state?.rememberMe === true;
      const target = rememberMe ? window.localStorage : window.sessionStorage;
      const other = rememberMe ? window.sessionStorage : window.localStorage;

      target.setItem(name, value);
      other.removeItem(name);
    } catch {
      window.sessionStorage.setItem(name, value);
      window.localStorage.removeItem(name);
    }
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
    window.sessionStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: INITIAL_USERS,
      currentUser: null, // Start logged out by default
      auditLog: [],
      sessionToken: null,
      sessionExpiresAt: null,
      rememberMe: false,

      login: async (username: string, pin: string, rememberMe = false) => {
        const cleanInputUsername = normalizeUsername(username);
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

        // Always authenticate via server API
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: cleanInputUsername,
              password: cleanInputPin,
              rememberMe
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (
              result.success &&
              result.user &&
              result.session?.token &&
              result.session?.expiresAt
            ) {
              const remoteUser = normalizeUser({
                ...result.user,
                password: undefined
              });

              const cleanedUsers = get().users.map((u: MockUser) => ({
                ...u,
                password: undefined
              }));

              const exists = cleanedUsers.some(
                (u: MockUser) => u.id === remoteUser.id
              );

              const finalUsers = exists
                ? cleanedUsers.map((u: MockUser) =>
                    u.id === remoteUser.id ? remoteUser : u
                  )
                : [...cleanedUsers, remoteUser];

              set({
                currentUser: remoteUser,
                users: finalUsers,
                sessionToken: result.session.token,
                sessionExpiresAt: result.session.expiresAt,
                rememberMe: result.session.rememberMe === true
              });

              console.log("Login successful status:", {
                hasSession: true,
                role: remoteUser.role,
                active: remoteUser.isActive,
                rememberMe: result.session.rememberMe === true
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Client server-login failed:", err);
        }

        console.log("Login attempt status:", {
          usernameExists: false,
          passwordChanged: false,
          loginAllowed: false,
          usedFallback: false,
          active: false,
          role: undefined
        });
        return false;
      },
      
      logout: () =>
        set({
          currentUser: null,
          sessionToken: null,
          sessionExpiresAt: null,
          rememberMe: false
        }),
      
      switchUser: (_userId: string) => {
        console.warn("Kullanıcı değiştirmek için yeniden giriş yapılmalıdır.");
      },
      
      addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => set((state: AuthState) => ({
        auditLog: [
          { ...entry, id: generateUUID() },
          ...state.auditLog
        ]
      })),
      
      addUser: async (user: Omit<MockUser, 'id'>) => {
        const currentUser = get().currentUser;
        const sessionToken = get().sessionToken;
        if (!currentUser || !sessionToken) {
          console.error("Yetkilendirme bilgisi eksik.");
          return false;
        }

        const normalizedUser = normalizeUsername(user.username);
        if (!normalizedUser) {
          console.error("Geçersiz kullanıcı adı.");
          return false;
        }

        const now = new Date().toISOString();
        const generatedId = 'user-' + Math.random().toString(36).substring(2, 9);
        const newUser = {
          ...user,
          username: normalizedUser,
          id: generatedId,
          isActive: true,
          profileCompletedAt: undefined,
          createdAt: now,
          updatedAt: now
        };

        try {
          const token = sessionToken;
          const response = await fetch('/api/admin/users/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newUser)
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) {
              const addedUser = normalizeUser({
                ...result.user,
                password: undefined
              });
              set((state: AuthState) => {
                const userIndex = state.users.findIndex((u: MockUser) => u.id === addedUser.id);
                let updatedUsers;
                if (userIndex > -1) {
                  updatedUsers = state.users.map((u: MockUser) => u.id === addedUser.id ? addedUser : u);
                } else {
                  updatedUsers = [...state.users, addedUser];
                }

                let updatedCurrentUser = state.currentUser;
                if (state.currentUser && state.currentUser.id === addedUser.id) {
                  updatedCurrentUser = {
                    ...addedUser,
                    password: undefined
                  };
                }

                return {
                  users: updatedUsers,
                  currentUser: updatedCurrentUser
                };
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Add user API failed:", err);
        }
        return false;
      },
      
      updateUser: async (id: string, data: Partial<MockUser>) => {
        const currentUser = get().currentUser;
        const sessionToken = get().sessionToken;
        if (!currentUser || !sessionToken) {
          console.error("Yetkilendirme bilgisi eksik.");
          return false;
        }

        const dataCopy = { ...data };
        if (dataCopy.hasOwnProperty('username') && dataCopy.username !== undefined) {
          dataCopy.username = normalizeUsername(dataCopy.username);
          if (!dataCopy.username) {
            console.error("Geçersiz kullanıcı adı.");
            return false;
          }
        }

        if (dataCopy.hasOwnProperty('password')) {
          if (dataCopy.password === undefined || dataCopy.password === null || dataCopy.password.trim() === '' || dataCopy.password.trim() === '••••') {
            delete dataCopy.password;
          } else {
            dataCopy.password = dataCopy.password.trim();
          }
        }

        try {
          const token = sessionToken;
          const response = await fetch('/api/admin/users/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id, ...dataCopy })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.user) {
              const updatedUserFromServer = normalizeUser(result.user);
              
              const targetUserBefore = get().users.find((u: MockUser) => u.id === id);
              const beforeSnapshot: any = targetUserBefore ? { ...targetUserBefore } : null;
              const afterSnapshot: any = {
                ...updatedUserFromServer
              };

              const fieldsToCheck = ['name', 'email', 'phone', 'tcNo', 'address', 'role', 'isActive'];
              const changedFields: string[] = [];

              const isPasswordChanged = dataCopy.password !== undefined && dataCopy.password !== null && dataCopy.password.trim() !== '' && dataCopy.password.trim() !== '••••';

              if (isPasswordChanged) {
                changedFields.push('passwordChanged');
                if (beforeSnapshot) {
                  beforeSnapshot.hasPassword = !!targetUserBefore?.password;
                }
                afterSnapshot.hasPassword = true;
                afterSnapshot.passwordChanged = true;
              } else {
                if (beforeSnapshot) {
                  beforeSnapshot.hasPassword = !!targetUserBefore?.password;
                }
                afterSnapshot.hasPassword = !!targetUserBefore?.password;
              }

              if (beforeSnapshot) {
                fieldsToCheck.forEach((f) => {
                  const prevVal = (beforeSnapshot as any)[f];
                  const newVal = (afterSnapshot as any)[f];
                  if (prevVal !== newVal) {
                    changedFields.push(f);
                  }
                });
              }

              if (currentUser && normalizeRole(currentUser.role) === 'ADMIN' && changedFields.length > 0) {
                const sanitizedBefore = beforeSnapshot ? sanitizeAuditSnapshot(beforeSnapshot) : null;
                const sanitizedAfter = sanitizeAuditSnapshot(afterSnapshot);

                set((state: AuthState) => {
                  const newAuditEntry: AuditEntry = {
                    id: generateUUID(),
                    entityType: 'USER',
                    entityId: id,
                    field: changedFields.join(', '),
                    previousValue: sanitizedBefore ? JSON.stringify(sanitizedBefore) : '',
                    newValue: JSON.stringify(sanitizedAfter),
                    changedBy: currentUser.id,
                    changedAt: new Date().toISOString(),
                    reason: 'Admin user update',
                    beforeSnapshot: sanitizedBefore,
                    afterSnapshot: sanitizedAfter,
                    changedFields
                  };
                  return {
                    auditLog: [newAuditEntry, ...state.auditLog]
                  };
                });
              }

              set((state: AuthState) => {
                const userIndex = state.users.findIndex((u: MockUser) => u.id === id);
                const updatedUser = {
                  ...updatedUserFromServer,
                  password: undefined
                };

                let updatedUsers;
                if (userIndex > -1) {
                  updatedUsers = state.users.map((u: MockUser) => u.id === id ? updatedUser : u);
                } else {
                  updatedUsers = [...state.users, updatedUser];
                }

                let updatedCurrentUser = state.currentUser;
                if (state.currentUser && state.currentUser.id === id) {
                  updatedCurrentUser = {
                    ...updatedUser,
                    password: undefined
                  };
                }

                return {
                  users: updatedUsers,
                  currentUser: updatedCurrentUser
                };
              });
              return true;
            }
          }
        } catch (err) {
          console.error("Update user API failed:", err);
        }
        return false;
      },
      
      deleteUser: async (id: string) => {
        const currentUser = get().currentUser;
        const sessionToken = get().sessionToken;
        if (!currentUser || !sessionToken) {
          console.error("Yetkilendirme bilgisi eksik.");
          return { success: false, error: "Yetkilendirme bilgisi eksik." };
        }

        try {
          const token = sessionToken;
          const response = await fetch('/api/admin/users/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
          });

          const result = await response.json();
          if (response.ok && result.success) {
            set((state: AuthState) => {
              const updatedUsers = state.users.filter((u: MockUser) => u.id !== id);
              return {
                users: updatedUsers
              };
            });
            return { success: true };
          } else {
            return {
              success: false,
              code: result.code || "UNKNOWN_ERROR",
              error: result.error || "Silme işlemi başarısız."
            };
          }
        } catch (err: any) {
          console.error("Delete user API failed:", err);
          return { success: false, error: err.message || "Delete user API failed" };
        }
      },

      fetchUsers: async () => {
        const currentUser = get().currentUser;
        const sessionToken = get().sessionToken;
        if (!currentUser || !sessionToken) {
          console.error("Yetkilendirme bilgisi eksik.");
          return false;
        }

        try {
          const token = sessionToken;
          const response = await fetch('/api/admin/users/update', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.users)) {
              const fetchedUsers = result.users.map((u: any) => {
                const existing = get().users.find((ex: MockUser) => ex.id === u.id);
                return normalizeUser({
                  ...u,
                  password: undefined
                });
              });

              set({ users: fetchedUsers });
              return true;
            }
          }
        } catch (err) {
          console.error("Fetch users failed:", err);
        }
        return false;
      },
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

        users = users.map((u: MockUser) => ({
          ...u,
          password: undefined
        }));

        let currentUser = persistedState.currentUser;
        const sessionToken =
          typeof persistedState.sessionToken === 'string'
            ? persistedState.sessionToken
            : null;
        const sessionExpiresAt =
          typeof persistedState.sessionExpiresAt === 'string'
            ? persistedState.sessionExpiresAt
            : null;
        const sessionIsValid =
          !!sessionToken &&
          !!sessionExpiresAt &&
          Date.parse(sessionExpiresAt) > Date.now();

        if (currentUser && sessionIsValid) {
          const normCur = normalizeUser({
            ...currentUser,
            password: undefined
          });
          const isValid = users.some(
            (u: any) => u.id === normCur.id && u.isActive
          );

          currentUser = isValid ? normCur : null;
        } else {
          currentUser = null;
        }

        let auditLog = persistedState.auditLog;
        if (Array.isArray(auditLog)) {
          auditLog = auditLog.map((entry: any) => sanitizeAuditEntry(entry));
        } else {
          auditLog = [];
        }

        return {
          ...currentState,
          ...persistedState,
          users,
          currentUser,
          auditLog,
          sessionToken: currentUser ? sessionToken : null,
          sessionExpiresAt: currentUser ? sessionExpiresAt : null,
          rememberMe: Boolean(currentUser && persistedState.rememberMe === true)
        };
      },
      storage: createJSONStorage(() => safeAuthStorage),
    }
  )
);