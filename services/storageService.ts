
// storageService.ts
import { Database, User, Quotation, GateInRate } from '../types';
import { 
  MOCK_ADMIN, 
  INITIAL_CARRIERS,
  INITIAL_CLIENTS,
  INITIAL_SERVICES,
  INITIAL_POLS,
  INITIAL_PODS,
  INITIAL_CONTAINER_TYPES,
  INITIAL_STATUSES,
  INITIAL_JOBS,
  INITIAL_ALLOCATIONS,
  INITIAL_REMARKS  // 添加
} from '../constants';

const DB_KEYS = {
  USERS: 'oceanflow_users_v1',
  DATABASES: 'oceanflow_databases_v1',
  SETTINGS: 'oceanflow_settings_v1',
  SESSION: 'oceanflow_session_v1',
  QUOTATIONS: 'oceanflow_quotations_v1'
};

export interface SystemSettings {
  carriers: string[];
  clients: string[];
  services: string[];
  pols: string[];
  pods: string[];
  containerTypes: string[];
  statuses: string[];
  jobs: string[];
  allocations: string[];
  remarks: string[];  // 添加
  gateInRates: GateInRate[];
}

const DEFAULT_SETTINGS: SystemSettings = {
  carriers: INITIAL_CARRIERS,
  clients: INITIAL_CLIENTS,
  services: INITIAL_SERVICES,
  pols: INITIAL_POLS,
  pods: INITIAL_PODS,
  containerTypes: INITIAL_CONTAINER_TYPES,
  statuses: INITIAL_STATUSES,
  jobs: INITIAL_JOBS,
  allocations: INITIAL_ALLOCATIONS,
  remarks: INITIAL_REMARKS,  // 添加
  gateInRates: []
};

export const storageService = {
  // --- Users ---
  loadUsers: (): User[] => {
    try {
      const stored = localStorage.getItem(DB_KEYS.USERS);
      return stored ? JSON.parse(stored) : [MOCK_ADMIN];
    } catch (e) {
      console.error("Failed to load users", e);
      return [MOCK_ADMIN];
    }
  },
  saveUsers: (users: User[]) => {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  },

  // --- Session (Persistent Login) ---
  loadSession: (): User | null => {
    try {
      const stored = localStorage.getItem(DB_KEYS.SESSION);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },
  saveSession: (user: User) => {
    localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem(DB_KEYS.SESSION);
  },

  // --- Databases (Bookings & Fields) ---
  loadDatabases: (): Database[] => {
    try {
      const stored = localStorage.getItem(DB_KEYS.DATABASES);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load databases", e);
      return [];
    }
  },
  saveDatabases: (databases: Database[]) => {
    localStorage.setItem(DB_KEYS.DATABASES, JSON.stringify(databases));
  },

  // --- Quotations ---
  loadQuotations: (): Quotation[] => {
    try {
      const stored = localStorage.getItem(DB_KEYS.QUOTATIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load quotations", e);
      return [];
    }
  },
  saveQuotations: (quotations: Quotation[]) => {
    localStorage.setItem(DB_KEYS.QUOTATIONS, JSON.stringify(quotations));
  },

  // --- Settings (Dropdowns) ---
  loadSettings: (): SystemSettings => {
    try {
      const stored = localStorage.getItem(DB_KEYS.SETTINGS);
      const parsed = stored ? JSON.parse(stored) : {};
      
      // 确保所有字段都存在，包括新增的字段
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        // 特别确保 jobs, allocations, remarks 存在
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : DEFAULT_SETTINGS.jobs,
        allocations: Array.isArray(parsed.allocations) ? parsed.allocations : DEFAULT_SETTINGS.allocations,
        remarks: Array.isArray(parsed.remarks) ? parsed.remarks : DEFAULT_SETTINGS.remarks,
      };
    } catch (e) {
      console.error("Failed to load settings", e);
      return DEFAULT_SETTINGS;
    }
  },

  // --- Reset ---
  clearAll: () => {
    localStorage.removeItem(DB_KEYS.USERS);
    localStorage.removeItem(DB_KEYS.DATABASES);
    localStorage.removeItem(DB_KEYS.SETTINGS);
    localStorage.removeItem(DB_KEYS.SESSION);
    localStorage.removeItem(DB_KEYS.QUOTATIONS);
    window.location.reload();
  }
};
