import React, { useState, useMemo, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  User, UserRole, Permission, Booking, Database as DatabaseType, 
  FieldDefinition, ChatMessage, ActiveEdit, FilterCondition, 
  Quotation, PresenceUser, SystemSettings, DatabaseAccess, DatabasePermission, 
  Allocation // 导入 Allocation 类型
} from './types';
import { 
  MOCK_ADMIN, 
  DEFAULT_FIELDS,
  AVAILABLE_PERMISSIONS // 确保导入 AVAILABLE_PERMISSIONS
} from './constants';
import { isDateField, formatDateForDisplay, formatDateForInput, getWeekLabel } from './utils/dateUtils';
import { storageService } from './services/storageService';
import { apiService } from './services/apiService';
import { 
  mapBookingFromApi, 
  mapBookingToApi, 
  mapQuotationFromApi, 
  mapUserFromApi, 
  mapDatabaseFromApi 
} from './services/dataMapper';
import { Button } from './components/Button';
import { BookingModal } from './components/BookingModal';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ColumnManager } from './components/ColumnManager';
import { UserPresence } from './components/UserPresence';
import { ChatWindow } from './components/ChatWindow';
import { PostgresTutorial } from './components/PostgresTutorial';
import { AdvancedFilter } from './components/AdvancedFilter';
import { 
  QuotationPanel, 
  type QuotationPanelRef  // 添加这行，导入 QuotationPanelRef 类型
} from './components/QuotationPanel';
import { FinancePanel, FinanceVariant } from './components/FinancePanel';
import { exportToCSV } from './utils/exportUtils';
import { parseCSV, processImportedData, generateTemplate, processImportedQuotations } from './utils/importUtils';
import { DebugPanel } from './components/DebugPanel';
import { 
  LayoutDashboard, Table as TableIcon, LogOut, Plus, Edit2, Trash2, Users, Search, Settings, 
  Download, Upload, Columns, ChevronLeft, ChevronRight, Lock, Unlock, Eye, BookOpen, FileSpreadsheet, RefreshCw, Filter,
  Ship, Anchor, Container, Loader2, Database, DollarSign, Wallet, WifiOff, X, Key, FolderTree, Shield, Clipboard, Copy, Calendar, FileText, Briefcase, Building, Globe, PieChart, UserCog, EyeOff, Camera
} from 'lucide-react';
import { ChangePasswordModal } from './components/ChangePasswordModal';

// 导入分配项工具组件
import { AllocationWithTooltip } from './components/AllocationWithTooltip';
// 导入当日放舱统计组件
import { DailyBookingStats } from './components/DailyBookingStats';

const CACHE_DURATION = 2 * 1000;

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-md ring-1 ring-white">
    {name ? name.charAt(0).toUpperCase() : '?'}
  </div>
);

// ==================== 辅助函数：检查是否为管理员 ====================
// 移动到 App 组件定义之前
const isUserAdmin = (user: User | null): boolean => {
  if (!user) return false;
  // 管理员用户：角色为ADMIN 或者 用户名为admin
  return user.role === UserRole.ADMIN || user.username.toLowerCase() === 'admin';
};

// 系统字段定义
const SYSTEM_FIELDS = ['state', 'week', 'bookingRef', 'etd'];

// 业务字段映射（存储在data JSON中）
const BUSINESS_FIELD_MAPPING: Record<string, string> = {
  'state': 'state',
  'week': 'week',
  'carrier': 'carrier',
  'service': 'service',
  'bookingRef': 'bookingRef',
  'pol': 'pol',
  'pod': 'pod',
  'etd': 'etd',
  'vessel': 'vessel',
  'qty': 'qty',
  'type': 'type',
  'client': 'client',
  'allocation': 'allocation',
  'gateIn': 'gateIn',
  'job': 'job',
  'contact': 'job', // 新增 CONTACT 字段映射
  'remark': 'remark'
};

// 验证和标准化字段定义
const validateAndNormalizeFields = (fields: FieldDefinition[]): FieldDefinition[] => {
  return fields.map(field => {
    const isSystem = SYSTEM_FIELDS.includes(field.key);
    const isBusiness = BUSINESS_FIELD_MAPPING[field.key];
    
    // 设置字段属性
    return {
      ...field,
      isSystem: isSystem,
      sortable: true,
      editable: !isSystem || (field.key !== 'week'), // week字段自动计算
      // 设置默认宽度
      width: field.width || (
        field.type === 'NUMBER' ? 'w-24' :
        field.type === 'DATE' ? 'w-36' :
        field.type === 'SELECT' ? 'w-40' :
        'w-48'
      )
    };
  });
};

// 扩展数据库类型以包含缓存信息
interface ExtendedDatabase extends DatabaseType {
  lastLoaded?: number; // 添加最后加载时间戳
}

// 修改 adaptDatabaseFromApi 函数
const adaptDatabaseFromApi = (apiData: any): ExtendedDatabase => {
  console.log('🔍 适配数据库数据:', apiData);
  
  // 映射 bookings
  const adaptedBookings = (apiData.bookings || []).map(mapBookingFromApi);
  
  // 确保每个booking都有完整的finance字段
  const bookingsWithFinance = adaptedBookings.map(booking => {
    // 如果booking没有finance字段，初始化一个空的finance对象
    if (!booking.finance) {
      return {
        ...booking,
        finance: {
          saf: {},
          cma: {},
          concord: {},
          myFinance: {}
        }
      };
    }
    
    // 确保finance对象有所有必要的子字段
    return {
      ...booking,
      finance: {
        saf: booking.finance?.saf || {},
        cma: booking.finance?.cma || {},
        concord: booking.finance?.concord || {},
        myFinance: booking.finance?.myFinance || {},
        ...booking.finance
      }
    };
  });
  
  // 构建默认字段
  const defaultFields: FieldDefinition[] = [
    { key: 'state', label: 'Status', type: 'SELECT', width: 'w-28', isSystem: true, required: true, defaultValue: 'PENDING' },
    { key: 'week', label: 'Week', type: 'WEEK', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'carrier', label: 'Carrier', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'service', label: 'Service', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'bookingRef', label: 'Booking Ref', type: 'TEXT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'pol', label: 'POL', type: 'SELECT', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'pod', label: 'POD', type: 'SELECT', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'etd', label: 'ETD', type: 'DATE', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'vessel', label: 'Vessel', type: 'TEXT', width: 'w-40', isSystem: true, required: false, defaultValue: '' },
    { key: 'qty', label: 'QTY', type: 'NUMBER', width: 'w-20', isSystem: true, required: false, defaultValue: '' },
    { key: 'type', label: 'Type', type: 'SELECT', width: 'w-24', isSystem: true, required: false, defaultValue: '' },
    { key: 'client', label: 'Client', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'allocation', label: 'Allocation', type: 'SELECT', width: 'w-28', isSystem: true, required: false, defaultValue: '' },
    { key: 'gateIn', label: 'Gate In', type: 'DATE', width: 'w-32', isSystem: true, required: false, defaultValue: '' },
    { key: 'job', label: 'Job', type: 'SELECT', width: 'w-24', isSystem: true, required: false, defaultValue: '' },
    { key: 'contact', label: 'Contact', type: 'SELECT', width: 'w-28', isSystem: true, required: false, defaultValue: '' },
    { key: 'remark', label: 'Remark', type: 'TEXT', width: 'w-48', isSystem: true, required: false, defaultValue: '' },
  ];
  
  // 处理数据库中的字段
  const apiFields = apiData.fields || [];
  let combinedFields = [...defaultFields];
  
  // 添加数据库中的自定义字段
  apiFields.forEach((apiField: any) => {
    // 检查是否已存在
    const exists = combinedFields.some(f => f.key === apiField.key);
    if (!exists) {
      combinedFields.push({
        key: apiField.key,
        label: apiField.label || apiField.key,
        type: (apiField.type || 'TEXT') as any,
        width: apiField.width || 'w-40',
        isSystem: false,
        sortable: true,
        editable: true,
        options: apiField.options || []
      });
    }
  });
  
  // 验证和标准化字段
  const normalizedFields = validateAndNormalizeFields(combinedFields);
  
  return {
    id: apiData.id || `db-${Date.now()}`,
    name: apiData.name || '未命名数据库',
    fields: normalizedFields,
    bookings: bookingsWithFinance, // 使用包含finance字段的bookings
    createdAt: apiData.created_at || apiData.createdAt || new Date().toISOString(),
    updatedAt: apiData.updated_at || apiData.updatedAt || new Date().toISOString(),
    bookingsCount: apiData.bookingsCount || bookingsWithFinance.length,
    lastLoaded: Date.now() // 添加最后加载时间戳
  };
};

const getUserColorConfig = (name: string) => {
  const configs = [
    { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-600', badge: 'bg-red-100' },
    { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-600', badge: 'bg-orange-100' },
    { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100' },
    { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-600', badge: 'bg-green-100' },
    { border: 'border-teal-500', bg: 'bg-teal-50', text: 'text-teal-600', badge: 'bg-teal-100' },
    { border: 'border-teal-500', bg: 'bg-teal-50', text: 'text-teal-600', badge: 'bg-teal-100' },
    { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', badge: 'bg-blue-100' },
    { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100' },
    { border: 'border-violet-500', bg: 'bg-violet-50', text: 'text-violet-600', badge: 'bg-violet-100' },
    { border: 'border-fuchsia-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', badge: 'bg-fuchsia-100' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return configs[Math.abs(hash) % configs.length];
};

// 在 getUserColorConfig 函数后面添加 getStatusColorConfig 函数
const getStatusColorConfig = (status: string) => {
  const statusConfigs: Record<string, { 
    bg: string; 
    text: string; 
    ring: string;
    dot: string;
  }> = {
    'PENDING': {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      ring: 'ring-amber-600/20',
      dot: 'bg-amber-500'
    },
    'CONFIRMED': {
      bg: 'bg-green-50',
      text: 'text-green-700',
      ring: 'ring-green-600/20',
      dot: 'bg-green-500'
    },
    'CANCELLED': {
      bg: 'bg-red-50',
      text: 'text-red-700',
      ring: 'ring-red-600/20',
      dot: 'bg-red-500'
    },
    'ROLLED': {
      bg: 'bg-red-100',
      text: 'text-red-800',
      ring: 'ring-red-600/30',
      dot: 'bg-red-600'
    },
    'SHIPPED': {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      ring: 'ring-blue-600/20',
      dot: 'bg-blue-500'
    },
    'DELIVERED': {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      ring: 'ring-teal-600/20',
      dot: 'bg-teal-500'
    },
    'AMENED': {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      ring: 'ring-indigo-600/20',
      dot: 'bg-indigo-500'
    },
    'ON_HOLD': {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      ring: 'ring-orange-600/20',
      dot: 'bg-orange-500'
    },
    'COMBINED': {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      ring: 'ring-gray-600/20',
      dot: 'bg-gray-500'
    },
    'COMPLETED': {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      ring: 'ring-emerald-600/20',
      dot: 'bg-emerald-500'
    }
  };
  
  // 如果没有匹配的状态，返回默认配置
  return statusConfigs[status] || {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    ring: 'ring-gray-500/10',
    dot: 'bg-gray-500'
  };
};

// 辅助函数：安全地获取数组字段 - 修改以支持 Allocation[]
const safeGetArray = <T,>(obj: any, key: keyof SystemSettings, defaultValue: T[] = []): T[] => {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const value = obj[key];
  return Array.isArray(value) ? value : defaultValue;
};

// 辅助函数：将字符串数组转换为 Allocation 数组
const convertToAllocationArray = (data: any[]): Allocation[] => {
  if (!Array.isArray(data)) return [];
  
  return data.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `alloc_${Date.now()}_${index}`,
        name: item,
        value: item,
        note: ''
      };
    } else if (typeof item === 'object' && item !== null) {
      return {
        id: item.id || `alloc_${Date.now()}_${index}`,
        name: item.name || item.value || String(item),
        value: item.value || item.name || String(item),
        note: item.note || ''
      };
    } else {
      return {
        id: `alloc_${Date.now()}_${index}`,
        name: String(item),
        value: String(item),
        note: ''
      };
    }
  });
};

// 修改 getAllocationWithNote 函数，将 allocations 作为参数
const getAllocationWithNote = (
  allocations: Allocation[], 
  allocationValue?: string
): Allocation | null => {
  if (!allocationValue) return null;
  
  // 直接查找匹配的分配项
  const allocation = allocations.find(a => a.value === allocationValue);
  
  // 如果找到直接返回，否则创建一个基础对象
  if (allocation) {
    return allocation;
  }
  
  // 如果没找到，检查是否有类似的值（大小写不敏感）
  const caseInsensitiveMatch = allocations.find(a => 
    a.value.toLowerCase() === allocationValue.toLowerCase()
  );
  
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }
  
  // 都没有找到，返回基础对象
  return { 
    id: `alloc_${Date.now()}`,
    name: allocationValue,
    value: allocationValue, 
    note: '' 
  };
};

// 获取邮件服务器连接状态
const checkEmailServerConnection = async (): Promise<{ connected: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/email/status');
    if (response.ok) {
      const data = await response.json();
      return { connected: data.connected || false, message: data.message };
    }
    return { connected: false, message: '邮件服务器连接失败' };
  } catch (error) {
    console.warn('无法检查邮件服务器连接状态:', error);
    return { connected: false, message: '邮件服务器未配置或连接失败' };
  }
};

// ==================== 邮件附件下载相关函数 ====================
// 处理下载邮件附件 - 添加邮件服务器连接检查
const handleDownloadMailAttachments = async (bookingRef: string) => {
  try {
    console.log('📧 下载邮件附件:', bookingRef);
    
    // 首先检查邮件服务器连接状态
    const connectionStatus = await checkEmailServerConnection();
    if (!connectionStatus.connected) {
      console.warn('邮件服务器连接失败:', connectionStatus.message);
      alert(`邮件服务器连接失败: ${connectionStatus.message || '请检查邮件服务器配置'}`);
      return;
    }
    
    // 1. 先搜索邮件
    const searchResult = await apiService.searchEmailByBookingRef(bookingRef);
    
    if (!searchResult.success) {
      console.error('❌ 搜索邮件失败:', searchResult.error);
      
      // 处理特定的错误消息
      let errorMessage = searchResult.error || '未知错误';
      if (errorMessage.includes('LOGIN failed')) {
        errorMessage = '邮件服务器登录失败，请检查邮件服务器配置';
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = '邮件服务器内部错误，请联系管理员';
      }
      
      alert(`搜索邮件失败: ${errorMessage}`);
      return;
    }
    
    if (!searchResult.found || searchResult.emails.length === 0) {
      alert(`未找到与 "${bookingRef}" 相关的邮件`);
      return;
    }
    
    console.log(`✅ 找到 ${searchResult.emails.length} 封相关邮件`);
    
    // 2. 查找有附件的邮件
    const emailsWithAttachments = searchResult.emails.filter(email => 
      email.attachments && email.attachments.length > 0
    );
    
    if (emailsWithAttachments.length === 0) {
      alert(`找到 ${searchResult.emails.length} 封邮件，但没有附件`);
      return;
    }
    
    console.log(`📎 找到 ${emailsWithAttachments.length} 封有附件的邮件`);
    
    // 3. 如果有多个邮件，让用户选择，这里我们默认选择第一封有附件的邮件
    const emailToDownload = emailsWithAttachments[0];
    const emailUid = emailToDownload.uid || emailToDownload.id;
    
    if (!emailUid) {
      alert('邮件缺少唯一标识符，无法下载附件');
      return;
    }
    
    console.log('📧 下载邮件附件:', { bookingRef, emailUid });
    
    // 4. 下载附件
    const downloadResult = await apiService.downloadEmailAttachments(bookingRef, emailUid);
    
    if (!downloadResult.success) {
      console.error('❌ 下载附件失败:', downloadResult.error);
      
      // 处理特定的错误消息
      let errorMessage = downloadResult.error || '未知错误';
      if (errorMessage.includes('LOGIN failed')) {
        errorMessage = '邮件服务器登录失败，请检查邮件服务器配置';
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = '邮件服务器内部错误，请联系管理员';
      }
      
      alert(`下载附件失败: ${errorMessage}`);
      return;
    }
    
    console.log('✅ 下载附件成功:', downloadResult.message);
    
    // 显示成功消息
    if (downloadResult.downloadUrl) {
      alert(`附件下载已开始。如果没有自动下载，请点击以下链接: ${downloadResult.downloadUrl}`);
    } else {
      alert('附件下载已开始，请查看浏览器下载列表。');
    }
    
  } catch (error) {
    console.error('❌ 下载邮件附件过程中出错:', error);
    
    // 处理特定的错误消息
    let errorMessage = error.message || '未知错误';
    if (errorMessage.includes('LOGIN failed')) {
      errorMessage = '邮件服务器登录失败，请检查邮件服务器配置';
    } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
      errorMessage = '邮件服务器内部错误，请联系管理员';
    } else if (errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch')) {
      errorMessage = '网络连接错误，请检查网络连接';
    }
    
    alert(`下载邮件附件失败: ${errorMessage}`);
  }
};

// 添加缺失的函数定义
const showCopyNotification = (message: string) => {
  // 移除之前的通知
  const existingNotification = document.querySelector('.copy-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'copy-notification fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-[9999] text-sm';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // 3秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 2000);
};

// 传统的复制方法（兼容性）
const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // 避免滚动到文本区域
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopyNotification('✅ 已复制到剪贴板');
    } else {
      alert('复制失败，请手动选择并复制文本');
    }
  } catch (err) {
    console.error('传统复制方法失败:', err);
    alert('复制失败，请手动选择并复制文本');
  }
  
  document.body.removeChild(textArea);
};

// 显示复制成功的通知
const showCopySuccessNotification = () => {
  // 移除之前的通知
  const existingNotification = document.querySelector('.copy-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'copy-notification fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-[9999] text-sm';
  notification.textContent = '✅ 已复制到剪贴板';
  document.body.appendChild(notification);
  
  // 3秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 2000);
};

export default function App() {
  // Auth & User State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = storageService.loadSession();
    // 确保数据库权限字段存在
    if (session && !session.databaseAccess) {
      session.databaseAccess = [];
    }
    return session;
  });
  const [users, setUsers] = useState<User[]>([]);
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authError, setAuthError] = useState('');

  // 密码修改相关状态
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordModalType, setPasswordModalType] = useState<'self' | 'admin'>('self');
  const [selectedUserForPasswordReset, setSelectedUserForPasswordReset] = useState<User | null>(null);

  // 复制源ID状态
  const [copySourceId, setCopySourceId] = useState<string | null>(null);

  // Real-time Presence & Sync State
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [activeEdits, setActiveEdits] = useState<ActiveEdit[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Main Data State
  const [databases, setDatabases] = useState<ExtendedDatabase[]>([]);
  const [activeDbId, setActiveDbId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  // Quotations State
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  // 财务模块专用数据状态
  const [financeDatabases, setFinanceDatabases] = useState<ExtendedDatabase[]>([]);
  const [isFinanceDataLoading, setIsFinanceDataLoading] = useState(false);

    // 添加Dashboard加载状态
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  
  // 添加Dashboard刷新函数
  const handleRefreshDashboard = async () => {
    setIsDashboardLoading(true);
    try {
      // 这里可以调用Dashboard的刷新逻辑
      // 由于Dashboard组件内部有自己的刷新逻辑，我们可以重新加载所有数据
      await loadAllData();
    } catch (error) {
      console.error('刷新Dashboard数据失败:', error);
    } finally {
      setIsDashboardLoading(false);
    }
  };

  // Settings - 修改：allocations 从 string[] 改为 Allocation[]
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    carriers: [], 
    clients: [], 
    services: [], 
    pols: [], 
    pods: [], 
    containerTypes: [], 
    statuses: [], 
    jobs: [],
    allocations: [], // 现在是 Allocation[] 类型
    remarks: [],
    gateInRates: []
  });
  const { carriers, clients, services, pols, pods, containerTypes, statuses, jobs, allocations, remarks } = systemSettings;

  // View State - 添加所有财务模块的tab和openclaw
  const [activeTab, setActiveTab] = useState<
    'bookings' | 'dashboard' | 'admin' | 'settings' | 'help' | 
    'quotations' | 'finance' | 'saf_finance' | 'cma_finance' | 
    'concord_finance' | 'daily_stats' | 'openclaw' // 添加当日放舱统计tab和openclaw
  >('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isColManagerOpen, setIsColManagerOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm); // 添加防抖搜索词
  
  // Filtering State
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterCondition[]>([]);

  // Pagination State - 改为前端分页
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25, // 每页19条
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Sorting State - 默认按 status 和 week 降序
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dataMenuRef = useRef<HTMLDivElement>(null);
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);

  // 加载状态
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // --- Tab Dragging State (Reorder) ---
  const [draggedDbIndex, setDraggedDbIndex] = useState<number | null>(null);

  // 排序字段映射表 - 根据字段key映射
  const sortableFields: Record<string, string> = {
    'state': 'state',
    'week': 'week',
    'carrier': 'carrier',
    'service': 'service',
    'bookingRef': 'bookingRef',
    'pol': 'pol',
    'pod': 'pod',
    'etd': 'etd',
    'vessel': 'vessel',
    'qty': 'qty',
    'type': 'type',
    'client': 'client',
    'allocation': 'allocation',
    'gateIn': 'gateIn',
    'job': 'job',
    'remark': 'remark'
  };

  // ==================== 当日放舱统计相关状态 ====================
  const [dailyStatsSearchTerm, setDailyStatsSearchTerm] = useState('');
  const [dailyStatsSelectedDate, setDailyStatsSelectedDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [dailyStatsChangeTypeFilter, setDailyStatsChangeTypeFilter] = useState<string>('all');
  const [isDailyStatsLoading, setIsDailyStatsLoading] = useState(false);
  const [dailyChangeRecords, setDailyChangeRecords] = useState<any[]>([]);

  // ==================== 财务模块相关状态（新增） ====================
  const [financeSearchTerm, setFinanceSearchTerm] = useState('');
  const [financeSelectedMonth, setFinanceSelectedMonth] = useState('');
  const [financeIsFilterPanelOpen, setFinanceIsFilterPanelOpen] = useState(false);
  const [financeActiveFilters, setFinanceActiveFilters] = useState<FilterCondition[]>([]);
  
  // 财务模块refs
  const financePanelRef = useRef<any>(null);
  const safFinancePanelRef = useRef<any>(null);
  const cmaFinancePanelRef = useRef<any>(null);
  const concordFinancePanelRef = useRef<any>(null);

  // ==================== Quotation 模块相关状态 ====================
  const [quotationSearchTerm, setQuotationSearchTerm] = useState('');
  const [isQuotationCapturing, setIsQuotationCapturing] = useState(false);
  const [quotationVisibleColumns, setQuotationVisibleColumns] = useState({
    price20: true, price40: true, price40hq: true, price45: true, price40nor: true, remarks: true
  });

  // ==================== 添加 QuotationPanel ref ====================
  const quotationPanelRef = useRef<QuotationPanelRef>(null);

  // 复制并新建预订
  const handleCopyAndCreate = (booking: Booking) => {
    // 设置复制源ID
    setCopySourceId(booking.id);
    
    // 创建副本，清除ID以便新建
    const bookingCopy = {
      ...booking,
      id: undefined,
      bookingRef: `${booking.bookingRef || 'BK'}-COPY-${Date.now().toString().slice(-4)}`,
      createdAt: undefined,
      updatedAt: undefined
    };
    
    setEditingBooking(bookingCopy as Booking);
    setIsModalOpen(true);
  };

  // ==================== 搜索防抖 ====================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms 防抖延迟

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // ==================== 权限检查函数（在组件内部定义） ====================
  
  // 检查用户是否有权限
  const hasPermission = (perm: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    return currentUser.permissions.includes(perm);
  };

  // 检查用户是否有任何预订相关权限
  const hasAnyBookingPermission = (): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    
    const bookingPermissions = [
      Permission.BOOKING_READ,
      Permission.BOOKING_CREATE,
      Permission.BOOKING_UPDATE,
      Permission.BOOKING_DELETE,
      Permission.BOOKING_LOCK,
    ];
    
    return bookingPermissions.some(permission => currentUser.permissions.includes(permission));
  };

  // 检查用户是否有至少一个财务模块权限
  const hasAnyFinancePermission = (): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    
    const financePermissions = [
      Permission.FINANCE_READ,
      Permission.SAF_FINANCE_READ,
      Permission.CMA_FINANCE_READ,
      Permission.CONCORD_FINANCE_READ
    ];
    
    return financePermissions.some(permission => currentUser.permissions.includes(permission));
  };

  // ==================== 数据库权限检查函数（在组件内部定义） ====================
  // 检查用户对特定数据库的权限
  const hasDatabasePermission = (user: User | null, databaseId: string, permission: DatabasePermission): boolean => {
    if (!user) return false;
    
    // 管理员自动拥有所有权限
    if (isUserAdmin(user)) return true;
    
    // 检查用户的数据库权限配置
    const databaseAccess = user.databaseAccess || [];
    
    // 如果用户没有配置数据库权限，但有相应的系统权限，则允许访问
    if (databaseAccess.length === 0) {
      // 根据权限类型检查相应的系统权限
      switch (permission) {
        case 'READ':
          return hasPermission(Permission.BOOKING_READ);
        case 'CREATE':
          return hasPermission(Permission.BOOKING_CREATE);
        case 'UPDATE':
          return hasPermission(Permission.BOOKING_UPDATE);
        case 'DELETE':
          return hasPermission(Permission.BOOKING_DELETE);
        case 'LOCK':
          return hasPermission(Permission.BOOKING_LOCK);
        default:
          return false;
      }
    }
    
    const access = databaseAccess.find(da => da.databaseId === databaseId);
    
    if (!access || !access.isActive) return false;
    
    return access.permissions.includes(permission);
  };

  // 检查用户是否有权限查看特定数据库的预订
  const canViewDatabase = (user: User | null, databaseId: string): boolean => {
    return hasDatabasePermission(user, databaseId, 'READ');
  };

  // 检查用户是否有权限在特定数据库创建预订
  const canCreateInDatabase = (user: User | null, databaseId: string): boolean => {
    return hasDatabasePermission(user, databaseId, 'CREATE');
  };

  // 检查用户是否有权限在特定数据库修改预订
  const canUpdateInDatabase = (user: User | null, databaseId: string): boolean => {
    return hasDatabasePermission(user, databaseId, 'UPDATE');
  };

  // 检查用户是否有权限在特定数据库删除预订
  const canDeleteInDatabase = (user: User | null, databaseId: string): boolean => {
    return hasDatabasePermission(user, databaseId, 'DELETE');
  };

  // 检查用户是否有权限在特定数据库锁定/解锁预订
  const canLockInDatabase = (user: User | null, databaseId: string): boolean => {
    return hasDatabasePermission(user, databaseId, 'LOCK');
  };

  // 检查用户是否可以查看特定财务模块
  const canViewFinanceModule = (variant: FinanceVariant): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    
    switch (variant) {
      case 'MY_FINANCE':
        return hasPermission(Permission.FINANCE_READ);
      case 'SAF_FINANCE':
        return hasPermission(Permission.SAF_FINANCE_READ);
      case 'CMA_FINANCE':
        return hasPermission(Permission.CMA_FINANCE_READ);
      case 'CONCORD_FINANCE':
        return hasPermission(Permission.CONCORD_FINANCE_READ);
      default:
        return false;
    }
  };

  // 获取财务模块可用月份
  const getFinanceAvailableMonths = useMemo(() => {
    if (!hasAnyFinancePermission()) return [];
    
    const months = new Set<string>();
    const currentDatabases = isFinanceDataLoading ? databases : financeDatabases;
    
    currentDatabases.forEach(db => {
      db.bookings.forEach(b => {
        if (b.state !== 'CONFIRMED') return;
        if (b.etd) {
          const yearMonthMatch = b.etd.match(/^(\d{4})-(\d{2})/);
          if (yearMonthMatch) {
            months.add(`${yearMonthMatch[1]}-${yearMonthMatch[2]}`);
          }
        }
      });
    });
    
    return Array.from(months).sort().reverse();
  }, [databases, financeDatabases, isFinanceDataLoading, hasAnyFinancePermission]);

  // 加载初始化数据 - 已更新处理数据库权限和 Allocation 类型转换
  const loadAllData = async () => {
    try {
      console.log('🔍 开始加载初始化数据...');
      const data = await apiService.loadAllData();
      
      // 使用 mapUserFromApi 确保数据库权限字段正确映射
      const formattedUsers = (data.users || []).map(mapUserFromApi);
      
      // 确保每个用户都有 databaseAccess 字段
      formattedUsers.forEach(user => {
        if (!user.databaseAccess) {
          user.databaseAccess = [];
        }
      });
      
      // 映射数据库数据
      const formattedDatabases = (data.databases || []).map(adaptDatabaseFromApi);
      
      // 映射设置数据，特别处理 allocations 类型转换
      const formattedSettings: SystemSettings = {
        carriers: data.settings?.carriers || [],
        clients: data.settings?.clients || [],
        services: data.settings?.services || [],
        pols: data.settings?.pols || [],
        pods: data.settings?.pods || [],
        containerTypes: data.settings?.containerTypes || [],
        statuses: data.settings?.statuses || [],
        jobs: data.settings?.jobs || [],
        allocations: convertToAllocationArray(data.settings?.allocations || []), // 类型转换
        remarks: data.settings?.remarks || [],
        gateInRates: data.settings?.gateInRates || []
      };
      
      setUsers(formattedUsers);
      setDatabases(formattedDatabases);
      setSystemSettings(formattedSettings);
      
      // 同时初始化财务模块数据
      setFinanceDatabases(formattedDatabases);
      
      // 设置活动数据库 - 只设置用户有权限查看的数据库
      if (formattedDatabases.length > 0 && !activeDbId) {
        const accessibleDb = formattedDatabases.find(db => 
          canViewDatabase(currentUser, db.id)
        );
        if (accessibleDb) {
          setActiveDbId(accessibleDb.id);
          console.log(`✅ 设置初始数据库: ${accessibleDb.name} (${accessibleDb.id})`);
          
          // 如果用户有预订权限，自动加载数据
          if (hasAnyBookingPermission()) {
            console.log(`🔄 自动加载初始数据库数据...`);
            // 延迟加载，确保状态更新完成
            setTimeout(() => {
              loadBookings();
            }, 100);
          }
        } else if (formattedDatabases.length > 0) {
          // 如果用户没有任何数据库权限，默认显示第一个数据库（但会被权限检查阻止）
          setActiveDbId(formattedDatabases[0].id);
        }
      }
      
      // 单独加载报价数据
      try {
        const quotationsResult = await apiService.getQuotations();
        if (quotationsResult.success) {
          setQuotations(quotationsResult.quotations as Quotation[]);
        }
      } catch (error) {
        console.warn('加载报价数据失败:', error);
      }
      
      setIsLoading(false);
      setConnectionError(false);
      
      console.log(`✅ 初始化数据加载完成：${formattedUsers.length} 用户，${formattedDatabases.length} 数据库，${formattedSettings.allocations.length} 个分配项`);
      
    } catch (error) {
      console.error("❌ 后端连接错误", error);
      
      // 使用模拟数据让界面至少能显示
      console.log('⚠️ 使用模拟数据展示界面...');
      const demoDb = {
        id: 'demo-db',
        name: '演示数据库',
        fields: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookings: [],
        lastLoaded: Date.now()
      };
      
      setUsers([]);
      setDatabases([demoDb]);
      setFinanceDatabases([demoDb]); // 同时初始化财务模块数据
      setSystemSettings({
        carriers: [], clients: [], services: [], pols: [], pods: [],
        containerTypes: [], statuses: ['PENDING', 'CONFIRMED', 'CANCELLED'], 
        jobs: [],  allocations: [], remarks: [], gateInRates: []
      });
      
      // 完整的模拟 Quotation 数据
      const mockQuotation: Quotation = {
        id: 'demo-quote-1',
        region: 'Demo Region',
        carrier: 'Demo Carrier',
        pol: 'SHANGHAI',
        pod: 'LOS ANGELES',
        vessel: 'Demo Vessel',
        etd: new Date().toISOString().split('T')[0],
        price20: '1000',
        price40: '1800',
        price40hq: '2000',
        price40nor: '',
        price45: '2500',
        transitTime: '20',
        validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cutSi: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        remarks: 'Demo remark',
        freetime: '14 days',
        availableFfe: 'Available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setQuotations([mockQuotation]);
      setActiveDbId('demo-db');
      
      setConnectionError(true);
      setIsLoading(false);
    }
  };

  // 加载财务模块专用数据
  const loadFinanceData = async () => {
    if (!hasAnyFinancePermission()) return;
    
    setIsFinanceDataLoading(true);
    
    try {
      console.log('📊 加载财务模块专用数据...');
      
      // 重新加载所有数据，确保获取最新的财务数据
      const data = await apiService.loadAllData();
      const formattedDatabases = (data.databases || []).map(adaptDatabaseFromApi);
      
      // 为每个数据库单独加载预订数据，确保包含完整的财务字段
      const databasesWithFinance = await Promise.all(
        formattedDatabases.map(async (db) => {
          try {
            // 使用现有API加载数据，不传递额外的参数
            const result = await apiService.getBookingsByDatabase(db.id, {
              // 不传递 includeFinance 参数，因为 API 不支持
            });
            
            if (result.success) {
              const bookingsWithFinance = result.bookings.map(booking => {
                // 确保每个booking都有完整的finance字段
                if (!booking.finance) {
                  return {
                    ...booking,
                    finance: {
                      saf: {},
                      cma: {},
                      concord: {},
                      myFinance: {}
                    }
                  };
                }
                return booking;
              });
              
              return {
                ...db,
                bookings: bookingsWithFinance
              };
            }
            return db;
          } catch (error) {
            console.error(`加载数据库 ${db.name} 的财务数据失败:`, error);
            return db;
          }
        })
      );
      
      setFinanceDatabases(databasesWithFinance);
      console.log(`✅ 财务模块数据加载完成：${databasesWithFinance.length} 个数据库`);
      
    } catch (error) {
      console.error('❌ 加载财务数据失败:', error);
      // 如果失败，使用已有的databases数据
      setFinanceDatabases(databases);
    } finally {
      setIsFinanceDataLoading(false);
    }
  };

  // 监听activeTab变化，当切换到财务模块时加载财务数据
  useEffect(() => {
    const isFinanceTab = ['finance', 'saf_finance', 'cma_finance', 'concord_finance'].includes(activeTab);
    
    if (isFinanceTab && hasAnyFinancePermission()) {
      console.log(`🔄 切换到财务模块 ${activeTab}，加载财务数据...`);
      loadFinanceData();
    }
  }, [activeTab]);

  // 监听 activeDbId 和 activeTab 变化，自动加载数据
  useEffect(() => {
    // 当 activeDbId 改变且当前在 bookings 标签页时，自动加载数据
    if (activeDbId && activeTab === 'bookings' && hasAnyBookingPermission()) {
      // 检查用户是否有权限查看该数据库
      if (canViewDatabase(currentUser, activeDbId)) {
        console.log(`🔄 检测到数据库切换或页面加载，自动加载数据: ${activeDbId}`);
        // 延迟一点时间，确保其他状态更新完成
        setTimeout(() => {
          loadBookings();
        }, 50);
      }
    }
  }, [activeDbId, activeTab]);

  // 加载预订数据 - 添加缓存机制
  const loadBookings = async (forceRefresh: boolean = false) => {
    if (!activeDbId) return;
    
    // 检查用户是否有权限查看此数据库
    // 如果用户有 BOOKING_READ 系统权限，但还没有配置数据库权限，允许查看
    if (!hasPermission(Permission.BOOKING_READ)) {
      console.warn(`用户没有预订查看权限`);
      alert('您没有预订查看权限');
      return;
    }
    
    // 如果用户配置了数据库权限，检查具体权限
    if (currentUser?.databaseAccess && currentUser.databaseAccess.length > 0) {
      if (!canViewDatabase(currentUser, activeDbId)) {
        console.warn(`用户没有权限查看数据库 ${activeDbId}`);
        alert('您没有权限查看此数据库的预订数据');
        return;
      }
    }
    
    setIsLoadingBookings(true);
    
    try {
      // 检查缓存：如果有缓存且不是强制刷新，使用缓存数据
      const currentDb = databases.find(db => db.id === activeDbId);
      const cacheExpired = currentDb?.lastLoaded && (Date.now() - currentDb.lastLoaded > CACHE_DURATION); // 5分钟缓存
      
      if (currentDb && currentDb.bookings && currentDb.bookings.length > 0 && !forceRefresh && !cacheExpired) {
        console.log(`📋 使用缓存数据，数据库 ${activeDbId} 有 ${currentDb.bookings.length} 条记录`);
        
        // 更新分页信息
        updatePaginationInfo(currentDb.bookings.length);
        
        setIsLoadingBookings(false);
        return;
      }
      
      console.log(`📋 加载数据库 ${activeDbId} 的所有预订数据 (forceRefresh: ${forceRefresh}, cacheExpired: ${cacheExpired})`);
      
      // 构建过滤条件
      const stateFilter = activeFilters.find(f => f.fieldKey === 'state');
      const weekFilter = activeFilters.find(f => f.fieldKey === 'week');
      
      const result = await apiService.getBookingsByDatabase(activeDbId, {
        state: stateFilter?.value,
        week: weekFilter?.value
      });
      
      if (result.success) {
        const allBookings = result.bookings;
        
        // 更新数据库中的预订数据（保存所有数据）
        setDatabases(prev => prev.map(db => 
          db.id === activeDbId 
            ? { 
                ...db, 
                bookings: allBookings,
                // 保留预订总数统计
                bookingsCount: allBookings.length,
                lastLoaded: Date.now() // 更新最后加载时间
              }
            : db
        ));
        
        // 同时更新财务模块的数据
        setFinanceDatabases(prev => prev.map(db => 
          db.id === activeDbId 
            ? { 
                ...db, 
                bookings: allBookings,
                bookingsCount: allBookings.length,
                lastLoaded: Date.now()
              }
            : db
        ));
        
        // 更新分页信息 - 基于所有数据
        updatePaginationInfo(allBookings.length);
      }
    } catch (error) {
      console.error('加载预订数据失败:', error);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // 更新分页信息的辅助函数
  const updatePaginationInfo = (total: number) => {
    setPagination(prev => ({
      ...prev,
      page: 1, // 重置到第一页
      total: total,
      totalPages: Math.ceil(total / prev.limit),
      hasNext: total > prev.limit,
      hasPrev: false
    }));
  };

  // 处理数据库切换 - 优化缓存检查
  const handleDatabaseSwitch = async (dbId: string) => {
    // 如果用户有 BOOKING_READ 系统权限，允许查看所有数据库
    // 具体的操作权限会在操作时检查
    if (!hasPermission(Permission.BOOKING_READ)) {
      alert('您没有预订查看权限');
      return;
    }
    
    // 如果用户配置了数据库权限，检查是否有该数据库的权限
    if (currentUser?.databaseAccess && currentUser.databaseAccess.length > 0) {
      const hasDbAccess = canViewDatabase(currentUser, dbId);
      if (!hasDbAccess) {
        alert('您没有权限查看此数据库');
        return;
      }
    }
    
    setActiveDbId(dbId);
    
    // 检查缓存，决定是否重新加载
    const currentDb = databases.find(db => db.id === dbId);
    const cacheExpired = currentDb?.lastLoaded && (Date.now() - currentDb.lastLoaded > 5 * 60 * 1000); // 5分钟缓存
    
    if (currentDb && currentDb.bookings && currentDb.bookings.length > 0 && !cacheExpired) {
      console.log(`📋 切换数据库，使用缓存数据: ${dbId}`);
      // 更新分页信息
      updatePaginationInfo(currentDb.bookings.length);
    } else {
      // 缓存过期或无数据，重新加载
      console.log(`🔄 切换数据库，重新加载数据: ${dbId}`);
      await loadBookings();
    }
  };

  // 处理分页变化 - 前端分页
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
      hasNext: newPage < prev.totalPages,
      hasPrev: newPage > 1
    }));
  };

  // 处理刷新数据
  const handleRefreshData = () => {
    if (activeDbId && activeTab === 'bookings') {
      console.log('🔄 手动刷新数据');
      loadBookings(true); // 强制刷新
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 监听过滤条件变化，重新加载数据
  useEffect(() => {
    if (activeDbId && activeTab === 'bookings') {
      // 当过滤条件变化时，强制重新加载数据
      loadBookings(true);
    }
  }, [activeFilters, activeDbId]);

  // Derived State
  const activeDb = useMemo(() => {
    return databases.find(db => db.id === activeDbId) || databases[0];
  }, [databases, activeDbId]);

  const bookings = activeDb ? activeDb.bookings : [];
  const fields = activeDb ? activeDb.fields : [];

  // 修改：扩展 optionsMap，动态生成所有字段的选项
  const optionsMap: Record<string, string[]> = useMemo(() => {
    // 基础选项（从系统设置中获取）
    const baseOptions = {
      carrier: carriers,
      client: clients,
      service: services,
      pol: pols,
      pod: pods,
      type: containerTypes,
      state: statuses,
      job: jobs,
      contact: jobs,
      allocation: allocations.map(a => a.value), // 提取分配项的值
      remark: remarks,
    };

    // 动态选项：从当前数据库的bookings中提取
    const dynamicOptions: Record<string, string[]> = {};

    if (activeDb && activeDb.bookings) {
      // 为每个字段提取唯一值
      const fieldKeys = fields.map(f => f.key);
      
      fieldKeys.forEach(fieldKey => {
        // 跳过已经有的字段
        if (baseOptions[fieldKey as keyof typeof baseOptions]) return;
        
        const valuesSet = new Set<string>();
        
        activeDb.bookings.forEach(booking => {
          const value = booking[fieldKey as keyof Booking];
          if (value !== null && value !== undefined && value !== '') {
            valuesSet.add(String(value));
          }
        });
        
        const valuesArray = Array.from(valuesSet).sort();
        
        // 特殊处理某些字段
        if (fieldKey === 'week') {
          // 按周数排序
          dynamicOptions[fieldKey] = valuesArray.sort((a, b) => {
            const aNum = parseInt(a.replace(/\D/g, '')) || 0;
            const bNum = parseInt(b.replace(/\D/g, '')) || 0;
            return aNum - bNum;
          });
        } else if (fieldKey === 'qty') {
          // 数量排序
          dynamicOptions[fieldKey] = valuesArray.sort((a, b) => {
            const aNum = parseFloat(a) || 0;
            const bNum = parseFloat(b) || 0;
            return aNum - bNum;
          });
        } else {
          dynamicOptions[fieldKey] = valuesArray;
        }
      });
    }

    return {
      ...baseOptions,
      ...dynamicOptions,
    };
  }, [activeDb, fields, carriers, clients, services, pols, pods, containerTypes, statuses, jobs, allocations, remarks]);

  // --- Click Outside Effect for Data Menu ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setIsDataMenuOpen(false);
      }
    };
    if (isDataMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDataMenuOpen]);

  // --- Real-time Sync Effect ---
  useEffect(() => {
    const channel = new BroadcastChannel('oceanflow_channel');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'JOIN') {
        const { username, firstName } = payload;
        setOnlineUsers(prev => {
          if (!prev.some(u => u.username === username)) {
             setChatMessages(msgs => [...msgs, {
               id: Date.now().toString(),
               sender: 'System',
               text: `${firstName} joined`,
               timestamp: new Date(),
               isMe: false,
               isSystem: true
             }]);
             return [...prev, { username, firstName }];
          }
          return prev;
        });
        if (currentUser) {
          channel.postMessage({ type: 'I_AM_HERE', payload: { username: currentUser.username, firstName: currentUser.firstName } });
        }
      } 
      else if (type === 'I_AM_HERE') {
        const { username, firstName } = payload;
        setOnlineUsers(prev => prev.some(u => u.username === username) ? prev : [...prev, { username, firstName }]);
      }
      else if (type === 'LEAVE') {
        const { username, firstName } = payload;
        setOnlineUsers(prev => prev.filter(u => u.username !== username));
        setChatMessages(msgs => [...msgs, {
           id: Date.now().toString(),
           sender: 'System',
           text: `${firstName} left`,
           timestamp: new Date(),
           isMe: false,
           isSystem: true
        }]);
      }
      else if (type === 'CHAT') {
        setChatMessages(prev => [...prev, { ...payload.message, isMe: false }]);
      }
      else if (type === 'EDIT_START') {
        setActiveEdits(prev => {
          const filtered = prev.filter(e => e.userId !== payload.userId);
          return [...filtered, payload.editInfo];
        });
      }
      else if (type === 'EDIT_END') {
        setActiveEdits(prev => prev.filter(e => e.userId !== payload.userId));
      }
    };

    if (currentUser) {
      channel.postMessage({ type: 'JOIN', payload: { username: currentUser.username, firstName: currentUser.firstName } });
    }

    return () => {
      if (currentUser) {
         channel.postMessage({ type: 'LEAVE', payload: { username: currentUser.username, firstName: currentUser.firstName } });
      }
      channel.close();
    };
  }, [currentUser?.username]);

  // ==================== 综合数据处理函数 ====================
  // 处理三种筛选方式的组合：排序、搜索、过滤
  
  // 1. 处理排序的函数
  const handleSort = (fieldKey: string) => {
    if (!sortableFields[fieldKey]) return;
    
    if (sortField === fieldKey) {
      // 如果已经按这个字段排序，切换方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 否则设置新的排序字段，默认降序
      setSortField(fieldKey);
      setSortDirection('desc');
    }
  };

  // 清除排序
  const clearSort = () => {
    setSortField('');
    setSortDirection('desc'); // 默认排序方向设为降序
  };

  // 2. 处理搜索和过滤的数据筛选
  const filterAndSortBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];
    
    console.log(`🔍 开始数据处理：原始数据 ${bookings.length} 条`);
    console.log(`  搜索词：${debouncedSearchTerm ? `"${debouncedSearchTerm}"` : '无'}`);
    console.log(`  过滤条件：${activeFilters.length} 个`);
    console.log(`  排序：${sortField ? `${sortField} ${sortDirection}` : '默认状态和周次降序'}`);
    
    // 第一步：应用搜索条件（如果存在）
    let result = [...bookings];
    
  if (debouncedSearchTerm) {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    
    // 如果搜索词是中文，进行特殊处理
    const isChinese = /[\u4e00-\u9fa5]/.test(debouncedSearchTerm);
    
    result = result.filter(b => {
      // 搜索所有可见字段
      return fields.some(field => {
        const value = b[field.key as keyof Booking];
        if (value === null || value === undefined) return false;
        
        const valueStr = String(value).trim();
        if (valueStr === '') return false;
        
        const valueLower = valueStr.toLowerCase();
        
        // 直接包含匹配
        if (valueLower.includes(searchLower)) {
          return true;
        }
        
        // 如果是中文搜索，尝试模糊匹配（移除空格）
        if (isChinese) {
          const valueNoSpaces = valueLower.replace(/\s+/g, '');
          const searchNoSpaces = searchLower.replace(/\s+/g, '');
          if (valueNoSpaces.includes(searchNoSpaces)) {
            return true;
          }
        }
        
        return false;
      });
    });
    
    console.log(`  搜索"${debouncedSearchTerm}"后：${result.length} 条记录`);
  }
    
    // 第二步：应用过滤条件（如果存在）
    if (activeFilters.length > 0) {
      result = result.filter(booking => {
        return activeFilters.every(filter => {
          const value = booking[filter.fieldKey as keyof Booking];
          
          if (value === null || value === undefined || value === '') {
            return false;
          }
          
          const stringValue = String(value);
          const filterValue = filter.value;
          
          switch (filter.operator) {
            case 'equals':
              return stringValue === filterValue;
            case 'contains':
              return stringValue.toLowerCase().includes(filterValue.toLowerCase());
            case 'greater':
              if (filter.fieldKey === 'qty') {
                const numValue = parseFloat(stringValue) || 0;
                const numFilter = parseFloat(filterValue) || 0;
                return numValue > numFilter;
              } else if (filter.fieldKey === 'etd' || filter.fieldKey === 'gateIn') {
                return new Date(stringValue) > new Date(filterValue);
              }
              return false;
            case 'less':
              if (filter.fieldKey === 'qty') {
                const numValue = parseFloat(stringValue) || 0;
                const numFilter = parseFloat(filterValue) || 0;
                return numValue < numFilter;
              } else if (filter.fieldKey === 'etd' || filter.fieldKey === 'gateIn') {
                return new Date(stringValue) < new Date(filterValue);
              }
              return false;
            default:
              return true;
          }
        });
      });
      console.log(`  过滤后：${result.length} 条`);
    }
    
    // 第三步：应用排序
    if (sortField && sortableFields[sortField]) {
      result = [...result].sort((a, b) => {
        const aValue = a[sortField as keyof Booking];
        const bValue = b[sortField as keyof Booking];
        
        // 处理空值
        if (aValue === null || aValue === undefined || aValue === '') return sortDirection === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined || bValue === '') return sortDirection === 'asc' ? -1 : 1;
        
        let comparison = 0;
        
        // 数字字段
        if (sortField === 'qty') {
          const numA = typeof aValue === 'string' ? parseFloat(aValue) || 0 : Number(aValue) || 0;
          const numB = typeof bValue === 'string' ? parseFloat(bValue) || 0 : Number(bValue) || 0;
          comparison = numA - numB;
        }
        // 日期字段
        else if (sortField === 'etd' || sortField === 'gateIn') {
          const dateA = new Date(aValue as string);
          const dateB = new Date(bValue as string);
          comparison = dateA.getTime() - dateB.getTime();
        }
        // 状态字段特殊处理（按特定顺序）
        else if (sortField === 'state') {
          const statusOrder = ['CONFIRMED', 'PENDING', 'CANCELLED'];
          const aIndex = statusOrder.indexOf(aValue as string);
          const bIndex = statusOrder.indexOf(bValue as string);
          comparison = aIndex - bIndex;
        }
        // 字符串字段
        else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        // 根据排序方向返回结果
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      console.log(`  排序后：${result.length} 条`);
    } else {
      // 默认排序：先按status降序，再按week降序
      result = [...result].sort((a, b) => {
        // 先按status排序
        const statusOrder = ['CONFIRMED', 'PENDING', 'CANCELLED'];
        const aStatusIndex = statusOrder.indexOf(a.state);
        const bStatusIndex = statusOrder.indexOf(b.state);
        
        if (aStatusIndex !== bStatusIndex) {
          return bStatusIndex - aStatusIndex; // 降序
        }
        
        // 如果status相同，再按week排序
        const aWeek = a.week || '';
        const bWeek = b.week || '';
        
        // 提取周数
        const aWeekNum = parseInt(aWeek.replace(/\D/g, '')) || 0;
        const bWeekNum = parseInt(bWeek.replace(/\D/g, '')) || 0;
        
        return bWeekNum - aWeekNum; // 降序
      });
      console.log(`  默认排序后：${result.length} 条`);
    }
    
    console.log(`✅ 数据处理完成：最终 ${result.length} 条`);
    
    // 更新分页信息（但不改变当前页码，除非是第一页）
    const filteredTotal = result.length;
    const currentTotalPages = Math.ceil(filteredTotal / pagination.limit);
    
    // 如果当前页超出了总页数，则回到第一页
    let newPage = pagination.page;
    if (pagination.page > currentTotalPages && currentTotalPages > 0) {
      newPage = 1;
    }
    
    setPagination(prev => ({
      ...prev,
      page: newPage,
      total: filteredTotal,
      totalPages: currentTotalPages,
      hasNext: newPage < currentTotalPages,
      hasPrev: newPage > 1
    }));
    
    return result;
  }, [bookings, debouncedSearchTerm, activeFilters, sortField, sortDirection, fields]);

  // 3. 获取当前页的数据（分页）
  const currentPageBookings = useMemo(() => {
    if (!filterAndSortBookings || filterAndSortBookings.length === 0) return [];
    
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filterAndSortBookings.slice(startIndex, endIndex);
  }, [filterAndSortBookings, pagination.page, pagination.limit]);

  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser.firstName,
      text,
      timestamp: new Date(),
      isMe: true
    };
    setChatMessages(prev => [...prev, newMessage]);
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'CHAT',
        payload: { message: newMessage }
      });
    }
  };

  const updateActiveDb = async (updates: Partial<ExtendedDatabase>) => {
    if (!activeDb) return;
    
    setDatabases(prev => prev.map(db => db.id === activeDb.id ? { ...db, ...updates } : db));
  };
  
  const updateBookingInDb = async (dbId: string, updatedBooking: Booking) => {
      setDatabases(prev => prev.map(db => {
          if (db.id === dbId) {
              return {
                  ...db,
                  bookings: db.bookings.map(b => b.id === updatedBooking.id ? updatedBooking : b)
              };
          }
          return db;
      }));
      
      // 同时更新财务模块的数据
      setFinanceDatabases(prev => prev.map(db => {
          if (db.id === dbId) {
              return {
                  ...db,
                  bookings: db.bookings.map(b => b.id === updatedBooking.id ? updatedBooking : b)
              };
          }
          return db;
      }));
      
      await apiService.saveBooking(dbId, updatedBooking);
  };

  // 修改 updateSetting 函数，处理 allocations 类型
  const updateSetting = async (key: keyof SystemSettings, value: any) => {
    // 创建新的设置对象
    const newSettings = { 
      ...systemSettings, 
      [key]: value 
    };
    
    console.log(`Updating setting: ${key}`, 'value:', value);
    console.log('New settings object:', newSettings);
    
    try {
      // 发送完整设置对象到后端
      await apiService.saveSettings(newSettings);
      console.log('Settings saved successfully');
      
      // 只有在API调用成功后更新本地状态
      setSystemSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      
      // 提供更友好的错误信息
      let errorMessage = 'Failed to save settings. ';
      if (error.message.includes('Server encountered an error')) {
        errorMessage = 'Server encountered an internal error. Please check the server logs.';
      } else if (error.message.includes('HTML error page')) {
        errorMessage = 'Server returned an error page. Please try again later or contact administrator.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      alert(errorMessage);
      throw error; // 重新抛出错误以便调用者处理
    }
  };

  const handleEditClick = (booking: Booking) => {
    // 检查用户是否有权限修改此数据库的预订
    if (!canUpdateInDatabase(currentUser, activeDbId)) {
      alert('您没有权限修改此数据库的预订');
      return;
    }
    
    setEditingBooking(booking);
    setIsModalOpen(true);
    if (currentUser && channelRef.current) {
      const editInfo: ActiveEdit = {
        bookingId: booking.id,
        userId: currentUser.id,
        userName: currentUser.firstName,
        colorClass: '' 
      };
      setActiveEdits(prev => [...prev.filter(e => e.userId !== currentUser.id), editInfo]);
      channelRef.current.postMessage({
        type: 'EDIT_START',
        payload: { userId: currentUser.id, editInfo }
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBooking(undefined);
    setCopySourceId(null); // 清除复制源ID
    if (currentUser && channelRef.current) {
      setActiveEdits(prev => prev.filter(e => e.userId !== currentUser.id));
      channelRef.current.postMessage({
        type: 'EDIT_END',
        payload: { userId: currentUser.id }
      });
    }
  };

  const handleSaveBooking = async (bookingData: Partial<Booking>) => {
    if (!activeDb) return;
    
    // 检查权限：如果是编辑则检查UPDATE，如果是新建则检查CREATE
    const requiredPermission = editingBooking ? 'UPDATE' : 'CREATE';
    if (!hasDatabasePermission(currentUser, activeDbId, requiredPermission)) {
      alert(`您没有权限${editingBooking ? '修改' : '创建'}此数据库的预订`);
      return;
    }
    
    console.log('🔧 处理保存预订:', {
      isEdit: !!editingBooking,
      originalId: editingBooking?.id,
      receivedData: bookingData,
      copySourceId: copySourceId,
      activeDbId: activeDb.id
    });
    
    // 判断这是否是一个复制新建的操作（通过copySourceId判断）
    const isCopyCreate = !!copySourceId;
    
    try {
      // 构建最终预订对象
      let finalBooking: Booking;
      
      if (editingBooking && editingBooking.id) {
        console.log('🔄 处理更新操作');
        // 修改现有预订 - 保留原有ID
        finalBooking = { 
          ...editingBooking,
          ...bookingData,
          id: editingBooking.id, // 确保保留原有ID
          updatedAt: new Date().toISOString()
        } as Booking;
        
        console.log('🔄 更新预订数据:', {
          id: finalBooking.id,
          bookingRef: finalBooking.bookingRef,
          client: finalBooking.client,
          carrier: finalBooking.carrier
        });
      } else {
        console.log('🆕 处理创建操作');
        // 创建新预订 - 不生成ID，让后端生成
        const bookingRef = bookingData.bookingRef || `BK${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        finalBooking = { 
          ...bookingData,
          // 注意：创建时不传ID，让后端生成
          id: undefined,
          bookingRef: bookingRef,
          finance: bookingData.finance || {},
          state: bookingData.state || 'PENDING',
          isLocked: bookingData.isLocked || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Booking;
        
        console.log('🆕 创建预订数据:', {
          bookingRef: finalBooking.bookingRef,
          client: finalBooking.client,
          carrier: finalBooking.carrier,
          hasId: !!finalBooking.id
        });
      }
      
      // 确保所有字段都有值，不是undefined
      const allFields = [...SYSTEM_FIELDS, ...Object.keys(BUSINESS_FIELD_MAPPING)];
      allFields.forEach(field => {
        if (finalBooking[field as keyof Booking] === undefined) {
          console.log(`⚠️ 字段 ${field} 为 undefined，设置为空字符串`);
          (finalBooking as any)[field] = '';
        }
      });
      
      // 确保数值字段是数字
      if (finalBooking.qty !== undefined && finalBooking.qty !== null) {
        finalBooking.qty = Number(finalBooking.qty);
      } else {
        finalBooking.qty = 0;
      }
      
      console.log('✅ 最终要保存的数据:', {
        id: finalBooking.id,
        bookingRef: finalBooking.bookingRef,
        state: finalBooking.state,
        isLocked: finalBooking.isLocked,
        client: finalBooking.client,
        carrier: finalBooking.carrier
      });
      
      // 直接调用 apiService.saveBooking
      console.log('📤 调用 API 保存预订...');
      const result = await apiService.saveBooking(activeDb.id, finalBooking);
      
      if (result.success) {
        console.log('✅ API 保存成功，更新本地状态...');
        
        // 获取保存后的预订对象
        const savedBooking = result.booking;
        
        if (isCopyCreate && copySourceId) {
          console.log('📋 处理复制新建的插入逻辑');
          
          // 找到原记录在当前页的位置
          const currentBookings = bookings;
          const sourceIndex = currentBookings.findIndex(b => b.id === copySourceId);
          
          if (sourceIndex !== -1) {
            console.log(`📌 找到原记录位置: ${sourceIndex}`);
            
            // 创建新的预订列表，将新记录插入到原记录下方
            const newBookings = [...currentBookings];
            
            // 注意：这里使用前端插入，如果后端已经有排序逻辑可能会冲突
            // 我们暂时先在前端插入，然后重新加载数据以确保一致性
            newBookings.splice(sourceIndex + 1, 0, savedBooking);
            
            // 更新数据库状态
            setDatabases(prev => prev.map(db => 
              db.id === activeDbId 
                ? { 
                    ...db, 
                    bookings: newBookings,
                    bookingsCount: db.bookingsCount + 1
                  }
                : db
            ));
            
            // 同时更新财务模块数据
            setFinanceDatabases(prev => prev.map(db => 
              db.id === activeDbId 
                ? { 
                    ...db, 
                    bookings: newBookings,
                    bookingsCount: db.bookingsCount + 1
                  }
                : db
            ));
            
            // 显示成功消息
            showCopyNotification('✅ 新预订已创建并插入到原记录下方');
          } else {
            // 如果找不到原记录，直接添加到最后
            setDatabases(prev => prev.map(db => 
              db.id === activeDbId 
                ? { 
                    ...db, 
                    bookings: [...db.bookings, savedBooking],
                    bookingsCount: db.bookingsCount + 1
                  }
                : db
            ));
            
            // 同时更新财务模块数据
            setFinanceDatabases(prev => prev.map(db => 
              db.id === activeDbId 
                ? { 
                    ...db, 
                    bookings: [...db.bookings, savedBooking],
                    bookingsCount: db.bookingsCount + 1
                  }
                : db
            ));
          }
        } else {
          // 普通创建或更新，重新加载数据
          console.log('🔄 重新加载数据...');
          await loadBookings();
        }
        
        // 清除复制源ID
        setCopySourceId(null);
        handleCloseModal();
      } else {
        throw new Error('保存失败，但API没有返回错误信息');
      }
      
      console.log('✅ 表单提交成功');
      
    } catch (error) {
      console.error('❌ 保存预订失败:', error);
      
      // 显示更详细的错误信息
      let errorMsg = '保存失败，请重试';
      if (error.message.includes('预订ID冲突')) {
        errorMsg = '保存失败：预订ID冲突。请刷新页面后重试。';
      } else if (error.message.includes('预订不存在')) {
        errorMsg = '保存失败：预订记录不存在或已被删除。';
      }
      
      alert(`${errorMsg}\n\n详细信息: ${error.message}`);
      throw error; // 重新抛出错误，让调用者处理
    }
  };

  const handleDeleteBooking = async (id: string) => {
    // 检查用户是否有权限删除此数据库的预订
    if (!canDeleteInDatabase(currentUser, activeDbId)) {
      alert('您没有权限删除此数据库的预订');
      return;
    }
    
    if (window.confirm('Delete this booking?')) {
      try {
        await apiService.deleteBooking(id);
        // 重新加载数据
        await loadBookings();
      } catch (error) {
        console.error('Failed to delete booking:', error);
        alert('Failed to delete booking. Please try again.');
      }
    }
  };

  const handleUpdateFields = (newFields: FieldDefinition[]) => {
    const normalizedFields = validateAndNormalizeFields(newFields);
    updateActiveDb({ fields: normalizedFields });
  };

  const handleToggleLock = async (booking: Booking) => {
    // 检查用户是否有权限锁定/解锁此数据库的预订
    if (!canLockInDatabase(currentUser, activeDbId)) {
      alert('您没有权限锁定/解锁此数据库的预订');
      return;
    }
    
    const updatedBooking = { ...booking, isLocked: !booking.isLocked };
    
    try {
      await apiService.saveBooking(activeDb.id, updatedBooking);
      
      // 更新本地状态
      setDatabases(prev => prev.map(db => 
        db.id === activeDb.id 
          ? { 
              ...db, 
              bookings: db.bookings.map(b => b.id === booking.id ? updatedBooking : b)
            }
          : db
      ));
      
      // 同时更新财务模块数据
      setFinanceDatabases(prev => prev.map(db => 
        db.id === activeDb.id 
          ? { 
              ...db, 
              bookings: db.bookings.map(b => b.id === booking.id ? updatedBooking : b)
            }
          : db
      ));
    } catch (error) {
      console.error('Failed to toggle lock:', error);
      alert('Failed to toggle lock. Please try again.');
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateTemplate(fields);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'oceanflow_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsDataMenuOpen(false);
  };
  
  const handleExportData = () => {
    if (!activeDb) return;
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(bookings, fields, `Export_${activeDb.name.replace(/\s+/g, '_')}_${dateStr}`);
    setIsDataMenuOpen(false);
  };

  const triggerImport = (mode: 'append' | 'overwrite') => {
    // 检查用户是否有权限在此数据库创建预订
    if (!canCreateInDatabase(currentUser, activeDbId)) {
      alert('您没有权限在此数据库导入数据');
      return;
    }
    
    setImportMode(mode);
    setIsDataMenuOpen(false);
    fileInputRef.current?.click();
  };

  // 修改 handleFileImport 函数，处理 allocations 类型
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 检查用户是否有权限在此数据库创建预订
    if (!canCreateInDatabase(currentUser, activeDbId)) {
      alert("You do not have permission to import data into this database.");
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const rawRows = parseCSV(text);
          const importedBookings = processImportedData(rawRows, fields);
          
        if (importedBookings.length === 0) {
            alert("No valid data found in CSV. Please ensure column headers match system fields.");
            return;
          }

          // 提取 JOB、ALLOCATION 和 REMARK 值到系统设置
          const newSystemSettings = { ...systemSettings };
          
          for (const booking of importedBookings) {
            if (booking.job && booking.job.trim()) {
              // 处理 jobs
              const jobValue = booking.job.trim();
              if (!newSystemSettings.jobs.includes(jobValue)) {
                newSystemSettings.jobs.push(jobValue);
              }
            }
            
            if (booking.allocation && booking.allocation.trim()) {
              // 处理 allocations - 需要转换为 Allocation 对象
              const allocationValue = booking.allocation.trim();
              // 检查是否已存在相同值的 Allocation
              const existingAllocation = newSystemSettings.allocations.find(a => a.value === allocationValue);
              if (!existingAllocation) {
                newSystemSettings.allocations.push({
                  id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: allocationValue,
                  value: allocationValue,
                  note: ''
                });
              }
            }
            
            if (booking.remark && booking.remark.trim()) {
              // 处理 remarks
              const remarkValue = booking.remark.trim();
              if (!newSystemSettings.remarks.includes(remarkValue)) {
                newSystemSettings.remarks.push(remarkValue);
              }
            }
          }

          // 更新系统设置
          await updateSetting('jobs', newSystemSettings.jobs);
          await updateSetting('allocations', newSystemSettings.allocations);
          await updateSetting('remarks', newSystemSettings.remarks);
          setSystemSettings(newSystemSettings);

          // 保存每个导入的预订
          const savePromises = importedBookings.map(booking => 
            apiService.saveBooking(activeDb.id, booking)
          );

          try {
            await Promise.all(savePromises);
            
            if (importMode === 'overwrite') {
              if (window.confirm(`DANGER: This will DELETE all ${pagination.total} existing records and replace them with ${importedBookings.length} records from Excel. Continue?`)) {
                // 先删除所有现有预订
                for (const booking of bookings) {
                  try {
                    await apiService.deleteBooking(booking.id);
                  } catch (error) {
                    console.warn(`Failed to delete booking ${booking.id}:`, error);
                  }
                }
                
                // 重新加载数据
                await loadBookings();
                
                alert(`Successfully imported ${importedBookings.length} bookings.`);
              }
            } else {
              if (window.confirm(`Found ${importedBookings.length} bookings. Append them to the current list?`)) {
                // 重新加载数据以显示新增的预订
                await loadBookings();
                
                alert(`Successfully appended ${importedBookings.length} bookings. Total now: ${pagination.total + importedBookings.length}`);
              }
            }
          } catch (saveError) {
            console.error("Failed to save some bookings:", saveError);
            alert("Some bookings failed to save. Please check the console for details.");
          }
        } catch (err) {
          console.error("Import error:", err);
          alert("Failed to parse file. Please ensure it is a valid CSV.");
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

    // ==================== 祥泰历史放舱导出功能 ====================
  const handleExportXiangTaiHistory = async () => {
    try {
      // 获取祥泰客户的放舱历史
      console.log('📊 开始导出祥泰历史放舱数据...');
      
      // 收集所有数据库中祥泰的放舱记录
      const xiangTaiRecords: any[] = [];
      
      // 检查每个数据库
      for (const db of databases) {
        // 获取该数据库的放舱变更记录
        // 注意：这里需要调用API获取祥泰的放舱历史
        // 由于当前没有专门的API，我们可以从已有数据中筛选
        
        // 从当前数据库的预订中筛选祥泰的放舱记录
        const dbRecords = db.bookings
          .filter(booking => 
            booking.client === '祥泰' && 
            booking.state === 'CONFIRMED'
          )
          .map(booking => ({
            databaseName: db.name,
            week: booking.week,
            carrier: booking.carrier,
            service: booking.service,
            bookingRef: booking.bookingRef,
            pol: booking.pol,
            pod: booking.pod,
            etd: booking.etd,
            vessel: booking.vessel,
            qty: booking.qty,
            type: booking.type,
            client: booking.client,
            allocation: booking.allocation,
            currentStatus: booking.state,
            // 假设放舱时间为更新时间
            changeTimestamp: booking.updatedAt || booking.createdAt,
            previousStatus: 'PENDING', // 假设之前是PENDING状态
            newStatus: 'CONFIRMED',
            changeType: 'status_change'
          }));
        
        xiangTaiRecords.push(...dbRecords);
      }
      
      if (xiangTaiRecords.length === 0) {
        alert('没有找到祥泰的放舱记录');
        return;
      }
      
      // 按日期排序
      const sortedRecords = xiangTaiRecords.sort((a, b) => {
        const dateA = a.changeTimestamp ? new Date(a.changeTimestamp).getTime() : 0;
        const dateB = b.changeTimestamp ? new Date(b.changeTimestamp).getTime() : 0;
        return dateA - dateB;
      });
      
      console.log(`找到 ${sortedRecords.length} 条祥泰放舱记录`);
      
      // 创建CSV内容
      const headers = [
        '放舱日期', '数据库', 'Week', 'Carrier', 'Service', 'Booking Ref', 
        'POL', 'POD', 'ETD', 'Vessel', 'QTY', 'Type', 'Client', 'Allocation'
      ];
      
      const rows = sortedRecords.map(record => {
        // 格式化放舱日期
        let releaseDate = '';
        if (record.changeTimestamp) {
          try {
            const date = new Date(record.changeTimestamp);
            releaseDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          } catch (e) {
            releaseDate = '未知日期';
          }
        }
        
        return [
          releaseDate,
          record.databaseName,
          record.week,
          record.carrier,
          record.service,
          record.bookingRef,
          record.pol,
          record.pod,
          record.etd,
          record.vessel,
          record.qty,
          record.type,
          record.client,
          record.allocation || ''
        ];
      });
      
      // 将数据转换为CSV格式
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          if (cell === null || cell === undefined) return '';
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');
      
      // 添加UTF-8 BOM头解决中文乱码问题
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;
      
      // 创建下载链接
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `祥泰历史放舱数据_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`成功导出 ${sortedRecords.length} 条祥泰历史放舱记录`);
      
    } catch (error) {
      console.error('导出祥泰历史放舱数据时出错:', error);
      alert('导出失败，请重试');
    }
  };

  // ==================== 完整祥泰历史导出功能（通过API） ====================
  // 修改 handleExportFullXiangTaiHistory 函数
  const handleExportFullXiangTaiHistory = async () => {
    try {
      console.log('📊 开始导出完整祥泰历史放舱数据...');
      
      // 显示加载提示
      const exportBtn = document.querySelector('.export-xiangtai-btn') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<Loader2 className="w-3 h-3 animate-spin mr-1" /> 导出中...';
      }
      
      // 直接使用当前数据，不调用API
      const xiangTaiRecords: any[] = [];
      
      console.log('🔍 在本地数据库中搜索祥泰记录...');
      
      // 遍历所有数据库
      for (const db of databases) {
        console.log(`  检查数据库: ${db.name} (${db.bookings.length} 条记录)`);
        
        const dbRecords = db.bookings
          .filter(booking => {
            if (!booking.client) return false;
            
            // 多种匹配方式
            const client = String(booking.client).toLowerCase().trim();
            
            // 匹配 "祥泰"
            if (client.includes('祥泰')) return true;
            
            // 匹配 "祥泰"（无空格）
            if (client.replace(/\s+/g, '') === '祥泰') return true;
            
            // 匹配拼音或近似
            if (client.includes('xiangtai')) return true;
            
            return false;
          })
          .map(booking => {
            // 确定放舱日期
            let releaseDate = '';
            if (booking.state === 'CONFIRMED') {
              // 使用更新时间作为放舱日期
              if (booking.updatedAt) {
                try {
                  const date = new Date(booking.updatedAt);
                  releaseDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                } catch (e) {
                  releaseDate = booking.etd || '未知日期';
                }
              } else {
                releaseDate = booking.etd || '未知日期';
              }
            }
            
            return {
              releaseDate,
              databaseName: db.name,
              week: booking.week,
              carrier: booking.carrier,
              service: booking.service,
              bookingRef: booking.bookingRef,
              pol: booking.pol,
              pod: booking.pod,
              etd: booking.etd,
              vessel: booking.vessel,
              qty: booking.qty,
              type: booking.type,
              client: booking.client,
              allocation: booking.allocation,
              status: booking.state,
              createdAt: booking.createdAt,
              updatedAt: booking.updatedAt
            };
          });
        
        console.log(`    找到 ${dbRecords.length} 条祥泰记录`);
        xiangTaiRecords.push(...dbRecords);
      }
      
      if (xiangTaiRecords.length === 0) {
        alert('没有找到祥泰的放舱记录');
        
        // 显示调试信息
        console.log('调试信息:');
        databases.forEach(db => {
          const clients = [...new Set(db.bookings.map(b => b.client).filter(Boolean))];
          console.log(`数据库 "${db.name}" 中的客户列表:`, clients);
        });
        
        if (exportBtn) {
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<FileSpreadsheet className="w-3 h-3 mr-1" /> 导出祥泰历史';
        }
        return;
      }
      
      console.log(`✅ 共找到 ${xiangTaiRecords.length} 条祥泰记录`);
      
      // 按放舱日期排序
      const sortedRecords = xiangTaiRecords.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateA - dateB;
      });
      
      // 创建CSV内容
      const headers = [
        '放舱日期', '数据库', 'Week', 'Carrier', 'Service', 'Booking Ref', 
        'POL', 'POD', 'ETD', 'Vessel', 'QTY', 'Type', 'Client', 'Allocation', '状态'
      ];
      
      const rows = sortedRecords.map(record => [
        record.releaseDate,
        record.databaseName,
        record.week,
        record.carrier,
        record.service,
        record.bookingRef,
        record.pol,
        record.pod,
        record.etd,
        record.vessel,
        record.qty,
        record.type,
        record.client,
        record.allocation || '',
        record.status
      ]);
      
      // 将数据转换为CSV格式
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          if (cell === null || cell === undefined) return '';
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');
      
      // 添加UTF-8 BOM头解决中文乱码问题
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;
      
      // 创建下载链接
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `祥泰历史放舱数据_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`✅ 成功导出 ${sortedRecords.length} 条祥泰历史放舱记录`);
      
    } catch (error) {
      console.error('❌ 导出祥泰历史放舱数据时出错:', error);
      alert('导出失败，请重试');
    } finally {
      // 恢复按钮状态
      const exportBtn = document.querySelector('.export-xiangtai-btn') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<FileSpreadsheet className="w-3 h-3 mr-1" /> 导出祥泰历史';
      }
    }
  };

  const handleAddDatabase = async (name: string) => {
    try {
      const result = await apiService.createDatabase(name);
      
      if (result.success && result.database) {
        const newDb = adaptDatabaseFromApi(result.database);
        setDatabases([...databases, newDb]);
        setFinanceDatabases([...financeDatabases, newDb]); // 同时更新财务模块数据
        
        // 为新数据库自动为所有用户添加默认权限（仅查看权限）
        const updatedUsers = users.map(user => {
          // 管理员自动拥有所有权限
          if (isUserAdmin(user)) {
            return user;
          }
          
          // 为普通用户添加新数据库的默认权限（仅查看）
          const newDatabaseAccess: DatabaseAccess = {
            databaseId: newDb.id,
            databaseName: newDb.name,
            permissions: ['READ'],
            isActive: true
          };
          
          const existingAccess = user.databaseAccess || [];
          return {
            ...user,
            databaseAccess: [...existingAccess, newDatabaseAccess]
          };
        });
        
        setUsers(updatedUsers);
        
        // 自动切换到新数据库（如果用户有权限）
        if (canViewDatabase(currentUser, newDb.id)) {
          setActiveDbId(newDb.id);
          // 自动加载新数据库的数据
          setTimeout(() => {
            loadBookings();
          }, 100);
        } else if (databases.length > 0) {
          // 如果用户没有任何数据库权限，默认显示第一个数据库（但会被权限检查阻止）
          setActiveDbId(databases[0].id);
        }
        
        alert(`数据库 "${newDb.name}" 创建成功！`);
      } else {
        alert(`创建失败`);
      }
    } catch (error: any) {
      alert(`创建失败: ${error.message}`);
    }
  };

  const handleRenameDatabase = async (id: string, newName: string) => {
    try {
      console.log('正在重命名数据库:', id, '->', newName);
      
      const result = await apiService.renameDatabase(id, newName);
      
      if (result.success && result.database) {
        setDatabases(prev => prev.map(db => 
          db.id === id 
            ? { 
                ...db, 
                name: newName,
                updatedAt: result.database?.updatedAt || db.updatedAt
              } 
            : db
        ));
        
        // 同时更新财务模块的数据
        setFinanceDatabases(prev => prev.map(db => 
          db.id === id 
            ? { 
                ...db, 
                name: newName,
                updatedAt: result.database?.updatedAt || db.updatedAt
              } 
            : db
        ));
        
        // 更新所有用户中该数据库的权限配置名称
        setUsers(prev => prev.map(user => {
          const databaseAccess = user.databaseAccess || [];
          const updatedAccess = databaseAccess.map(access => 
            access.databaseId === id 
              ? { ...access, databaseName: newName }
              : access
          );
          
          return {
            ...user,
            databaseAccess: updatedAccess
          };
        }));
        
        console.log('✅ 数据库重命名成功');
      } else {
        console.error('重命名失败');
        alert(`重命名失败`);
      }
    } catch (error: any) {
      console.error('重命名数据库出错:', error);
      alert(`重命名失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    if (databases.length <= 1) {
      alert("您不能删除唯一的数据库。");
      return;
    }
    
    if (window.confirm('删除此数据库及其所有预订吗？')) {
      try {
        console.log('正在删除数据库:', id);
        
        const result = await apiService.deleteDatabase(id);
        
        if (result.success) {
          const remaining = databases.filter(d => d.id !== id);
          setDatabases(remaining);
          
          // 同时更新财务模块的数据
          setFinanceDatabases(prev => prev.filter(d => d.id !== id));
          
          // 从所有用户中移除该数据库的权限配置
          setUsers(prev => prev.map(user => {
            const databaseAccess = user.databaseAccess || [];
            const filteredAccess = databaseAccess.filter(access => access.databaseId !== id);
            
            return {
              ...user,
              databaseAccess: filteredAccess
            };
          }));
          
          if (activeDbId === id) {
            // 切换到用户有权限查看的第一个数据库
            const accessibleDb = remaining.find(db => 
              canViewDatabase(currentUser, db.id)
            );
            if (accessibleDb) {
              setActiveDbId(accessibleDb.id);
              // 自动加载新数据库的数据
              setTimeout(() => {
                loadBookings();
              }, 100);
            } else if (remaining.length > 0) {
              setActiveDbId(remaining[0].id);
            }
          }
          
          console.log('✅ 数据库删除成功:', result.message);
        } else {
          console.error('删除失败:', result.message);
          alert(`删除失败: ${result.message}`);
        }
      } catch (error) {
        console.error('删除数据库出错:', error);
        alert(`删除失败: ${error.message}`);
      }
    }
  };
  
  // 修改 handleImportSettings 函数，处理 allocations 类型转换
  const handleImportSettings = async (newSettings: SystemSettings) => {
    // 确保 allocations 是 Allocation[] 类型
    const processedSettings: SystemSettings = {
      ...newSettings,
      allocations: convertToAllocationArray(newSettings.allocations)
    };
    
    setSystemSettings(processedSettings);
    await apiService.saveSettings(processedSettings);
  };

  // Quotation Handlers
  const handleAddQuotation = async (q: Quotation) => {
    try {
      const result = await apiService.saveQuotation(q);
      setQuotations([...quotations, result.quotation]);
    } catch (error) {
      console.error('Failed to add quotation:', error);
      alert('Failed to add quotation. Please try again.');
    }
  };
  
  const handleUpdateQuotation = async (q: Quotation) => {
    try {
      const result = await apiService.saveQuotation(q);
      setQuotations(prev => prev.map(item => item.id === q.id ? result.quotation : item));
    } catch (error) {
      console.error('Failed to update quotation:', error);
      alert('Failed to update quotation. Please try again.');
    }
  };
  
  const handleDeleteQuotation = async (idOrIds: string | string[]) => {
    if(window.confirm("Delete selected quotation(s)?")) {
      try {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        await apiService.deleteQuotations(ids);
        setQuotations(prev => prev.filter(item => !ids.includes(item.id)));
      } catch (error) {
        console.error('Failed to delete quotation:', error);
        alert('Failed to delete quotation. Please try again.');
      }
    }
  };

  // --- Database Reorder Handlers ---
  const handleDbDragStart = (e: React.DragEvent, index: number) => {
    setDraggedDbIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDbDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDbDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedDbIndex === null) return;
    if (draggedDbIndex === dropIndex) {
        setDraggedDbIndex(null);
        return;
    }
    const newDatabases = [...databases];
    const [movedDb] = newDatabases.splice(draggedDbIndex, 1);
    newDatabases.splice(dropIndex, 0, movedDb);
    
    setDatabases(newDatabases);
    setDraggedDbIndex(null);
  };

  // ==================== Quotation 相关事件处理函数（通过ref调用） ====================
  const handleQuotationScreenshot = async () => {
    setIsQuotationCapturing(true);
    if (quotationPanelRef.current) {
      await quotationPanelRef.current.handleScreenshot();
    }
    setIsQuotationCapturing(false);
  };

  const handleQuotationExport = () => {
    if (quotationPanelRef.current) {
      quotationPanelRef.current.handleExport();
    }
  };

  const handleQuotationImportClick = () => {
    if (quotationPanelRef.current) {
      quotationPanelRef.current.handleImport();
    }
  };

  const handleCreateRegion = () => {
    if (!hasPermission(Permission.QUOTATION_CREATE)) return;
    if (quotationPanelRef.current) {
      quotationPanelRef.current.handleCreateRegion();
    }
  };

  const handleQuickAdd = () => {
    if (!hasPermission(Permission.QUOTATION_CREATE)) return;
    if (quotationPanelRef.current) {
      quotationPanelRef.current.handleQuickAdd();
    }
  };

  // ==================== 复制预订数据到剪贴板 ====================
  const handleCopyBookingData = (booking: Booking, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 提取需要的字段
    const carrier = booking.carrier || '';
    const bookingRef = booking.bookingRef || '';
    const pol = booking.pol || '';
    const pod = booking.pod || '';
    // 修改：直接使用原始字符串，不进行格式化
    const etd = booking.etd || ''; // 直接使用原始字符串
    const vessel = booking.vessel || '';
    const qty = booking.qty || '';
    const type = booking.type || '';
    const client = booking.client || '';
    
    // 组合格式：CARRIER  BOOKING REF  POL  POD  ETD  VESSEL  QTY X TYPE  CLIENT
    const textToCopy = `${carrier}  ${bookingRef}  ${pol}  ${pod}  ${etd}  ${vessel}  ${qty} X ${type}  ${client}`.trim();
    
    console.log('复制的内容:', textToCopy); // 调试用
    
    // 使用现代剪贴板API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          showCopySuccessNotification();
        })
        .catch(err => {
          console.error('复制失败:', err);
          // 回退到旧的复制方法
          fallbackCopyTextToClipboard(textToCopy);
        });
    } else {
      // 使用传统方法
      fallbackCopyTextToClipboard(textToCopy);
    }
  };



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authUsername || !authPassword) {
      setAuthError('Please enter username and password.');
      return;
    }
    
    try {
      // 调用后端API进行登录验证
      const result = await apiService.login(authUsername, authPassword);
      
      if (result.success && result.user) {
        const user = result.user;
        
        if (!user.isApproved) {
          setAuthError('Account pending admin approval.');
          return;
        }
        
        // 确保数据库权限字段存在
        if (!user.databaseAccess) {
          user.databaseAccess = [];
        }
        
        setCurrentUser(user);
        storageService.saveSession(user);
        setOnlineUsers([{ username: user.username, firstName: user.firstName }]);
        setAuthError('');
        
        // 如果用户有预订权限，自动切换到bookings页面
        if (hasAnyBookingPermission()) {
          setActiveTab('bookings');
        } else {
          setActiveTab('dashboard');
        }
        
        // 清除登录表单
        setAuthUsername('');
        setAuthPassword('');
        setAuthFirstName('');
        
        // 重新加载数据以获取最新的数据库列表
        await loadAllData();
        
        // 登录成功后显示欢迎消息
        setTimeout(() => {
          if (hasAnyBookingPermission()) {
            showCopyNotification(`✅ 欢迎回来，${user.firstName}！已自动切换到预订页面。`);
          }
        }, 500);
      } else {
        setAuthError('Invalid username or password.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Login failed. Please check your connection and try again.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    storageService.clearSession();
    setOnlineUsers([]);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authUsername || !authPassword || !authFirstName) {
      setAuthError('Please fill in all fields.');
      return;
    }
    
    try {
      // 准备用户数据，但不包含 databaseAccess
      const userData = {
        username: authUsername,
        password: authPassword,
        firstName: authFirstName,
        role: UserRole.USER,
        permissions: [Permission.BOOKING_READ],
        isApproved: false,
        isActive: true
        // 注意：这里不传递 databaseAccess，因为新注册用户初始没有数据库权限
        // databaseAccess 会由管理员后续配置
      };
      
      // 直接调用后端API注册
      const result = await apiService.registerUser(userData);
      
      if (result.success) {
        alert("Registration successful! Please wait for admin approval.");
        setAuthMode('login');
        setAuthError('');
        setAuthFirstName('');
        setAuthUsername('');
        setAuthPassword('');
      } else {
        setAuthError('Registration failed. Username might be taken.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setAuthError('Registration failed. Please try again.');
    }
  };

  // ==================== 修改的密码处理函数 ====================
  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      if (!currentUser) return;
      
      // 调用API服务修改密码
      const result = await apiService.changePassword(currentPassword, newPassword);
      
      if (result.success) {
        alert('密码修改成功！请使用新密码重新登录。');
        handleLogout(); // 密码修改后强制退出登录
      } else {
        throw new Error(result.message || '密码修改失败');
      }
    } catch (error: any) {
      console.error('修改密码失败:', error);
      
      // 检查是否是401未授权错误
      if (error.message.includes('未授权') || error.message.includes('401')) {
        alert('会话已过期，请重新登录');
        setIsChangePasswordOpen(false); // 关闭修改密码模态框
        handleLogout(); // 强制退出登录
        return; // 不再抛出错误
      }
      
      throw error; // 其他错误继续抛出
    }
  };

  // 处理管理员重置其他用户密码
  const handleResetUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!selectedUserForPasswordReset) return;
    
    try {
      // 管理员重置密码不需要当前密码，所以 currentPassword 参数未被使用
      const result = await apiService.resetUserPassword(
        selectedUserForPasswordReset.id, 
        newPassword
      );
      
      if (result.success) {
        alert(`用户 ${selectedUserForPasswordReset.firstName} 的密码已重置`);
        setSelectedUserForPasswordReset(null);
      } else {
        throw new Error(result.message || '密码重置失败');
      }
    } catch (error: any) {
      console.error('重置密码失败:', error);
      
      // 检查是否是401未授权错误
      if (error.message.includes('未授权') || error.message.includes('401')) {
        alert('会话已过期，请重新登录');
        setIsChangePasswordOpen(false); // 关闭修改密码模态框
        setSelectedUserForPasswordReset(null); // 清除选中的用户
        handleLogout(); // 强制退出登录
        return; // 不再抛出错误
      }
      
      throw error; // 其他错误继续抛出
    }
  };

  const handleAddUser = async (userData: Omit<User, 'id'>) => {
    try {
      console.log('添加用户:', userData);
      
      // 确保权限是数组格式，并根据角色决定权限
      const permissions = userData.role === UserRole.ADMIN 
        ? AVAILABLE_PERMISSIONS 
        : (Array.isArray(userData.permissions) ? userData.permissions : []);
      
      const userToAdd = {
        ...userData,
        permissions: permissions,
        databaseAccess: userData.databaseAccess || [],
        isActive: true
      };
      
      // 调用注册 API
      const result = await apiService.registerUser(userToAdd);
      
      if (result.success) {
        // 重新加载用户列表
        const usersData = await apiService.getUsers();
        if (usersData.success) {
          setUsers(usersData.users);
        }
        alert('用户添加成功！');
      } else {
        const errorMsg = (result as any).error || (result as any).message || '添加用户失败';
        alert(`添加用户失败: ${errorMsg}`);
      }
    } catch (error) {
      console.error('添加用户失败:', error);
      alert('添加用户失败: ' + (error as any).message);
    }
  };

  // 更新 handleUpdateDatabaseAccess 函数
  const handleUpdateDatabaseAccess = async (userId: string, databaseAccess: DatabaseAccess[]) => {
    try {
      console.log('更新用户数据库权限:', userId, databaseAccess);
      
      // 确保 databaseAccess 是一个有效的数组
      if (!Array.isArray(databaseAccess)) {
        throw new Error('databaseAccess 必须是数组');
      }
      
      // 修复：创建一个包含任意字段的对象，解决 TypeScript 类型问题
      const updates: any = {
        databaseAccess: databaseAccess || [] // 确保不是 undefined
      };
      
      // 添加其他可能的字段，确保请求体不为空
      updates.updatedAt = new Date().toISOString();
      
      console.log('📤 发送更新请求数据:', updates);
      
      // 调用API更新用户信息
      const result = await apiService.updateUser(userId, updates);
      
      if (result.success) {
        // 更新本地用户状态
        setUsers(prev => prev.map(u => 
          u.id === userId 
            ? { ...u, databaseAccess }
            : u
        ));
        
        // 如果当前登录用户更新了自己的权限，也需要更新session
        if (currentUser && currentUser.id === userId) {
          const updatedCurrentUser = { ...currentUser, databaseAccess };
          setCurrentUser(updatedCurrentUser);
          storageService.saveSession(updatedCurrentUser);
          
          // 检查当前活动数据库是否仍然有权限，如果没有则切换到有权限的数据库
          const hasAccessToActiveDb = canViewDatabase(updatedCurrentUser, activeDbId);
          if (!hasAccessToActiveDb) {
            const accessibleDb = databases.find(db => 
              canViewDatabase(updatedCurrentUser, db.id)
            );
            if (accessibleDb) {
              setActiveDbId(accessibleDb.id);
              await loadBookings();
            } else if (databases.length > 0) {
              // 如果没有可访问的数据库，切换到第一个数据库（但会被权限检查阻止）
              setActiveDbId(databases[0].id);
            }
          }
        }
        
        alert('数据库权限更新成功！');
      } else {
        alert('数据库权限更新失败');
      }
    } catch (error) {
      console.error('更新数据库权限失败:', error);
      alert('更新数据库权限失败: ' + (error as any).message);
    }
  };

  // 获取字段的显示名称
  const getFieldDisplayName = (fieldKey: string): string => {
    const field = fields.find(f => f.key === fieldKey);
    return field ? field.label : fieldKey;
  };

  // 获取用户有权限查看的数据库列表
  const getAccessibleDatabases = useMemo(() => {
    if (!currentUser) return [];
    
    // 管理员可以看到所有数据库
    if (isUserAdmin(currentUser)) return databases;
    
    // 如果用户有 BOOKING_READ 系统权限，但还没有配置数据库权限
    // 默认显示所有数据库（在权限检查时会阻止无权限的操作）
    if (hasPermission(Permission.BOOKING_READ)) {
      // 检查用户是否有配置的数据库权限
      const userDatabaseAccess = currentUser.databaseAccess || [];
      
      if (userDatabaseAccess.length === 0) {
        // 如果用户有系统权限但没有配置数据库权限，显示所有数据库
        return databases;
      }
      
      // 否则返回有权限的数据库
      return databases.filter(db => {
        const access = userDatabaseAccess.find(da => da.databaseId === db.id);
        return access && access.isActive && access.permissions.includes('READ');
      });
    }
    
    return [];
  }, [databases, currentUser, currentUser?.databaseAccess]);

  // ==================== 财务模块函数 ====================
  // 处理财务模块导出
  const handleFinanceExport = () => {
    // 根据当前活动的财务模块，调用对应的ref
    let ref;
    switch (activeTab) {
      case 'finance':
        ref = financePanelRef;
        break;
      case 'saf_finance':
        ref = safFinancePanelRef;
        break;
      case 'cma_finance':
        ref = cmaFinancePanelRef;
        break;
      case 'concord_finance':
        ref = concordFinancePanelRef;
        break;
      default:
        return;
    }
    
    if (ref.current && ref.current.handleExport) {
      ref.current.handleExport();
    }
  };

  // 处理批量开票
  const handleFinanceBatchInvoice = () => {
    if (activeTab === 'finance' && financePanelRef.current && financePanelRef.current.handleBatchInvoice) {
      financePanelRef.current.handleBatchInvoice();
    }
  };

  // ==================== 当日放舱统计刷新函数 ====================
  const handleRefreshDailyStats = async () => {
    setIsDailyStatsLoading(true);
    try {
      // 这里调用加载当日放舱数据的API
      const response = await apiService.getBookingChangeRecords(dailyStatsSelectedDate);
      if (response.success && response.records) {
        setDailyChangeRecords(response.records);
      }
    } catch (error) {
      console.error('刷新当日放舱数据失败:', error);
    } finally {
      setIsDailyStatsLoading(false);
    }
  };

  // 获取祥泰客户的历史变更记录（从当日放舱统计页面调用）
  const getXiangTaiHistoryRecords = async () => {
    try {
      setIsDailyStatsLoading(true);
      console.log('📊 开始获取祥泰历史变更记录...');
      
      // 获取当前日期的祥泰历史数据
      const response = await apiService.getBookingChangeRecordsByClient('祥泰');
      
      if (response.success && response.records) {
        console.log(`✅ 找到 ${response.records.length} 条祥泰历史变更记录`);
        return response.records;
      } else {
        console.log('⚠️ 没有找到祥泰的历史变更记录');
        return [];
      }
    } catch (error) {
      console.error('❌ 获取祥泰历史记录失败:', error);
      
      // 使用模拟数据
      const mockRecords: any[] = [
        {
          id: 'xiangtai-1',
          databaseName: 'MAERSK-HEMU-US',
          week: '2026 WK05',
          carrier: 'MAERSK',
          service: 'USWC',
          bookingRef: '263837165',
          pol: 'NINGBO',
          pod: 'SHANGHAI',
          etd: '2026-01-26',
          vessel: 'COLORADO EXPRESS / 60AE',
          qty: 5,
          type: '40HQ',
          client: '祥泰',
          allocation: '',
          currentStatus: 'CONFIRMED',
          changeTimestamp: '2026-01-06 10:00:00',
          previousStatus: 'PENDING',
          newStatus: 'CONFIRMED',
          previousPol: 'NINGBO',
          newPol: 'SHANGHAI',
          previousPod: 'SHANGHAI',
          newPod: 'ROTTERDAM',
          previousClient: '祥泰',
          newClient: '深孚',
          changeType: 'status_change'
        },
        // 可以添加更多模拟数据
      ];
      
      return mockRecords;
    } finally {
      setIsDailyStatsLoading(false);
    }
  };

  // 导出祥泰历史数据（从当日放舱统计页面）
  const handleExportXiangTaiHistoryFromDailyStats = async () => {
    try {
      console.log('📊 开始导出祥泰历史数据...');
      
      // 获取祥泰历史数据
      const xiangTaiRecords = await getXiangTaiHistoryRecords();
      
      if (xiangTaiRecords.length === 0) {
        alert('没有找到祥泰的历史变更记录');
        return;
      }
      
      console.log(`找到 ${xiangTaiRecords.length} 条祥泰历史变更记录`);
      
      // 创建CSV内容
      const headers = [
        '放舱日期', '数据库', 'Week', 'Carrier', 'Service', 'Booking Ref', 
        'POL', 'POD', 'ETD', 'VESSEL', 'QTY', 'Type', 'Client', 'Allocation',
        '原状态', '新状态', '变更类型', '备注'
      ];
      
      const rows = xiangTaiRecords.map(record => {
        // 格式化放舱日期
        let releaseDate = '';
        if (record.changeTimestamp) {
          try {
            const date = new Date(record.changeTimestamp);
            releaseDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          } catch (e) {
            releaseDate = '未知日期';
          }
        }
        
        // 判断是否为放舱操作
        const isStatusChange = (record.previousStatus === 'PENDING' && record.newStatus === 'CONFIRMED') ||
                              (record.previousStatus === 'UNDETERMINED' && record.newStatus === 'CONFIRMED');
        
        return [
          releaseDate,
          record.databaseName || record.database_name || '未知数据库',
          record.week || '',
          record.carrier || '',
          record.service || '',
          record.bookingRef || '',
          record.pol || record.POL || '',
          record.pod || record.POD || '',
          record.etd || '',
          record.vessel || '',
          record.qty || 0,
          record.type || '',
          record.client || record.CLIENT || '',
          record.allocation || '',
          record.previousStatus || '',
          record.newStatus || '',
          isStatusChange ? '放舱' : '变更',
          isStatusChange ? '放舱' : '变更'
        ];
      });
      
      // 将数据转换为CSV格式
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          if (cell === null || cell === undefined) return '';
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');
      
      // 添加UTF-8 BOM头解决中文乱码问题
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;
      
      // 创建下载链接
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `祥泰历史放舱数据_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放URL对象
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`成功导出 ${xiangTaiRecords.length} 条祥泰历史放舱记录`);
      
    } catch (error) {
      console.error('导出祥泰历史数据时出错:', error);
      alert('导出失败，请重试');
    }
  };

  // ==================== 当日放舱统计导出函数 ====================
  const handleExportDailyStats = () => {
    if (dailyChangeRecords.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    // 这里调用导出函数
    const dateStr = dailyStatsSelectedDate.replace(/-/g, '');
    exportToCSV(dailyChangeRecords, [], `放舱统计_${dateStr}`);
  };

  // --- Loading / Connection Error States ---
  if (connectionError) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-gray-800 gap-4">
              <WifiOff className="w-12 h-12 text-red-500" />
              <h1 className="text-xl font-bold">Cannot connect to Backend Server</h1>
              <p className="text-gray-500 max-w-md text-center">
                  Please ensure your PostgreSQL server and Node.js backend are running. <br/>
                  Check console logs for more details.
              </p>
              <Button onClick={() => window.location.reload()}>Retry Connection</Button>
          </div>
      )
  }

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
              <p className="text-sm text-gray-500 font-medium">Loading OceanFlow System...</p>
          </div>
      )
  }

  // --- Render: Login / Register ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex bg-white font-sans">
        {/* Left Side - Hero / Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
           <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-indigo-900/40 z-0"></div>
           <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl"></div>
           <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl"></div>

           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Ship className="w-6 h-6 text-white" />
                 </div>
                 <h1 className="text-2xl font-bold tracking-tight">OceanFlow</h1>
              </div>
              <p className="text-blue-200">Next-gen Logistics Management</p>
           </div>

           <div className="relative z-10 space-y-6">
              <h2 className="text-4xl font-extrabold leading-tight">
                Streamline your<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Global Supply Chain.</span>
              </h2>
              <p className="text-slate-300 text-lg max-w-md leading-relaxed">
                Collaborate in real-time, manage bookings effortlessly, and gain AI-powered insights into your logistics operations.
              </p>
           </div>

           <div className="relative z-10 flex gap-4 text-sm text-slate-400">
              <span>© 2024 OceanFlow Inc.</span>
              <span className="w-px h-5 bg-slate-700"></span>
              <span>Privacy Policy</span>
           </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{authMode === 'login' ? 'Welcome back' : 'Create an account'}</h2>
              <p className="text-gray-500">
                {authMode === 'login' ? 'Please enter your details to sign in.' : 'Join the team to start managing bookings.'}
              </p>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-6">
              
              {authMode === 'register' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name / Display Name</label>
                  <input 
                    type="text" 
                    value={authFirstName} 
                    onChange={e=>setAuthFirstName(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="e.g. John"
                    required 
                  />
                  <p className="text-xs text-gray-400 mt-1">This will be used for your avatar.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                <input 
                  type="text" 
                  value={authUsername} 
                  onChange={e=>setAuthUsername(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                  placeholder="Enter your username"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input 
                  type="password" 
                    value={authPassword} 
                    onChange={e=>setAuthPassword(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="••••••••"
                    required 
                  />
                </div>
                
                {authError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                    <span className="block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    {authError}
                  </div>
                )}

                <Button type="submit" size="lg" className="w-full py-3 text-base shadow-lg shadow-blue-600/20">
                  {authMode === 'login' ? 'Sign In' : 'Register'}
                </Button>
            </form>

            <div className="text-center pt-4">
              <p className="text-sm text-gray-600">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  onClick={() => { setAuthMode(authMode==='login'?'register':'login'); setAuthError(''); setAuthFirstName(''); setAuthUsername(''); setAuthPassword(''); }}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {authMode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeDb) return <div className="flex items-center justify-center h-screen text-gray-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const NavItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      title={isSidebarCollapsed ? label : undefined}
      className={`flex w-full p-2.5 my-1 rounded-lg transition-all duration-200 items-center group relative overflow-hidden text-sm
        ${activeTab === id ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
        ${isSidebarCollapsed ? 'justify-center' : ''}
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 transition-transform ${isSidebarCollapsed ? '' : 'mr-3'} ${activeTab === id ? 'scale-110' : 'group-hover:scale-110'}`} /> 
      {!isSidebarCollapsed && <span className="font-medium">{label}</span>}
      {activeTab === id && !isSidebarCollapsed && <div className="absolute right-0 w-1 h-6 bg-white/20 rounded-l-full"></div>}
    </button>
  );

  // 检查用户是否有财务模块权限
  const hasFinancePermissions = hasAnyFinancePermission();
  const isAdmin = isUserAdmin(currentUser);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar - Deep Dark Theme */}
      <aside className={`bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 ${isSidebarCollapsed ? 'w-16' : 'w-60'} z-50 h-screen`}>
        <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} h-16`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Ship className="w-5 h-5 text-white" />
            </div>
            {!isSidebarCollapsed && <h1 className="text-lg font-bold whitespace-nowrap tracking-tight">OceanFlow</h1>}
          </div>
          {!isSidebarCollapsed && (
            <button onClick={() => setIsSidebarCollapsed(true)} className="text-slate-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {isSidebarCollapsed && (
          <div className="flex justify-center mb-4">
            <button onClick={() => setIsSidebarCollapsed(false)} className="text-slate-400 hover:text-white p-1.5 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-2 custom-scrollbar">
          {/* Core Features */}
          <NavItem id="dashboard" label="Dashboard" icon={LayoutDashboard} />
          
          {/* Bookings - 只要有BOOKING_READ权限就显示 */}
          {hasPermission(Permission.BOOKING_READ) && (
            <NavItem id="bookings" label="Bookings" icon={TableIcon} />
          )}
          
          {hasPermission(Permission.QUOTATION_READ) && <NavItem id="quotations" label="Quotations" icon={DollarSign} />}
          
          {/* 当日放舱统计 - 只要有BOOKING_READ权限就显示 */}
          {hasPermission(Permission.BOOKING_READ) && (
            <NavItem id="daily_stats" label="当日放舱" icon={Ship} />
          )}
          
          {/* Finance Group - Only visible to users with finance permissions */}
          {hasFinancePermissions && (
            <>
              {!isSidebarCollapsed && (
                <div className="mt-6 mb-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3">Finance</div>
              )}
              
              {canViewFinanceModule('MY_FINANCE') && <NavItem id="finance" label="MyFinance" icon={Wallet} />}
              {canViewFinanceModule('SAF_FINANCE') && <NavItem id="saf_finance" label="SAF" icon={Wallet} />}
              {canViewFinanceModule('CMA_FINANCE') && <NavItem id="cma_finance" label="CMA" icon={Wallet} />}
              {canViewFinanceModule('CONCORD_FINANCE') && <NavItem id="concord_finance" label="CONCORD" icon={Wallet} />}
            </>
          )}
          
          {/* External Tools Group - OpenClaw 对所有用户可见 */}
          {!isSidebarCollapsed ? (
            <div className="mt-6 mb-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3">External Tools</div>
          ) : (
            <div className="my-3 border-t border-slate-800 mx-2" />
          )}
          
          {/* OpenClaw 链接 */}
          <a
            href="http://43.167.187.19:18789/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('openclaw');
            }}
            title={isSidebarCollapsed ? "OpenClaw" : undefined}
            className={`flex w-full p-2.5 my-1 rounded-lg transition-all duration-200 items-center group relative overflow-hidden text-sm
              ${activeTab === 'openclaw' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            <Globe className={`w-4 h-4 flex-shrink-0 transition-transform ${isSidebarCollapsed ? '' : 'mr-3'} ${activeTab === 'openclaw' ? 'scale-110' : 'group-hover:scale-110'}`} /> 
            {!isSidebarCollapsed && <span className="font-medium">OpenClaw</span>}
            {activeTab === 'openclaw' && !isSidebarCollapsed && <div className="absolute right-0 w-1 h-6 bg-white/20 rounded-l-full"></div>}
          </a>
          
          {/* System Group - Only visible to admins */}
          {isAdmin && (
            <>
              {!isSidebarCollapsed && (
                <div className="mt-6 mb-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3">System</div>
              )}
              
              <NavItem id="admin" label="Users" icon={Users} />
              <NavItem id="settings" label="Settings" icon={Settings} />
              
              {/* Help module - Only visible to admins */}
              {!isSidebarCollapsed ? (
                <div className="mt-6 mb-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3">Support</div>
              ) : (
                <div className="my-3 border-t border-slate-800 mx-2" />
              )}
              <NavItem id="help" label="Help / API" icon={BookOpen} />
            </>
          )}
        </nav>

        <div className={`p-3 bg-slate-950/50 border-t border-slate-800 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center flex-col' : ''}`}>
          <Avatar name={currentUser.firstName} />
          {!isSidebarCollapsed ? (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate text-slate-200">{currentUser.firstName}</p>
                <p className="text-xs text-slate-300 font-bold uppercase truncate tracking-wider">
                  <span className={`w-1.5 h-1.5 rounded-full ${onlineUsers.some(u => u.username === currentUser.username) ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                  {/* {currentUser.role} */}
                  {/* {getAccessibleDatabases.length > 0 && (
                    <span className="ml-2 text-xs text-blue-400">
                      ({getAccessibleDatabases.length}/{databases.length} DBs)
                    </span>
                  )} */}
                </p>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setPasswordModalType('self');
                    setIsChangePasswordOpen(true);
                  }} 
                  title="修改密码" 
                  className="hover:bg-slate-800 p-2 rounded-lg group"
                >
                  <Lock className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
                </button>
                <button onClick={handleLogout} title="退出登录" className="hover:bg-slate-800 p-2 rounded-lg group">
                  <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <button 
                onClick={() => {
                  setPasswordModalType('self');
                  setIsChangePasswordOpen(true);
                }} 
                title="修改密码" 
                className="mt-2 hover:bg-slate-800 p-2 rounded-lg group"
              >
                <Lock className="w-4 h-4 text-slate-400 group-hover:text-blue-400" />
              </button>
              <button onClick={handleLogout} title="退出登录" className="mt-2 hover:bg-slate-800 p-2 rounded-lg group">
                <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full bg-gray-50">
        {/* Top Header - Compact */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex justify-between items-center z-[100] flex-shrink-0 relative sticky top-0">
          <div>
            <h2 className="text-[12px] font-bold text-gray-800 capitalize tracking-tight flex items-center gap-2">
              {activeTab === 'bookings' && activeDb && <><Database className="w-3.5 h-3.5 text-gray-400" />{activeDb.name}</>}
              {activeTab === 'daily_stats' && <><Ship className="w-3.5 h-3.5 text-gray-400" />当日放舱</>}
              {activeTab === 'dashboard' && <><LayoutDashboard className="w-3.5 h-3.5 text-gray-400" />数据分析</>}
              {activeTab === 'admin' && <><Users className="w-3.5 h-3.5 text-gray-400" />用户管理</>}
              {activeTab === 'settings' && <><Settings className="w-3.5 h-3.5 text-gray-400" />系统设置</>}
              {activeTab === 'quotations' && <><DollarSign className="w-3.5 h-3.5 text-gray-400" />报价管理</>}
              {activeTab === 'finance' && <><Wallet className="w-3.5 h-3.5 text-gray-400" />MyFinance</>}
              {activeTab === 'saf_finance' && <><Wallet className="w-3.5 h-3.5 text-gray-400" />SAF Finance</>}
              {activeTab === 'cma_finance' && <><Wallet className="w-3.5 h-3.5 text-gray-400" />CMA Finance</>}
              {activeTab === 'concord_finance' && <><Wallet className="w-3.5 h-3.5 text-gray-400" />CONCORD Finance</>}
              {activeTab === 'openclaw' && <><Globe className="w-3.5 h-3.5 text-gray-400" />OpenClaw</>}
              {activeTab === 'help' && <><BookOpen className="w-3.5 h-3.5 text-gray-400" />系统帮助</>}
              {activeTab === 'bookings' ? '' : !['dashboard', 'daily_stats', 'admin', 'settings', 'quotations', 'finance', 'saf_finance', 'cma_finance', 'concord_finance', 'openclaw', 'help'].includes(activeTab) && <>{activeDb.name}</>}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <UserPresence users={onlineUsers} onClick={() => setIsChatOpen(!isChatOpen)} />

            {/* 预订页面的顶部栏内容 - 只在 bookings 标签页显示 */}
            {activeTab === 'bookings' && hasAnyBookingPermission() && (
              <div className="flex gap-2 animate-in fade-in zoom-in duration-300 items-center">
                {/* 权限状态指示器 */}
                {!canViewDatabase(currentUser, activeDbId) ? (
                  <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-md text-[10px] border border-red-200">
                    <span>⚠️ 无数据库访问权限</span>
                  </div>
                ) : (
                  <>
                    {/* 搜索框 */}
                    <div className="relative group">
                      <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder="Search..." 
                        className="pl-8 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] w-32 xl:w-48 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                      />
                    </div>
                    
                    <div className="h-4 w-px bg-gray-200 mx-1"></div>

                    <Button 
                      size="sm"
                      variant={isFilterPanelOpen || activeFilters.length > 0 ? "primary" : "secondary"} 
                      onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)} 
                      title="Advanced Filters"
                      className={`text-[11px] px-2.5 py-1 ${activeFilters.length > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "text-gray-600"}`}
                    >
                      <Filter className="w-3 h-3 mr-1" /> 
                      Filter {activeFilters.length > 0 && <span className="ml-1 bg-white/20 px-1 py-0 rounded text-[9px]">{activeFilters.length}</span>}
                    </Button>

                    <Button size="sm" variant="secondary" onClick={() => setIsColManagerOpen(true)} title="Manage Columns" className="text-gray-600 text-[11px] px-2.5 py-1">
                      <Columns className="w-3 h-3 mr-1" /> Cols
                    </Button>
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".csv" hidden />

                    <div className="relative" ref={dataMenuRef}>
                      <Button size="sm" variant="secondary" onClick={() => setIsDataMenuOpen(!isDataMenuOpen)} className="bg-white text-gray-700 hover:bg-gray-50 text-[11px] px-2.5 py-1">
                        <FileSpreadsheet className="w-3 h-3 mr-1 text-green-600" /> Data
                      </Button>
                      
                    {isDataMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-[120] py-1 animate-in fade-in slide-in-from-top-2 overflow-hidden ring-1 ring-black/5">
                        <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Excel Operations</p>
                        </div>
                        
                        <button onClick={handleExportData} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                          <div className="p-0.5 bg-indigo-100 rounded text-indigo-600"><Download className="w-3 h-3" /></div> Export Data (CSV)
                        </button>

                        <button onClick={handleDownloadTemplate} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                          <div className="p-0.5 bg-green-100 rounded text-green-600"><FileSpreadsheet className="w-3 h-3" /></div> Download Template
                        </button>
                        
                        {/* 添加祥泰历史导出按钮 - 确保 onClick 绑定正确 */}
                        <button 
                          onClick={handleExportFullXiangTaiHistory} 
                          className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors export-xiangtai-btn"
                        >
                          <div className="p-0.5 bg-amber-100 rounded text-amber-600"><FileSpreadsheet className="w-3 h-3" /></div> 
                          导出祥泰历史
                        </button>
                        
                        {canCreateInDatabase(currentUser, activeDbId) && (
                          <>
                            <button onClick={() => triggerImport('append')} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                              <div className="p-0.5 bg-blue-100 rounded text-blue-600"><Upload className="w-3 h-3" /></div> Append Data
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            <button onClick={() => triggerImport('overwrite')} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <div className="p-0.5 bg-red-100 rounded text-red-600"><RefreshCw className="w-3 h-3" /></div> Overwrite Database
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    </div>

                    {canCreateInDatabase(currentUser, activeDbId) && (
                      <Button size="sm" onClick={() => { setEditingBooking(undefined); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 text-[11px] px-3 py-1">
                        <Plus className="w-3 h-3 mr-1" /> New
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* 当日放舱统计的顶部栏内容 - 只在 daily_stats 标签页显示 */}
            {activeTab === 'daily_stats' && hasPermission(Permission.BOOKING_READ) && (
              <div className="flex gap-2 animate-in fade-in zoom-in duration-300 items-center">
                {/* 加载状态指示器 */}
                {isDailyStatsLoading && (
                  <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] border border-blue-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>加载中...</span>
                  </div>
                )}
                
                {/* 日期选择器 */}
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2 py-1 text-xs">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <input
                    type="date"
                    value={dailyStatsSelectedDate}
                    onChange={(e) => setDailyStatsSelectedDate(e.target.value)}
                    className="bg-transparent outline-none text-xs"
                    style={{ width: '120px' }}
                  />
                </div>
                
                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                {/* 操作按钮组 */}
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm"
                    variant="secondary" 
                    onClick={handleRefreshDailyStats} 
                    title="刷新数据"
                    className="text-gray-600 text-[11px] px-2.5 py-1"
                    disabled={isDailyStatsLoading}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isDailyStatsLoading ? 'animate-spin' : ''}`} /> 
                    {isDailyStatsLoading ? '刷新中...' : '刷新'}
                  </Button>

                  <Button 
                    size="sm"
                    variant="secondary" 
                    onClick={handleExportDailyStats} 
                    title="导出当日所有数据"
                    disabled={dailyChangeRecords.length === 0 || isDailyStatsLoading}
                    className="text-gray-600 text-[11px] px-2.5 py-1"
                  >
                    <Download className="w-3 h-3 mr-1" /> 
                    导出当日
                  </Button>

                  {/* 新增：导出祥泰历史按钮 */}
                  <Button 
                    size="sm"
                    variant="secondary" 
                    onClick={handleExportXiangTaiHistory} 
                    title="导出祥泰所有历史数据"
                    disabled={isDailyStatsLoading}
                    className="text-amber-600 text-[11px] px-2.5 py-1 border-amber-200 bg-amber-50 hover:bg-amber-100"
                  >
                    <FileSpreadsheet className="w-3 h-3 mr-1" /> 
                    导出祥泰历史
                  </Button>
                </div>
              </div>
            )}
            
            {/* Quotation 页面的顶部栏内容 - 只在 quotations 标签页显示 */}
            {activeTab === 'quotations' && hasPermission(Permission.QUOTATION_READ) && (
              <div className="flex gap-2 animate-in fade-in zoom-in duration-300 items-center">
                {/* 搜索框 */}
                <div className="relative group">
                  <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Search quotes..." 
                    className="pl-8 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] w-32 xl:w-48 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                    value={quotationSearchTerm} 
                    onChange={e => setQuotationSearchTerm(e.target.value)} 
                  />
                </div>
                
                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                {/* 操作按钮组 */}
                <div className="flex items-center gap-1">
                  {hasPermission(Permission.QUOTATION_CREATE) && (
                    <>
                      <Button 
                        size="sm"
                        variant="secondary" 
                        onClick={handleQuotationImportClick} 
                        title="导入报价"
                        className="text-gray-600 text-[11px] px-2.5 py-1"
                      >
                        <Upload className="w-3 h-3 mr-1" /> 导入
                      </Button>

                      <Button 
                        size="sm"
                        variant="secondary" 
                        onClick={handleQuotationExport} 
                        title="导出报价"
                        className="text-gray-600 text-[11px] px-2.5 py-1"
                      >
                        <Download className="w-3 h-3 mr-1" /> 导出
                      </Button>
                    </>
                  )}

                  <Button 
                    size="sm"
                    variant="secondary" 
                    onClick={handleQuotationScreenshot} 
                    disabled={isQuotationCapturing}
                    className="text-gray-600 text-[11px] px-2.5 py-1"
                  >
                    {isQuotationCapturing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
                    截图
                  </Button>

                  {hasPermission(Permission.QUOTATION_CREATE) && (
                    <>
                      <Button 
                        size="sm"
                        variant="secondary" 
                        onClick={handleCreateRegion} 
                        className="text-gray-600 text-[11px] px-2.5 py-1"
                      >
                        <FolderTree className="w-3 h-3 mr-1" /> 新建区域
                      </Button>

                      <Button 
                        size="sm"
                        onClick={handleQuickAdd} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1 shadow-md"
                      >
                        <Plus className="w-3 h-3 mr-1" /> 快速添加
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* 财务模块顶部栏内容 - 在所有财务模块标签页显示 */}
            {['finance', 'saf_finance', 'cma_finance', 'concord_finance'].includes(activeTab) && hasAnyFinancePermission() && (
              <div className="flex gap-2 animate-in fade-in zoom-in duration-300 items-center">
                {/* 加载状态指示器 */}
                {isFinanceDataLoading && (
                  <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] border border-blue-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>加载中...</span>
                  </div>
                )}
                
                {/* 搜索框 */}
                <div className="relative group">
                  <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="搜索订舱号、客户..." 
                    className="pl-8 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] w-32 xl:w-48 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                    value={financeSearchTerm} 
                    onChange={e => setFinanceSearchTerm(e.target.value)} 
                  />
                </div>
                
                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                {/* 筛选按钮 - 修改此处 */}
                <Button 
                  size="sm"
                  variant={financeIsFilterPanelOpen || financeActiveFilters.length > 0 ? "primary" : "secondary"} 
                  onClick={() => setFinanceIsFilterPanelOpen(!financeIsFilterPanelOpen)} 
                  title="高级筛选"
                  className={`flex items-center text-[10px] h-[26px] px-3 ${financeActiveFilters.length > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "text-gray-600"}`}
                >
                  <Filter className="w-3 h-3 mr-1" /> 
                  筛选 {financeActiveFilters.length > 0 && <span className="ml-1 bg-white/20 px-1 py-0 rounded text-[9px]">{financeActiveFilters.length}</span>}
                </Button>

                {/* 月份选择 */}
                <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <select 
                    value={financeSelectedMonth} 
                    onChange={(e) => setFinanceSelectedMonth(e.target.value)} 
                    className="bg-gray-50 border border-gray-200 rounded-md text-xs px-2 py-1 outline-none h-[26px]"
                  >
                    <option value="">全部月份</option>
                    {getFinanceAvailableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                {/* 批量开票按钮 (仅MyFinance显示)
                {activeTab === 'finance' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleFinanceeBatchInvoice}
                    className="text-emerald-600 text-[10px] py-1.5 h-[32px]"
                    title="批量开票"
                  >
                    <FileText className="w-3 h-3 mr-1.5" /> 批量开票
                  </Button>
                )} */}
                
                {/* 导出Excel按钮 - 修改此处 */}
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleFinanceExport} 
                  className="flex items-center text-gray-600 text-[10px] h-[26px] px-3"
                >
                  <Download className="w-3 h-3 mr-1.5" /> 导出
                </Button>
              </div>
            )}
           
            {/* 数据分析（Dashboard）页面的刷新按钮 */}
            {activeTab === 'dashboard' && (
              <button
                onClick={loadAllData}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-[11px] rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-3 h-2 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                刷新数据
              </button>
            )}

            {/* OpenClaw 页面的顶部栏内容 */}
            {activeTab === 'openclaw' && (
              <div className="flex gap-2 animate-in fade-in zoom-in duration-300 items-center">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Globe className="w-3 h-3 text-blue-500" />
                  <span>http://43.167.187.19:18789/</span>
                </div>
                
                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                <Button 
                  size="sm"
                  variant="secondary" 
                  onClick={() => {
                    const iframe = document.getElementById('openclaw-iframe') as HTMLIFrameElement;
                    if (iframe) {
                      // 重新设置 src 属性来刷新 iframe
                      iframe.src = iframe.src;
                    }
                  }}
                  title="刷新页面"
                  className="text-gray-600 text-[11px] px-2.5 py-1"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> 刷新
                </Button>

                <Button 
                  size="sm"
                  variant="secondary" 
                  onClick={() => window.open('http://43.167.187.19:18789/', '_blank')}
                  title="在新标签页中打开"
                  className="text-blue-600 text-[11px] px-2.5 py-1"
                >
                  <Eye className="w-3 h-3 mr-1" /> 新窗口
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* 数据库选项卡 - 只在 bookings 标签页显示 */}
        {activeTab === 'bookings' && hasAnyBookingPermission() && (
          <div className="bg-white border-b border-gray-200 px-4 flex items-center gap-0 overflow-x-auto flex-shrink-0 z-40 relative h-9 select-none custom-scrollbar">
            {databases.map((db, index) => {
              // 如果有系统权限但没有配置数据库权限，默认显示所有数据库
              const hasAccess = currentUser?.databaseAccess && currentUser.databaseAccess.length > 0 
                ? canViewDatabase(currentUser, db.id)
                : true; // 默认允许查看
              
              const isActive = activeDbId === db.id;
              
              return (
                <div
                  key={db.id}
                  draggable={isAdmin} // 只有管理员可以拖拽重新排序
                  onDragStart={(e) => isAdmin && handleDbDragStart(e, index)}
                  onDragOver={(e) => isAdmin && handleDbDragOver(e, index)}
                  onDrop={(e) => isAdmin && handleDbDrop(e, index)}
                  onClick={() => {
                    if (!hasAccess && currentUser?.databaseAccess && currentUser.databaseAccess.length > 0) {
                      alert('您没有权限查看此数据库');
                      return;
                    }
                    handleDatabaseSwitch(db.id);
                  }}
                  className={`
                    relative flex items-center px-4 py-2 text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer relative
                    ${draggedDbIndex === index ? 'opacity-50 bg-gray-50' : 'opacity-100'}
                    ${isActive 
                        ? 'text-blue-600 border-b-2 border-blue-600 font-semibold' 
                        : hasAccess 
                          ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-50' 
                          : 'text-gray-400 cursor-not-allowed hover:bg-gray-50/50'
                    }
                  `}
                  style={{
                    marginRight: '2px',
                  }}
                  title={!hasAccess ? "您没有权限查看此数据库" : db.name}
                >
                  <span className="truncate max-w-[140px]">{db.name}</span>
                  
                  {/* 无权限指示器 */}
                  {!hasAccess && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                  
                  {/* 拖拽指示器（仅在拖拽时显示） */}
                  {draggedDbIndex === index && (
                    <div className="absolute inset-0 border border-dashed border-blue-300 rounded pointer-events-none"></div>
                  )}
                </div>
              );
            })}
            
            {/* 添加新数据库按钮（只有管理员可见） */}
            {isAdmin && (
              <button
                onClick={() => {
                  const name = prompt('请输入新数据库名称:');
                  if (name && name.trim()) {
                    handleAddDatabase(name.trim());
                  }
                }}
                className="ml-1 flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                title="添加新数据库"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Content Area - Optimized for High Density */}
        <div className="flex-1 overflow-hidden p-3 relative z-0">
          {/* 修改：Dashboard - 已修复 */}
          {activeTab === 'dashboard' && (
            <div className="absolute inset-0 p-3">
              <div className="h-full overflow-auto custom-scrollbar">
                <Dashboard databases={databases} allocations={allocations}/>
              </div>
            </div>
          )}
          
          {/* 修改：Admin Panel */}
          {activeTab === 'admin' && isUserAdmin(currentUser) && (
            <div className="absolute inset-0 p-3">
              <div className="h-full overflow-auto custom-scrollbar">
                <AdminPanel 
                  users={users} 
                  databases={databases}
                  onApprove={async (id) => {
                    try {
                      const result = await apiService.updateUser(id, { isApproved: true });
                      if (result.success) {
                        setUsers(users.map(u => u.id === id ? { ...u, isApproved: true } : u));
                      }
                    } catch (error) {
                      console.error('批准用户失败:', error);
                      alert('批准用户失败: ' + (error as any).message);
                    }
                  }} 
                  onUpdatePermissions={async (id, perms) => {
                    try {
                      console.log('更新用户权限:', id, perms);
                      
                      // 调用 API 更新权限
                      const result = await apiService.updateUserPermissions(id, perms);
                      
                      if (result.success) {
                        setUsers(users.map(u => u.id === id ? { ...u, permissions: perms } : u));
                        alert('权限更新成功！');
                      } else {
                        alert('权限更新失败');
                      }
                    } catch (error) {
                      console.error('更新权限失败:', error);
                      alert('更新权限失败: ' + (error as any).message);
                    }
                  }} 
                  onUpdateDatabaseAccess={handleUpdateDatabaseAccess}
                  onDeleteUser={async (id) => {
                    if (window.confirm('确定删除此用户吗？')) {
                      try {
                        const result = await apiService.deleteUser(id);
                        if (result.success) {
                          setUsers(users.filter(u => u.id !== id));
                          alert('用户删除成功！');
                        }
                      } catch (error) {
                        console.error('删除用户失败:', error);
                        alert('删除用户失败: ' + (error as any).message);
                      }
                    }
                  }} 
                  onAddUser={handleAddUser}
                  onResetPassword={(user) => {
                    setSelectedUserForPasswordReset(user);
                    setPasswordModalType('admin');
                    setIsChangePasswordOpen(true);
                  }}
                />
              </div>
            </div>
          )}
          
          {/* 修改：Settings Panel */}
          {activeTab === 'settings' && isUserAdmin(currentUser) && (
            <div className="absolute inset-0 p-3">
              <div className="h-full overflow-auto custom-scrollbar">
                <SettingsPanel 
                  carriers={carriers} 
                  setCarriers={(v) => updateSetting('carriers', v)} 
                  clients={clients} 
                  setClients={(v) => updateSetting('clients', v)} 
                  services={services} 
                  setServices={(v) => updateSetting('services', v)} 
                  pols={pols} 
                  setPols={(v) => updateSetting('pols', v)} 
                  pods={pods} 
                  setPods={(v) => updateSetting('pods', v)} 
                  containerTypes={containerTypes} 
                  setContainerTypes={(v) => updateSetting('containerTypes', v)} 
                  statuses={statuses} 
                  setStatuses={(v) => updateSetting('statuses', v)} 
                  jobs={jobs}
                  setJobs={(v) => updateSetting('jobs', v)}
                  allocations={allocations} // 现在传递 Allocation[] 类型
                  setAllocations={(v) => updateSetting('allocations', v)} // 接收 Allocation[] 类型
                  remarks={remarks}
                  setRemarks={(v) => updateSetting('remarks', v)}
                  databases={databases} 
                  addDatabase={handleAddDatabase} 
                  renameDatabase={handleRenameDatabase}
                  deleteDatabase={handleDeleteDatabase}
                  onImportSettings={handleImportSettings}
                  systemSettings={systemSettings}
                  updateSetting={updateSetting}
                  onRefreshDatabases={loadAllData}
                />
              </div>
            </div>
          )}
          
          {/* 修改：Help / API */}
          {activeTab === 'help' && isUserAdmin(currentUser) && (
            <div className="absolute inset-0 p-3">
              <div className="h-full overflow-auto custom-scrollbar">
                <PostgresTutorial />
              </div>
            </div>
          )}
          
          {/* OpenClaw 页面 - 使用 iframe 嵌入外部网站 */}
          {activeTab === 'openclaw' && (
            <div className="absolute inset-0 p-0 overflow-hidden">
              <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex-1 relative">
                  <iframe
                    id="openclaw-iframe"
                    src="http://43.167.187.19:18789/"
                    title="OpenClaw"
                    className="absolute inset-0 w-full h-full border-0"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                    allow="clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* 其他标签页保持不变 */}
          {activeTab === 'quotations' && hasPermission(Permission.QUOTATION_READ) && (
            <QuotationPanel 
              ref={quotationPanelRef}
              quotations={quotations} 
              onAdd={handleAddQuotation}
              onUpdate={handleUpdateQuotation}
              onDelete={handleDeleteQuotation}
              carriers={carriers}
              pols={pols}
              pods={pods}
              canCreate={hasPermission(Permission.QUOTATION_CREATE)}
              canUpdate={hasPermission(Permission.QUOTATION_UPDATE)}
              canDelete={hasPermission(Permission.QUOTATION_DELETE)}
              // 从 App.tsx 传递的 props
              searchTerm={quotationSearchTerm}
              onSearchChange={setQuotationSearchTerm}
              // 移除 isCapturing 属性 ↓↓↓
              // isCapturing={isQuotationCapturing}
              visibleColumns={quotationVisibleColumns}
              onToggleColumn={(key) => {
                const keyTyped = key as keyof typeof quotationVisibleColumns;
                setQuotationVisibleColumns(prev => ({ 
                  ...prev, 
                  [keyTyped]: !prev[keyTyped] 
                }));
              }}
            />
          )}
          
          {/* 当日放舱统计组件 - 传递顶部栏的状态 */}
          {activeTab === 'daily_stats' && hasPermission(Permission.BOOKING_READ) && (
            <DailyBookingStats 
              databases={databases}
              systemSettings={systemSettings}
              selectedDate={dailyStatsSelectedDate}
              onRefreshData={handleRefreshDailyStats}
              currentUser={currentUser}
            />
          )}
                    
          {/* 财务模块渲染 - 使用专门的财务数据 */}
          {activeTab === 'finance' && canViewFinanceModule('MY_FINANCE') && (
            <FinancePanel
              ref={financePanelRef}
              databases={isFinanceDataLoading ? databases : financeDatabases} // 如果正在加载财务数据，使用普通数据作为后备
              onUpdateBooking={updateBookingInDb}
              canUpdate={hasPermission(Permission.FINANCE_UPDATE) || currentUser.role === UserRole.ADMIN}
              canLock={hasPermission(Permission.FINANCE_LOCK) || currentUser.role === UserRole.ADMIN}
              systemSettings={systemSettings}
              variant="MY_FINANCE"
              searchTerm={financeSearchTerm}
              onSearchTermChange={setFinanceSearchTerm}
              selectedMonth={financeSelectedMonth}
              onSelectedMonthChange={setFinanceSelectedMonth}
              isFilterPanelOpen={financeIsFilterPanelOpen}
              onFilterPanelOpenChange={setFinanceIsFilterPanelOpen}
              activeFilters={financeActiveFilters}
              onActiveFiltersChange={setFinanceActiveFilters}
            />
          )}
          {activeTab === 'saf_finance' && canViewFinanceModule('SAF_FINANCE') && (
            <FinancePanel
              ref={safFinancePanelRef}
              databases={isFinanceDataLoading ? databases : financeDatabases}
              onUpdateBooking={updateBookingInDb}
              canUpdate={hasPermission(Permission.SAF_FINANCE_UPDATE) || currentUser.role === UserRole.ADMIN}
              canLock={hasPermission(Permission.SAF_FINANCE_LOCK) || currentUser.role === UserRole.ADMIN}
              systemSettings={systemSettings}
              variant="SAF_FINANCE"
              searchTerm={financeSearchTerm}
              onSearchTermChange={setFinanceSearchTerm}
              selectedMonth={financeSelectedMonth}
              onSelectedMonthChange={setFinanceSelectedMonth}
              isFilterPanelOpen={financeIsFilterPanelOpen}
              onFilterPanelOpenChange={setFinanceIsFilterPanelOpen}
              activeFilters={financeActiveFilters}
              onActiveFiltersChange={setFinanceActiveFilters}
            />
          )}
          {activeTab === 'cma_finance' && canViewFinanceModule('CMA_FINANCE') && (
            <FinancePanel
              ref={cmaFinancePanelRef}
              databases={isFinanceDataLoading ? databases : financeDatabases}
              onUpdateBooking={updateBookingInDb}
              canUpdate={hasPermission(Permission.CMA_FINANCE_UPDATE) || currentUser.role === UserRole.ADMIN}
              canLock={hasPermission(Permission.CMA_FINANCE_LOCK) || currentUser.role === UserRole.ADMIN}
              systemSettings={systemSettings}
              variant="CMA_FINANCE"
              searchTerm={financeSearchTerm}
              onSearchTermChange={setFinanceSearchTerm}
              selectedMonth={financeSelectedMonth}
              onSelectedMonthChange={setFinanceSelectedMonth}
              isFilterPanelOpen={financeIsFilterPanelOpen}
              onFilterPanelOpenChange={setFinanceIsFilterPanelOpen}
              activeFilters={financeActiveFilters}
              onActiveFiltersChange={setFinanceActiveFilters}
            />
          )}
          {activeTab === 'concord_finance' && canViewFinanceModule('CONCORD_FINANCE') && (
            <FinancePanel
              ref={concordFinancePanelRef}
              databases={isFinanceDataLoading ? databases : financeDatabases}
              onUpdateBooking={updateBookingInDb}
              canUpdate={hasPermission(Permission.CONCORD_FINANCE_UPDATE) || currentUser.role === UserRole.ADMIN}
              canLock={hasPermission(Permission.CONCORD_FINANCE_LOCK) || currentUser.role === UserRole.ADMIN}
              systemSettings={systemSettings}
              variant="CONCORD_FINANCE"
              searchTerm={financeSearchTerm}
              onSearchTermChange={setFinanceSearchTerm}
              selectedMonth={financeSelectedMonth}
              onSelectedMonthChange={setFinanceSelectedMonth}
              isFilterPanelOpen={financeIsFilterPanelOpen}
              onFilterPanelOpenChange={setFinanceIsFilterPanelOpen}
              activeFilters={financeActiveFilters}
              onActiveFiltersChange={setFinanceActiveFilters}
            />
          )}

          {activeTab === 'bookings' && hasAnyBookingPermission() && (
            <>
              {/* 权限检查提示 */}
              {!canViewDatabase(currentUser, activeDbId) ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-gray-200">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">无访问权限</h3>
                  <p className="text-gray-600 mb-6 max-w-md text-center">
                    您没有权限查看数据库 <strong>{activeDb?.name}</strong>。
                    请联系管理员为您分配相应的数据库访问权限。
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => {
                        // 切换到用户有权限查看的第一个数据库
                        const accessibleDb = databases.find(db => 
                          canViewDatabase(currentUser, db.id)
                        );
                        if (accessibleDb) {
                          handleDatabaseSwitch(accessibleDb.id);
                        }
                      }}
                      variant="primary"
                    >
                      切换到有权限的数据库
                    </Button>
                    {isAdmin && (
                      <Button 
                        onClick={() => setActiveTab('admin')}
                        variant="secondary"
                      >
                        前往用户管理
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <AdvancedFilter 
                    isOpen={isFilterPanelOpen} 
                    fields={fields} 
                    optionsMap={optionsMap} 
                    filters={activeFilters} 
                    onAddFilter={(f) => setActiveFilters([...activeFilters, f])} 
                    onRemoveFilter={(id) => setActiveFilters(activeFilters.filter(f => f.id !== id))} 
                    onClearAll={() => setActiveFilters([])} 
                    onClose={() => setIsFilterPanelOpen(false)} 
                  />

                  {/* 加载状态指示器 */}
                  {isLoadingBookings && (
                    <div className="flex justify-center items-center p-4 bg-white/50 rounded-lg mb-2">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                      <span className="text-sm text-gray-600">正在加载数据...</span>
                    </div>
                  )}

                  {/* 修复：优化表格容器布局，解决底部空白问题 */}
                  <div className="flex flex-col h-[calc(100vh-130px)] min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 ring-1 ring-black/5">
                    {/* 表格容器 - 使用固定高度，确保分页可见 */}
                    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
                          <tr className="h-8">
                            {/* 操作列居中 */}
                            <th className="w-10 text-center border-r border-b border-gray-200 bg-gray-50 sticky left-0 z-40 text-xs font-bold align-middle">Actions</th>
                            {fields.map(field => {
                              const isSortable = sortableFields[field.key] !== undefined;
                              const isCurrentSortField = sortField === field.key;
                              
                              return (
                                <th 
                                  key={field.key} 
                                  className={`py-2 px-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider text-center
                                    ${field.width || 'w-24'}
                                    ${isSortable ? 'cursor-pointer hover:bg-gray-100 transition-colors group' : ''}
                                    border-r border-b border-gray-200`}
                                  onClick={isSortable ? () => handleSort(field.key) : undefined}
                                  title={isSortable ? `点击按 ${field.label} 排序` : ''}
                                >
                                  <div className="flex items-center justify-center">
                                    <span>{field.label}</span>
                                    {isSortable && (
                                      <div className="flex flex-col ml-1 opacity-0 group-hover:opacity-60 transition-opacity">
                                        {/* 升序箭头 */}
                                        <svg 
                                          className={`w-2 h-2 ${isCurrentSortField && sortDirection === 'asc' ? 'text-blue-600 opacity-100' : 'text-gray-300'}`} 
                                          fill="currentColor" 
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M6 3L2 7h8z" />
                                        </svg>
                                        {/* 降序箭头 */}
                                        <svg 
                                          className={`w-2 h-2 ${isCurrentSortField && sortDirection === 'desc' ? 'text-blue-600 opacity-100' : 'text-gray-300'}`} 
                                          fill="currentColor" 
                                          viewBox="0 0 12 12"
                                          style={{ transform: 'translateY(-2px)' }}
                                        >
                                          <path d="M6 9L2 5h8z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[11px]">
                          {currentPageBookings.length === 0 ? (
                            <tr>
                              <td colSpan={fields.length + 1} className="p-6 text-center text-gray-400 italic text-xs align-middle">
                                <TableIcon className="w-8 h-8 opacity-20 mb-1 mx-auto" />
                                <p>没有找到符合筛选条件的预订记录。</p>
                              </td>
                            </tr>
                          ) : (
                            currentPageBookings.map(booking => {
                              const isLocked = booking.isLocked;
                              const activeEdit = activeEdits.find(e => e.bookingId === booking.id);
                              const isEditing = !!activeEdit;
                              const userColor = isEditing ? getUserColorConfig(activeEdit.userName) : null;

                              return (
                                <tr key={booking.id} className={`group hover:bg-gray-100 transition-colors duration-150 ${isEditing ? `bg-${userColor?.bg.split('-')[1]}-50` : ''}`}>
                                  {/* 操作列居中 */}
                                  <td className={`sticky left-0 z-20 py-1 px-1 border-r border-gray-100 flex gap-1 items-center justify-center h-full transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] ${isEditing ? 'bg-gray-50' : 'bg-gray-50/80 group-hover:bg-gray-100'} align-middle`}>
                                    {isLocked ? (
                                      <>
                                        <div className="p-0.5 bg-amber-50 rounded text-amber-500 flex items-center justify-center" title="已锁定"><Lock className="w-3 h-3"/></div>
                                        {canLockInDatabase(currentUser, activeDbId) && (
                                          <button onClick={() => handleToggleLock(booking)} className="p-0.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors flex items-center justify-center" title="解锁">
                                            <Unlock className="w-3 h-3" />
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {canUpdateInDatabase(currentUser, activeDbId) && (
                                          <button onClick={() => handleEditClick(booking)} disabled={isEditing && activeEdit?.userId !== currentUser.id} className={`p-1 rounded transition-colors flex items-center justify-center ${isEditing && activeEdit?.userId !== currentUser.id ? 'text-gray-300' : 'text-blue-600 hover:bg-blue-100'}`}>
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                        )}

                                        {canDeleteInDatabase(currentUser, activeDbId) && (
                                          <button onClick={() => handleDeleteBooking(booking.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}

                                        {/* 复制按钮 */}
                                        <button onClick={() => handleCopyBookingData(booking)}
                                          className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center justify-center">
                                          <Clipboard className="w-3 h-3" />
                                        </button>

                                        {/* 复制并新建按钮 */}
                                        {canCreateInDatabase(currentUser, activeDbId) && (
                                          <button onClick={() => handleCopyAndCreate(booking)}
                                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors flex items-center justify-center"
                                            title="复制并新建预订">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
                                            </svg>
                                          </button>
                                        )}

                                        {/* 下载邮件附件按钮 - 只在有bookingRef时显示 */}
                                        {booking.bookingRef && (
                                          <button onClick={() => handleDownloadMailAttachments(booking.bookingRef)}
                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center"
                                            title="下载邮件附件">
                                            <Download className="w-3 h-3" />
                                          </button>
                                        )}

                                        {canLockInDatabase(currentUser, activeDbId) && (
                                          <button onClick={() => handleToggleLock(booking)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors flex items-center justify-center" title="锁定">
                                            <Lock className="w-3 h-3" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </td>

                                  {/* 数据列 - 所有字段都居中对齐 */}
                                  {fields.map(field => {
                                    const activeEdit = activeEdits.find(e => e.bookingId === booking.id);
                                    const isDate = isDateField(field.key);
                                    const value = booking[field.key as keyof Booking];
                                    const isEmpty = value === null || value === undefined || value === '';
                                    
                                    return (
                                      <td key={field.key} className={`px-2 py-1 relative text-gray-700 overflow-visible align-middle border-r border-gray-100 ${activeEdit ? 'border-l-2 '+ getUserColorConfig(activeEdit.userName).border : ''}`}>
                                        {activeEdit && field.key === fields[0].key && (
                                          <span className={`absolute -top-1.5 left-2 text-[8px] px-1 py-0 rounded shadow-sm border font-medium ${getUserColorConfig(activeEdit.userName).badge} ${getUserColorConfig(activeEdit.userName).border} ${getUserColorConfig(activeEdit.userName).text} z-30`}>
                                            {activeEdit.userName}
                                          </span>
                                        )}
                                        
                                        <div className="flex items-center justify-center h-full">
                                          {field.key === 'state' ? (
                                            (() => {
                                              const statusColor = getStatusColorConfig(booking.state);
                                              return (
                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase shadow-sm ring-1 ring-inset tracking-wide
                                                  ${statusColor.bg} ${statusColor.text} ${statusColor.ring}`}>
                                                  <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot} mr-1.5`}></span>
                                                  {booking.state || '---'}
                                                </span>
                                              );
                                            })()
                                          ) : field.key === 'week' ? (
                                            booking.week ? (
                                              <span className="text-gray-800 font-medium text-center">{booking.week}</span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px] text-center">---</span>
                                            )
                                          ) : field.key === 'allocation' ? (
                                            booking.allocation ? (
                                              (() => {
                                                const allocationObj = getAllocationWithNote(allocations, booking.allocation);
                                                
                                                if (allocationObj && allocationObj.note) {
                                                  return (
                                                    <div className="flex justify-center">
                                                      <AllocationWithTooltip 
                                                        allocation={allocationObj}
                                                        className="font-medium text-center"
                                                        showIcon={true}
                                                      />
                                                    </div>
                                                  );
                                                } else {
                                                  return (
                                                    <span className="font-medium text-center">{booking.allocation}</span>
                                                  );
                                                }
                                              })()
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px] text-center">---</span>
                                            )
                                          ) : field.key === 'contact' ? (
                                            booking.contact ? (
                                              <span className="font-medium text-blue-600 truncate text-center" title={`Contact: ${booking.contact}`}>
                                                {booking.contact}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px] text-center">---</span>
                                            )
                                          ) : field.key === 'bookingRef' ? (
                                            <div className="text-center">
                                              {booking.bookingRef ? (
                                                <span className="truncate text-gray-900 tabular-nums font-medium text-center">
                                                  {String(booking.bookingRef).trim()}
                                                </span>
                                              ) : (
                                                <span className="text-gray-400 italic text-[10px] text-center">---</span>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="text-center">
                                              {!isEmpty ? (
                                                isDate ? (
                                                  <span className="truncate text-center" title={value as string}>
                                                    {value as string}
                                                  </span>
                                                ) : (
                                                  <span className="truncate text-center">{String(value)}</span>
                                                )
                                              ) : (
                                                <span className="text-gray-400 italic text-[10px] text-center">---</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* 分页控件 - 保持在底部 */}
                    <div className="bg-white border-t border-gray-200 px-3 py-1.5 flex justify-between items-center text-[11px] flex-shrink-0">
                      <div className="text-gray-500">
                        <span className="font-semibold text-gray-900">总计: {pagination.total}</span>
                        <span className="mx-2">•</span>
                        <span className="font-semibold text-gray-900">第 {pagination.page} 页 / 共 {pagination.totalPages} 页</span>
                        <span className="mx-2">•</span>
                        <span className="font-semibold text-gray-900">筛选前: {filterAndSortBookings.length} / {bookings.length}</span>
                        <span className="mx-2">•</span>
                        <span className="font-semibold text-gray-900">本页显示: {currentPageBookings.length} 条</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handlePageChange(pagination.page - 1)} 
                          disabled={!pagination.hasPrev || isLoadingBookings}
                          className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 flex items-center justify-center"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        
                        {/* 显示页码 */}
                        <div className="flex gap-1 mx-1">
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            // 计算显示的页码
                            let pageNum;
                            if (pagination.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.totalPages - 2) {
                              pageNum = pagination.totalPages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`px-2 py-1 rounded text-xs flex items-center justify-center ${pagination.page === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                                disabled={isLoadingBookings}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button 
                          onClick={() => handlePageChange(pagination.page + 1)} 
                          disabled={!pagination.hasNext || isLoadingBookings}
                          className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 flex items-center justify-center"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* 修改：为 BookingModal 添加 allocations 属性 */}
      <BookingModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSave={handleSaveBooking}
        initialData={editingBooking} 
        fields={fields}
        optionsMap={optionsMap}
        allocations={allocations}
        // 变更记录所需的三个参数
        currentUser={currentUser}
        databaseId={activeDb?.id}
        databaseName={activeDb?.name}
      />
      <ColumnManager isOpen={isColManagerOpen} onClose={() => setIsColManagerOpen(false)} fields={fields} onUpdateFields={handleUpdateFields} />
      <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} messages={chatMessages} onSendMessage={handleSendMessage} onlineCount={onlineUsers.length} />
      
      {/* 修改密码模态框 */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => {
          setIsChangePasswordOpen(false);
          setSelectedUserForPasswordReset(null);
        }}
        onChangePassword={passwordModalType === 'self' ? handleChangePassword : handleResetUserPassword}
        isAdmin={passwordModalType === 'admin'}
        targetUserId={selectedUserForPasswordReset?.id}
        targetUsername={selectedUserForPasswordReset?.username}
      />

      {/* Quotation 专用的文件输入 */}
      <input 
        id="quotation-file-input"
        type="file" 
        hidden 
        accept=".csv" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const text = event.target?.result as string;
              const rawRows = parseCSV(text);
              const importedQuotes = processImportedQuotations(rawRows);
              if (importedQuotes.length > 0) {
                if (window.confirm(`Found ${importedQuotes.length} quotations. Append them?`)) {
                  importedQuotes.forEach(q => handleAddQuotation(q));
                }
              } else {
                alert("No valid quotation data found.");
              }
            } catch (err) {
              console.error(err);
              alert("Failed to parse file.");
            }
            if (e.target) e.target.value = '';
          };
          reader.readAsText(file);
        }} 
      />
    </div>
  );
}