
// constants.ts
import { User, UserRole, Permission, Database, FieldDefinition, Quotation } from './types';
import { BookingState } from './types';

// export const AVAILABLE_PERMISSIONS = Object.values(Permission);
export const AVAILABLE_PERMISSIONS = [
  Permission.BOOKING_READ,
  Permission.BOOKING_CREATE,
  Permission.BOOKING_UPDATE,
  Permission.BOOKING_DELETE,
  Permission.BOOKING_LOCK,
  Permission.QUOTATION_READ,
  Permission.QUOTATION_CREATE,
  Permission.QUOTATION_UPDATE,
  Permission.QUOTATION_DELETE,
  Permission.FINANCE_READ,
  Permission.FINANCE_UPDATE,
  Permission.FINANCE_LOCK,
  Permission.SAF_FINANCE_READ,
  Permission.SAF_FINANCE_UPDATE,
  Permission.SAF_FINANCE_LOCK,
  Permission.CMA_FINANCE_READ,
  Permission.CMA_FINANCE_UPDATE,
  Permission.CMA_FINANCE_LOCK,
  Permission.CONCORD_FINANCE_READ,
  Permission.CONCORD_FINANCE_UPDATE,
  Permission.CONCORD_FINANCE_LOCK,
  Permission.ADMIN_READ,
  Permission.ADMIN_UPDATE,
  Permission.SETTINGS_READ,
  Permission.SETTINGS_UPDATE,
];

// 添加 PERMISSION_GROUPS 常量
export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  Booking: [
    Permission.BOOKING_READ,
    Permission.BOOKING_CREATE,
    Permission.BOOKING_UPDATE,
    Permission.BOOKING_DELETE,
    Permission.BOOKING_LOCK,
  ],
  Quotation: [
    Permission.QUOTATION_READ,
    Permission.QUOTATION_CREATE,
    Permission.QUOTATION_UPDATE,
    Permission.QUOTATION_DELETE,
  ],
  Finance: [
    Permission.FINANCE_READ,
    Permission.FINANCE_UPDATE,
    Permission.FINANCE_LOCK,
  ],
  SAF_Finance: [
    Permission.SAF_FINANCE_READ,
    Permission.SAF_FINANCE_UPDATE,
    Permission.SAF_FINANCE_LOCK,
  ],
  CMA_Finance: [
    Permission.CMA_FINANCE_READ,
    Permission.CMA_FINANCE_UPDATE,
    Permission.CMA_FINANCE_LOCK,
  ],
  Concord_Finance: [
    Permission.CONCORD_FINANCE_READ,
    Permission.CONCORD_FINANCE_UPDATE,
    Permission.CONCORD_FINANCE_LOCK,
  ],
  Admin: [
    Permission.ADMIN_READ,
    Permission.ADMIN_UPDATE,
  ],
  Settings: [
    Permission.SETTINGS_READ,
    Permission.SETTINGS_UPDATE,
  ],
};

// 或者在初始化管理员用户时，确保分配了所有权限
export const MOCK_ADMIN: User = {
  id: 'admin-1',
  username: 'admin',
  password: 'admin',
  firstName: 'Admin',
  role: UserRole.ADMIN,
  permissions: Object.values(Permission), // 分配所有权限
  isApproved: true
};

// --- Dropdown Defaults ---
export const INITIAL_CARRIERS = ['COSCO', 'MAERSK', 'CMA CGM', 'HMM', 'ONE', 'EVERGREEN', 'MSC', 'OOCL'];
export const INITIAL_CLIENTS = ['Walmart', 'Target', 'IKEA', 'Amazon', 'Nike', 'Home Depot'];
export const INITIAL_SERVICES = ['AC1', 'AX1', 'PNW', 'FE2', 'AAC2', 'AWE3'];
export const INITIAL_POLS = ['Shanghai', 'Ningbo', 'Qingdao', 'Shenzhen', 'Yantian', 'Xiamen', 'Tianjin', 'Dalian'];
export const INITIAL_PODS = ['Los Angeles', 'Long Beach', 'Rotterdam', 'Hamburg', 'New York', 'Savannah', 'Felixstowe', 'Durban', 'Cape Town', 'Le Havre', 'Antwerp'];
export const INITIAL_CONTAINER_TYPES = ['20GP', '40GP', '40HQ', '45HQ', '20OT', '40OT', '20RF', '40RF'];
export const INITIAL_STATUSES = ['PENDING', 'CONFIRMED', 'GATED_IN', 'CANCELLED', 'ROLLING', 'COMBINED'];
export const INITIAL_JOBS = [];  // 添加默认的 jobs
export const INITIAL_ALLOCATIONS = [];    // 添加默认的 allocations
export const INITIAL_REMARKS = [];    // 添加默认的 remarks

// --- Default Field Schema ---
export const DEFAULT_FIELDS: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'SELECT', options: INITIAL_STATUSES, isSystem: true, width: 'w-32' },
  { key: 'week', label: 'Week', type: 'TEXT', isSystem: true, width: 'w-24' },
  { key: 'bookingRef', label: 'Booking Ref', type: 'TEXT', isSystem: true, width: 'w-40' },
  { key: 'carrier', label: 'Carrier', type: 'SELECT', options: INITIAL_CARRIERS, width: 'w-32' },
  { key: 'client', label: 'Client', type: 'SELECT', options: INITIAL_CLIENTS, width: 'w-32' },
  { key: 'service', label: 'Service', type: 'SELECT', options: INITIAL_SERVICES, isSystem: true, width: 'w-24' },
  { key: 'pol', label: 'POL', type: 'SELECT', options: INITIAL_POLS, width: 'w-32' },
  { key: 'pod', label: 'POD', type: 'SELECT', options: INITIAL_PODS, width: 'w-32' },
  { key: 'etd', label: 'ETD', type: 'DATE', isSystem: true, width: 'w-32' },
  { key: 'vessel', label: 'Vessel', type: 'TEXT', width: 'w-40' },
  { key: 'type', label: 'Type', type: 'SELECT', options: INITIAL_CONTAINER_TYPES, width: 'w-24' },
  { key: 'qty', label: 'Qty', type: 'NUMBER', width: 'w-16' },
  { key: 'gateinrate', label: 'Gate In', type: 'DATE', width: 'w-32' },
  { key: 'job', label: 'Job', type: 'SELECT', width: 'w-32' },      // 改为 TEXT 类型
  { key: 'allocation', label: 'Allocation', type: 'SELECT', width: 'w-32' }, // 改为 TEXT 类型
  { key: 'remark', label: 'Remark', type: 'TEXT', width: 'w-40' }, // 添加 REMARK 字段
];
