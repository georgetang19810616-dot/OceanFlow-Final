// 用户相关类型
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export type DatabaseType = Database;

export enum Permission {
  // 原有的权限
  BOOKING_READ = 'BOOKING_READ',
  BOOKING_CREATE = 'BOOKING_CREATE',
  BOOKING_UPDATE = 'BOOKING_UPDATE',
  BOOKING_DELETE = 'BOOKING_DELETE',
  BOOKING_LOCK = 'BOOKING_LOCK',
  
  QUOTATION_READ = 'QUOTATION_READ',
  QUOTATION_CREATE = 'QUOTATION_CREATE',
  QUOTATION_UPDATE = 'QUOTATION_UPDATE',
  QUOTATION_DELETE = 'QUOTATION_DELETE',
  
  // 添加财务权限
  FINANCE_READ = 'FINANCE_READ',
  FINANCE_UPDATE = 'FINANCE_UPDATE',
  FINANCE_LOCK = 'FINANCE_LOCK',
  SAF_FINANCE_READ = 'SAF_FINANCE_READ',
  SAF_FINANCE_UPDATE = 'SAF_FINANCE_UPDATE',
  SAF_FINANCE_LOCK = 'SAF_FINANCE_LOCK',
  CMA_FINANCE_READ = 'CMA_FINANCE_READ',
  CMA_FINANCE_UPDATE = 'CMA_FINANCE_UPDATE',
  CMA_FINANCE_LOCK = 'CMA_FINANCE_LOCK',
  CONCORD_FINANCE_READ = 'CONCORD_FINANCE_READ',
  CONCORD_FINANCE_UPDATE = 'CONCORD_FINANCE_UPDATE',
  CONCORD_FINANCE_LOCK = 'CONCORD_FINANCE_LOCK',

  // 添加缺失的权限
  ADMIN_READ = 'ADMIN_READ',
  ADMIN_UPDATE = 'ADMIN_UPDATE',
  SETTINGS_READ = 'SETTINGS_READ',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
}

// 数据库权限类型（新增）
export type DatabasePermission = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOCK';

// 单个数据库的权限配置（新增）
export interface DatabaseAccess {
  databaseId: string;
  databaseName: string;
  permissions: DatabasePermission[];
  isActive: boolean;
}

// 添加缺失的 User 属性
export interface User {
  id: string;
  username: string;
  password: string;
  firstName: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  databaseAccess?: DatabaseAccess[];
  isApproved: boolean;
  avatarUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

// 在线用户
export interface PresenceUser {
  username: string;
  firstName: string;
}

// 预订状态
export enum BookingState {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  GATED_IN = 'GATED_IN',
  ROLLING = 'ROLLING',
  COMBINED = 'COMBINED',
  ROLLED = 'ROLLED'
}

// 财务数据
export interface FinanceData {
  isLocked?: boolean;
  receivable?: number;
  payable?: number;
  brokerage?: number;
  brokerageShip?: number;
  brokerageShipLocked?: boolean;
  ens?: number;
  freeCost?: number;
  docFee?: number;
  difference?: number;
  netProfit?: number;
  xiangTai?: number;
  remark?: string;
  invoiced?: boolean;  // 是否已开票
  invoicedDate?: string;  // 开票日期
  invoicedNumber?: string;  // 发票号码
  invoiceRemark?: string;  // 发票备注 - 添加这一行
  
  // SAF 财务字段
  ffeP?: number;
  sccfi?: number;
  realAP?: number;
  unitReceivable?: number;
  finalAR?: number;
  sComm?: number;
  comm?: number;
  handlingFee?: number;
}

// 分配项 - 支持备注信息
export interface Allocation {
  id: string;
  name: string;
  type?: string;
  note?: string;
  value?: string; // 兼容旧版本
}

// 预订历史记录（新增）
export interface BookingHistory {
  id: string;
  timestamp: string; // ISO格式的时间戳
  userId?: string;
  userName?: string;
  action: string; // 操作类型，如："状态变更"、"客户变更"、"创建"、"更新"等
  
  // 变更前的值
  previousStatus?: string;
  previousClient?: string;
  previousCarrier?: string;
  previousAllocation?: string;
  previousQty?: number;
  previousEtd?: string;
  
  // 变更后的值
  newStatus?: string;
  newClient?: string;
  newCarrier?: string;
  newAllocation?: string;
  newQty?: number;
  newEtd?: string;
  
  // 变更描述
  description?: string;
  
  // 其他可能变更的字段
  [key: string]: any;
}

// 预订记录
export interface Booking {
  id: string;
  week: string;
  client: string;
  carrier: string;
  service: string;
  pol: string;
  pod: string;
  vessel: string;
  bookingRef: string;

  // 关键字段
  type: string;
  qty: number;
  etd?: string;
  eta?: string;
  etb?: string;
  gateIn?: string;

  // 其他业务字段
  job?: string;
  contact?: string;
  allocation?: string; // 注意：这里仍然是string，存储的是Allocation的value值
  remark?: string;

  // 系统字段
  state: string;
  isLocked: boolean;
  finance: Record<string, any>;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  
  // 历史记录（新增）
  history?: BookingHistory[];
  
  // 允许动态字段
  [key: string]: any;
}

// 数据库 - 添加 description 属性
export interface Database {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  fields: FieldDefinition[];
  bookings: Booking[];
  createdAt?: string;
  updatedAt?: string;
  bookingsCount?: number;
}

// 字段定义 - 确保 FieldType 枚举完整
export type FieldType = 'TEXT' | 'SELECT' | 'DATE' | 'NUMBER' | 'WEEK' | 'TEXTAREA' | 'BOOLEAN';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  width?: string;
  isSystem?: boolean;
  required?: boolean;
  editable?: boolean;
  sortable?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// 聊天消息
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isMe?: boolean;
  isSystem?: boolean;
}

// 活动编辑
export interface ActiveEdit {
  bookingId: string;
  userId: string;
  userName: string;
  colorClass: string;
}

export type FilterOperator = 'equals' | 'contains' | 'greater' | 'less';
// 过滤条件
export interface FilterCondition {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: string;
}

// 报价
export interface Quotation {
  id: string;
  region?: string;
  carrier: string;
  pol: string;
  pod: string;
  vessel?: string;
  etd?: string;

  // 价格字段
  price20?: string;
  price40?: string;
  price40hq?: string;
  price45?: string;
  price40nor?: string;

  // 其他字段
  transitTime?: string;
  validity?: string;
  cutSi?: string;
  remarks?: string;
  freetime?: string;
  availableFfe?: string;
  
  // 原有的 Quotation 字段
  quoteNumber?: string;
  client?: string;
  service?: string;
  containerType?: string;
  quantity?: number;
  rate?: number;
  validFrom?: string;
  validTo?: string;
  remark?: string;
  createdAt?: string;
  updatedAt: string;
}

// 进港费率项目 - 新增
export interface GateInRateItem {
  id: string;  // 项目唯一ID
  pols: string[];  // 起运港数组
  pods: string[];  // 目的港数组
  containerTypes: string[];  // 箱型数组
  price: number;  // 价格
}

// 进港费率 - 修改
export interface GateInRate {
  id: string;  // 费率条目ID
  startDate: string;
  endDate: string;
  service?: string;
  contact?: string;
  items: GateInRateItem[];  // 改为数组，支持多个价格组合
}

// 系统设置
export interface SystemSettings {
  carriers: string[];
  clients: string[];
  services: string[];
  pols: string[];
  pods: string[];
  containerTypes: string[];
  statuses: string[];
  jobs: string[];
  allocations: Allocation[];
  remarks: string[];
  gateInRates: GateInRate[];  // 使用新的 GateInRate 类型
}

// Dashboard 组件属性
export interface DashboardProps {
  databases: Database[];
}

// SettingsPanel 组件属性
export interface SettingsPanelProps {
  carriers: string[];
  setCarriers: (v: string[]) => void;
  clients: string[];
  setClients: (v: string[]) => void;
  services: string[];
  setServices: (v: string[]) => void;
  pols: string[];
  setPols: (v: string[]) => void;
  pods: string[];
  setPods: (v: string[]) => void;
  containerTypes: string[];
  setContainerTypes: (v: string[]) => void;
  statuses: string[];
  setStatuses: (v: string[]) => void;
  jobs: string[];
  setJobs: (v: string[]) => void;
  allocations: Allocation[]; // 修改：从 string[] 改为 Allocation[]
  setAllocations: (v: Allocation[]) => void; // 修改：从 string[] 改为 Allocation[]
  remarks: string[];
  setRemarks: (v: string[]) => void;
  databases: Database[];
  addDatabase: (name: string) => void;
  renameDatabase: (id: string, newName: string) => void;
  deleteDatabase: (id: string) => void;
  onResetDatabase?: () => void;
  onImportSettings?: (settings: SystemSettings) => void;
  systemSettings: SystemSettings;
  updateSetting: (key: keyof SystemSettings, value: any) => Promise<void>;
}

// 新增：AdminPanel 组件属性（用于类型安全）
export interface AdminPanelProps {
  users: User[];
  databases: Database[]; // 新增：传递数据库列表
  onApprove: (userId: string) => void;
  onUpdatePermissions: (userId: string, permissions: Permission[]) => void;
  onUpdateDatabaseAccess: (userId: string, databaseAccess: DatabaseAccess[]) => void; // 新增：更新数据库权限
  onDeleteUser: (userId: string) => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onResetPassword?: (user: User) => void;
}

// 新增：财务面板变体类型
export type FinanceVariant = 'MY_FINANCE' | 'SAF_FINANCE' | 'CMA_FINANCE' | 'CONCORD_FINANCE';

// 邮件相关类型
export interface EmailAttachment {
  fileName: string;
  contentType: string;
  size: number;
  base64?: string;
  content?: any;
  downloadUrl?: string;
}

export interface EmailMessage {
  seqno: number;
  uid?: string;
  subject: string;
  from: string;
  to?: string;
  date: string;
  text?: string;
  headers?: Record<string, string>;
  size?: number;
  attachments?: EmailAttachment[];
}

export interface EmailSearchResult {
  success: boolean;
  found: boolean;
  bookingRef: string;
  emails: EmailMessage[];
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface EmailDownloadResult {
  success: boolean;
  bookingRef: string;
  emailUid: string;
  attachments: EmailAttachment[];
  count: number;
  message?: string;
  error?: string;
}

export interface RecentEmailsResult {
  success: boolean;
  emails: Array<{
    seqno: number;
    subject: string;
    from: string;
    date: string;
  }>;
  count: number;
  timestamp?: string;
  error?: string;
}

export interface MailConnectionTestResult {
  success: boolean;
  message: string;
  config?: {
    user: string;
    host: string;
  };
  timestamp?: string;
  error?: string;
}