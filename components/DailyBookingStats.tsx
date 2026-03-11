import React, { useState, useMemo, useEffect } from 'react';
import { Database, Booking, SystemSettings } from '../types';
import { Button } from './Button';
import { 
  ChevronDown, 
  ChevronUp,
  Calendar,
  RefreshCw,
  Clock,
  Edit,
  AlertCircle,
  Users,
  ArrowRight,
  ChevronsRight,
  MapPin,
  Globe,
  Database as DatabaseIcon,
  History,
  Upload,
  Ship,
  ChevronLeft,
  ChevronRight,
  X,
  WifiOff,
  Loader2,
  Download
} from 'lucide-react';

// 导入日期工具函数
import {
  formatSimpleDate,
  formatDateForDisplay,
  getCurrentDate,
  addDays,
  formatDateForInput,
  parseDateWithoutTimezone
} from '../utils/dateUtils';

// 导入 apiService
import { apiService } from '../services/apiService';

// 获取状态颜色配置
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
    }
  };
  
  return statusConfigs[status] || {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    ring: 'ring-gray-500/10',
    dot: 'bg-gray-500'
  };
};

// 获取变更类型标签 - 精确区分三种变更类型
const getChangeTypeLabel = (record: StatusChangeRecord) => {
  // 判断是否为退舱：CONFIRMED → PENDING
  const isRollback = record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING';
  
  // 判断是否为放舱：PENDING/UNDETERMINED → CONFIRMED
  const isStatusChange = (record.previousStatus === 'PENDING' && record.newStatus === 'CONFIRMED') ||
                         (record.previousStatus === 'UNDETERMINED' && record.newStatus === 'CONFIRMED');
  
  // 判断是否为已确认状态变更：CONFIRMED → CONFIRMED 且有字段变化
  const isConfirmedChange = record.previousStatus === 'CONFIRMED' && record.newStatus === 'CONFIRMED' &&
                           (record.previousPol !== record.newPol || 
                            record.previousPod !== record.newPod || 
                            record.previousClient !== record.newClient ||
                            record.previous_qty !== record.new_qty ||
                            record.previous_type !== record.new_type ||
                            record.previous_allocation !== record.new_allocation);
  
  // 如果是退舱
  if (isRollback) {
    return { 
      label: '退舱', 
      color: 'bg-red-100 text-red-800',
      type: 'rollback',
      changedFields: []
    };
  }
  
  // 如果是放舱
  if (isStatusChange) {
    return { 
      label: '放舱', 
      color: 'bg-green-100 text-green-800',
      type: 'status_change',
      changedFields: []
    };
  }
  
  // 如果是已确认状态变更
  if (isConfirmedChange) {
    return { 
      label: '变更', 
      color: 'bg-blue-100 text-blue-800',
      type: 'confirmed_change',
      changedFields: []
    };
  }
  
  // 其他所有变更类型统一为"变更"
  return { 
    label: '变更', 
    color: 'bg-gray-100 text-gray-800',
    type: 'other',
    changedFields: []
  };
};

// 专门的CSV导出函数 - 简化字段
const exportDailyBookingStatsToCSV = (data: StatusChangeRecord[], filename: string) => {
  if (data.length === 0) {
    alert('没有数据可导出');
    return;
  }

  try {
    // 创建CSV内容 - 只保留核心字段
    const headers = [
      '数据库', 'Week', 'Carrier', 'Service', 'Booking Ref', 'POL', 'POD', 
      'ETD', 'Vessel', 'QTY', 'Type', 'Client', 'Allocation', '状态变更时间',
      '原状态', '新状态', '变更类型', '变更字段'
    ];
    
    const rows = data.map(item => {
      // 获取变更类型标签
      const changeLabel = getChangeTypeLabel(item);
      
      // 判断是否为退舱
      const isRollback = item.previousStatus === 'CONFIRMED' && item.newStatus === 'PENDING';
      
      // 如果是退舱，POL/POD取newPol/newPod，CLIENT取previousClient
      // 如果不是退舱，POL/POD/CLIENT取new值或当前值
      const polValue = isRollback ? 
        (item.newPol || item.pol || '') : 
        (item.newPol || item.pol || '');
      
      const podValue = isRollback ? 
        (item.newPod || item.pod || '') : 
        (item.newPod || item.pod || '');
      
      const clientValue = isRollback ? 
        (item.previousClient || item.client || '') : 
        (item.newClient || item.client || '');
      
      return [
        item.databaseName,
        item.week,
        item.carrier,
        item.service,
        item.bookingRef,
        polValue,
        podValue,
        item.etd,
        item.vessel,
        item.qty,
        item.type,
        clientValue,
        item.allocation || '',
        item.changeTimestamp ? formatSimpleDate(item.changeTimestamp) : '',
        item.previousStatus || '',
        item.newStatus || '',
        changeLabel.label,
        changeLabel.changedFields.join(', ')
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
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 释放URL对象
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error('导出CSV时出错:', error);
    alert('导出失败，请重试');
  }
};

interface DailyBookingStatsProps {
  databases: Database[];
  systemSettings: SystemSettings;
  selectedDate: string;
  onRefreshData?: () => Promise<void>;
  currentUser?: {
    username: string;
    name?: string;
  };
}

interface StatusChangeRecord {
  id: string;
  databaseId: string;
  databaseName: string;
  week: string;
  carrier: string;
  service: string;
  bookingRef: string;
  pol: string;
  pod: string;
  etd: string;
  vessel: string;
  qty: number;
  type: string;
  client: string;
  allocation: string;
  currentStatus: string;
  
  // 变更信息
  changeTimestamp: string;
  previousStatus: string;
  newStatus: string;
  previousPol: string;
  newPol: string;
  previousPod: string;
  newPod: string;
  previousClient: string;
  newClient: string;
  changeType: 'status_change' | 'pol_change' | 'pod_change' | 'client_change' | 'multiple' | 'rollback';
  
  // 新增：QTY 和 TYPE 变更记录
  previous_qty?: number;
  new_qty?: number;
  previous_type?: string;
  new_type?: string;
  previous_allocation?: string;
  new_allocation?: string;
  
  // 数据库原始字段
  change_date?: string;
  bookinger?: string;
  database_id?: string;
  database_name?: string;
  updated_at?: string;
}

// 使用 dateUtils.ts 中的函数进行日期匹配
const isDateSelected = (timestamp: string, selectedDate: string): boolean => {
  if (!timestamp || !selectedDate) return false;
  
  try {
    const timestampDate = formatSimpleDate(timestamp);
    const selectedDateFormatted = formatSimpleDate(selectedDate);
    
    return timestampDate === selectedDateFormatted;
  } catch (error) {
    console.error('日期匹配错误:', error, 'timestamp:', timestamp);
    return false;
  }
};

// 辅助函数：格式化日期显示（仅日期部分）
const formatDateDisplay = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 如果包含时间部分，只提取日期
    if (dateString.includes('T')) {
      const datePart = dateString.split('T')[0];
      return formatDateForDisplay(datePart);
    }
    
    // 如果包含空格，可能是 'YYYY-MM-DD HH:mm:ss' 格式
    if (dateString.includes(' ')) {
      const datePart = dateString.split(' ')[0];
      return formatDateForDisplay(datePart);
    }
    
    // 直接使用 dateUtils 中的函数
    return formatDateForDisplay(dateString);
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateString;
  }
};

// 格式化变更时间（带时间部分）
const formatChangeTimeDisplay = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 如果已经是YYYY-MM-DD格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // 尝试解析日期
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return dateString;
    
    // 格式化为YYYY-MM-DD HH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('变更时间格式化错误:', error);
    return dateString;
  }
};

// 获取昨天日期
const getYesterdayDate = (): string => {
  const today = getCurrentDate();
  return addDays(today, -1);
};

// 修复ETD显示函数
const formatEtdDisplay = (etd: string): string => {
  if (!etd) return '';
  
  try {
    // 如果已经是YYYY-MM-DD格式，直接使用
    if (/^\d{4}-\d{2}-\d{2}$/.test(etd)) {
      return etd;
    }
    
    // 尝试解析其他格式
    return formatDateForInput(etd);
  } catch (error) {
    console.error('ETD格式化错误:', error);
    return etd;
  }
};

export const DailyBookingStats: React.FC<DailyBookingStatsProps> = ({ 
  databases, 
  systemSettings,
  selectedDate,
  onRefreshData,
  currentUser
}) => {
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 状态变更记录数据
  const [dailyChangeRecords, setDailyChangeRecords] = useState<StatusChangeRecord[]>([]);

  // 变更类型过滤器默认为 'all'（所有类型）
  const changeTypeFilter = 'all';

  // 修复：增强数据库记录映射函数 - 确保正确读取所有字段
  const mapDatabaseRecordToStatusChangeRecord = useMemo(() => {
    return (dbRecord: any): StatusChangeRecord => {
      // 关键修复：打印所有可用的字段
      const allFields = Object.keys(dbRecord);
      
      // 修复：确保使用正确的字段名
      // 根据API返回的数据，字段名是驼峰式（camelCase）
      
      // 1. 数据库名称 - 修复：确保正确获取databaseName
      const databaseName = dbRecord.databaseName || dbRecord.database_name || '未知数据库';
      
      // 2. Booking Ref
      const bookingRef = dbRecord.bookingRef || dbRecord.booking_ref || '';
      
      // 3. POL字段 - 修复：使用驼峰式字段名
      const pol = dbRecord.pol || dbRecord.POL || '';
      // 优先使用驼峰式字段名，如果没有则使用蛇形命名
      const newPol = dbRecord.newPol !== undefined ? dbRecord.newPol :
                     (dbRecord.new_pol !== undefined ? dbRecord.new_pol :
                     (dbRecord.NEW_POL !== undefined ? dbRecord.NEW_POL : ''));
      const previousPol = dbRecord.previousPol || dbRecord.previous_pol || dbRecord.PREVIOUS_POL || '';
      
      // 4. POD字段 - 修复：使用驼峰式字段名
      const pod = dbRecord.pod || dbRecord.POD || '';
      const newPod = dbRecord.newPod !== undefined ? dbRecord.newPod :
                      (dbRecord.new_pod !== undefined ? dbRecord.new_pod :
                      (dbRecord.NEW_POD !== undefined ? dbRecord.NEW_POD : ''));
      const previousPod = dbRecord.previousPod || dbRecord.previous_pod || dbRecord.PREVIOUS_POD || '';
      
      // 5. CLIENT字段 - 修复：使用驼峰式字段名
      const client = dbRecord.client || dbRecord.CLIENT || '';
      const newClient = dbRecord.newClient !== undefined ? dbRecord.newClient :
                         (dbRecord.new_client !== undefined ? dbRecord.new_client :
                         (dbRecord.NEW_CLIENT !== undefined ? dbRecord.NEW_CLIENT : ''));
      const previousClient = dbRecord.previousClient || dbRecord.previous_client || dbRecord.PREVIOUS_CLIENT || '';
      
      // 6. 状态字段 - 修复：使用驼峰式字段名
      const previousStatus = dbRecord.previousStatus || dbRecord.previous_status || dbRecord.PREVIOUS_STATUS || '';
      const newStatus = dbRecord.newStatus || dbRecord.new_status || dbRecord.NEW_STATUS || '';
      
      // 7. 变更类型 - 修复：使用驼峰式字段名
      let changeType = dbRecord.changeType || dbRecord.change_type || 'status_change';
      
      // 如果change_type为空，根据状态变化和字段变更推断
      if (!changeType || changeType === 'status_change') {
        // 放舱逻辑：PENDING→CONFIRMED 或 UNDETERMINED→CONFIRMED
        if ((previousStatus === 'PENDING' && newStatus === 'CONFIRMED') ||
            (previousStatus === 'UNDETERMINED' && newStatus === 'CONFIRMED')) {
          changeType = 'status_change'; // 放舱
        } else if (previousStatus === 'CONFIRMED' && newStatus === 'PENDING') {
          changeType = 'rollback'; // 退舱
        } else if (previousStatus === 'CONFIRMED' && newStatus === 'CONFIRMED') {
          // 检查是否有字段变更
          const hasPolChange = previousPol && newPol && previousPol !== newPol;
          const hasPodChange = previousPod && newPod && previousPod !== newPod;
          const hasClientChange = previousClient && newClient && previousClient !== newClient;
          const hasQtyChange = dbRecord.previous_qty !== undefined && dbRecord.new_qty !== undefined && 
                              dbRecord.previous_qty !== dbRecord.new_qty;
          const hasTypeChange = dbRecord.previous_type && dbRecord.new_type && 
                               dbRecord.previous_type !== dbRecord.new_type;
          const hasAllocationChange = dbRecord.previous_allocation && dbRecord.new_allocation && 
                                     dbRecord.previous_allocation !== dbRecord.new_allocation;
          
          const changeCount = [hasPolChange, hasPodChange, hasClientChange, hasQtyChange, hasTypeChange, hasAllocationChange]
            .filter(Boolean).length;
          
          if (changeCount > 0) {
            if (changeCount === 1) {
              if (hasPolChange) changeType = 'pol_change';
              else if (hasPodChange) changeType = 'pod_change';
              else if (hasClientChange) changeType = 'client_change';
              else changeType = 'multiple'; // 其他单个变更也归为multiple
            } else {
              changeType = 'multiple'; // 多个字段变更
            }
          }
        }
      }
      
      // 8. 变更时间 - 优先使用changeTimestamp
      const changeTimestamp = dbRecord.changeTimestamp || 
                            dbRecord.change_timestamp || 
                            dbRecord.updated_at || 
                            dbRecord.change_date || 
                            new Date().toISOString();
      
      // 9. QTY字段 - 修复：使用驼峰式字段名
      const qty = Number(dbRecord.qty) || 0;
      const previous_qty = dbRecord.previousQty !== undefined ? Number(dbRecord.previousQty) : 
                          (dbRecord.previous_qty !== undefined ? Number(dbRecord.previous_qty) : undefined);
      const new_qty = dbRecord.newQty !== undefined ? Number(dbRecord.newQty) : 
                     (dbRecord.new_qty !== undefined ? Number(dbRecord.new_qty) : undefined);
      
      // 10. TYPE字段 - 修复：使用驼峰式字段名
      const type = dbRecord.type || '';
      const previous_type = dbRecord.previousType || dbRecord.previous_type;
      const new_type = dbRecord.newType || dbRecord.new_type;
      
      // 11. ALLOCATION字段 - 修复：使用驼峰式字段名
      const allocation = dbRecord.allocation || '';
      const previous_allocation = dbRecord.previousAllocation || dbRecord.previous_allocation;
      const new_allocation = dbRecord.newAllocation || dbRecord.new_allocation;
      
      // 12. VESSEL字段 - 新增：从数据库记录中读取vessel字段
      const vessel = dbRecord.vessel || '';
      
      return {
        id: dbRecord.id || `record_${Date.now()}_${Math.random()}`,
        databaseId: dbRecord.databaseId || dbRecord.database_id || '',
        databaseName: databaseName,
        week: dbRecord.week || '',
        carrier: dbRecord.carrier || '',
        service: dbRecord.service || '',
        bookingRef: bookingRef,
        pol: pol,
        pod: pod,
        etd: dbRecord.etd || '',
        vessel: vessel,
        qty: qty,
        type: type,
        client: client,
        allocation: allocation,
        currentStatus: newStatus || '',
        
        // 变更信息
        changeTimestamp: changeTimestamp,
        previousStatus: previousStatus,
        newStatus: newStatus,
        previousPol: previousPol,
        newPol: newPol,
        previousPod: previousPod,
        newPod: newPod,
        previousClient: previousClient,
        newClient: newClient,
        changeType: changeType as any,
        
        // 新增：QTY和TYPE变更记录
        previous_qty: previous_qty,
        new_qty: new_qty,
        previous_type: previous_type,
        new_type: new_type,
        previous_allocation: previous_allocation,
        new_allocation: new_allocation,
        
        // 保留原始数据库字段
        change_date: dbRecord.changeDate || dbRecord.change_date,
        bookinger: dbRecord.bookinger,
        database_id: dbRecord.databaseId || dbRecord.database_id,
        database_name: dbRecord.databaseName || dbRecord.database_name,
        updated_at: dbRecord.changeTimestamp || dbRecord.updated_at
      };
    };
  }, []);

  // 获取当日状态变更记录
  useEffect(() => {
    const fetchChangeRecords = async () => {
      if (!selectedDate) return;
      
      console.log('📋 获取变更记录，日期:', selectedDate);
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await apiService.getBookingChangeRecords(selectedDate);
        
        if (response.success && response.records) {
          const allRecords: StatusChangeRecord[] = response.records.map(mapDatabaseRecordToStatusChangeRecord);
          
          // 按Booking Ref分组，只保留每个Booking的最新记录
          const bookingGroups: Record<string, StatusChangeRecord[]> = {};
          
          allRecords.forEach(record => {
            const bookingRef = record.bookingRef;
            if (!bookingRef) return;
            
            if (!bookingGroups[bookingRef]) {
              bookingGroups[bookingRef] = [];
            }
            bookingGroups[bookingRef].push(record);
          });
          
          // 对每个Booking的记录按时间排序，取最新的
          const latestRecords: StatusChangeRecord[] = [];
          
          Object.values(bookingGroups).forEach(records => {
            if (records.length === 0) return;
            
            // 按changeTimestamp倒序排序，取最新的记录
            const sortedRecords = records.sort((a, b) => {
              const timeA = new Date(a.changeTimestamp).getTime();
              const timeB = new Date(b.changeTimestamp).getTime();
              return timeB - timeA;
            });
            
            const latestRecord = sortedRecords[0];
            
            // 如果是CONFIRMED状态下的POL/POD/CLIENT变更，需要检查是否有实际变更
            if (latestRecord.previousStatus === 'CONFIRMED' && latestRecord.newStatus === 'CONFIRMED') {
              // 检查是否有POL/POD/CLIENT变更
              const hasPolChange = latestRecord.previousPol && latestRecord.newPol && 
                                  latestRecord.previousPol !== latestRecord.newPol;
              const hasPodChange = latestRecord.previousPod && latestRecord.newPod && 
                                  latestRecord.previousPod !== latestRecord.newPod;
              const hasClientChange = latestRecord.previousClient && latestRecord.newClient && 
                                     latestRecord.previousClient !== latestRecord.newClient;
              const hasQtyChange = latestRecord.previous_qty !== undefined && latestRecord.new_qty !== undefined &&
                                  latestRecord.previous_qty !== latestRecord.new_qty;
              const hasTypeChange = latestRecord.previous_type !== undefined && latestRecord.new_type !== undefined &&
                                   latestRecord.previous_type !== latestRecord.new_type;
              const hasAllocationChange = latestRecord.previous_allocation !== undefined && latestRecord.new_allocation !== undefined &&
                                         latestRecord.previous_allocation !== latestRecord.new_allocation;
              
              // 如果有POL/POD/CLIENT/QTY/TYPE/ALLOCATION变更，才保留这条记录
              if (hasPolChange || hasPodChange || hasClientChange || hasQtyChange || hasTypeChange || hasAllocationChange) {
                latestRecords.push(latestRecord);
              }
            } else {
              // 其他变更类型都保留
              latestRecords.push(latestRecord);
            }
          });
          
          setDailyChangeRecords(latestRecords);
        } else {
          console.log('⚠️ 没有变更记录数据');
          setDailyChangeRecords([]);
        }
      } catch (error) {
        console.error('❌ 获取变更记录失败:', error);
        setError('获取变更记录失败: ' + (error as Error).message);
        
        // 使用测试数据
        const testRecords: StatusChangeRecord[] = [
          {
            id: 'test-1',
            databaseId: 'db-1',
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
            changeType: 'status_change',
            previous_qty: 0,
            new_qty: 5,
            previous_type: '',
            new_type: '40HQ',
            previous_allocation: '',
            new_allocation: ''
          },
          {
            id: 'test-2',
            databaseId: 'db-1',
            databaseName: 'MAERSK-HEMU-US',
            week: '2026 WK05',
            carrier: 'MAERSK',
            service: 'USWC',
            bookingRef: '263837134',
            pol: 'NINGBO',
            pod: 'SAVANNAH',
            etd: '2026-01-31',
            vessel: 'CCNI ARAUCO / 60.4E',
            qty: 5,
            type: '40HQ',
            client: 'baad',
            allocation: '',
            currentStatus: 'CONFIRMED',
            changeTimestamp: '2026-01-06 19:07:00',
            previousStatus: 'PENDING',
            newStatus: 'CONFIRMED',
            previousPol: '',
            newPol: 'NINGBO',
            previousPod: 'SAVANNAH',
            newPod: 'SAVANNAH',
            previousClient: '未分配',
            newClient: 'baad',
            changeType: 'status_change',
            previous_qty: 0,
            new_qty: 5,
            previous_type: '',
            new_type: '40HQ',
            previous_allocation: '',
            new_allocation: ''
          },
          {
            id: 'test-3',
            databaseId: 'db-1',
            databaseName: 'MAERSK-HEMU-US',
            week: '2026 WK05',
            carrier: 'MAERSK',
            service: 'USWC',
            bookingRef: '263837999',
            pol: 'SHANGHAI',
            pod: 'ROTTERDAM',
            etd: '2026-01-28',
            vessel: 'MAERSK EMDEN / 60.1E',
            qty: 3,
            type: '40GP',
            client: '深孚',
            allocation: '',
            currentStatus: 'PENDING',
            changeTimestamp: '2026-01-06 15:18:06',
            previousStatus: 'CONFIRMED',
            newStatus: 'PENDING',
            previousPol: 'SHANGHAI',
            newPol: 'SHANGHAI',
            previousPod: 'ROTTERDAM',
            newPod: 'ROTTERDAM',
            previousClient: '深孚',
            newClient: '未分配',
            changeType: 'rollback',
            previous_qty: 3,
            new_qty: 3,
            previous_type: '40GP',
            new_type: '40GP',
            previous_allocation: '',
            new_allocation: ''
          },
          {
            id: 'test-4',
            databaseId: 'db-1',
            databaseName: 'MAERSK-HEMU-US',
            week: '2026 WK05',
            carrier: 'MAERSK',
            service: 'USWC',
            bookingRef: '263838000',
            pol: 'SHANGHAI',
            pod: 'LONG BEACH',
            etd: '2026-01-30',
            vessel: 'MAERSK EVORA / 60.3E',
            qty: 2,
            type: '20GP',
            client: '客户A',
            allocation: '分配A',
            currentStatus: 'CONFIRMED',
            changeTimestamp: '2026-01-06 14:20:30',
            previousStatus: 'CONFIRMED',
            newStatus: 'CONFIRMED',
            previousPol: 'SHANGHAI',
            newPol: 'NINGBO',
            previousPod: 'LONG BEACH',
            newPod: 'LONG BEACH',
            previousClient: '客户A',
            newClient: '客户B',
            changeType: 'multiple',
            previous_qty: 2,
            new_qty: 3,
            previous_type: '20GP',
            new_type: '40HQ',
            previous_allocation: '分配A',
            new_allocation: '分配B'
          },
          {
            id: 'test-5',
            databaseId: 'db-1',
            databaseName: 'MAERSK-HEMU-US',
            week: '2026 WK05',
            carrier: 'MAERSK',
            service: 'USWC',
            bookingRef: '263838001',
            pol: 'SHANGHAI',
            pod: 'LOS ANGELES',
            etd: '2026-01-27',
            vessel: 'MAERSK EUREKA / 60.2E',
            qty: 4,
            type: '40HQ',
            client: '未分配',
            allocation: '',
            currentStatus: 'CONFIRMED',
            changeTimestamp: '2026-01-06 11:30:45',
            previousStatus: 'UNDETERMINED',
            newStatus: 'CONFIRMED',
            previousPol: 'SHANGHAI',
            newPol: 'SHANGHAI',
            previousPod: 'LOS ANGELES',
            newPod: 'LOS ANGELES',
            previousClient: '未分配',
            newClient: '客户C',
            changeType: 'status_change',
            previous_qty: 0,
            new_qty: 4,
            previous_type: '',
            new_type: '40HQ',
            previous_allocation: '',
            new_allocation: ''
          }
        ];
        
        setDailyChangeRecords(testRecords);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChangeRecords();
  }, [selectedDate, refreshKey, mapDatabaseRecordToStatusChangeRecord]);

  // 手动刷新数据
  const handleRefresh = async () => {
    console.log('🔄 手动刷新数据');
    
    if (onRefreshData) {
      try {
        console.log('🔄 调用外部刷新函数...');
        await onRefreshData();
      } catch (error) {
        console.error('刷新数据失败:', error);
      }
    }
    
    setRefreshKey(prev => prev + 1);
  };

  // 修复：按数据库分组 - 使用databaseName作为分组键
  const changesByDatabase = useMemo(() => {
    const groups: Record<string, StatusChangeRecord[]> = {};
    
    dailyChangeRecords.forEach(record => {
      // 使用databaseName作为分组键，确保不同数据库分开显示
      const dbKey = record.databaseName || record.database_name || 'unknown';
      if (!groups[dbKey]) {
        groups[dbKey] = [];
      }
      groups[dbKey].push(record);
    });
    
    return groups;
  }, [dailyChangeRecords]);

  // 获取数据库统计信息 - 修复：使用databaseName而不是databaseId
  const databaseStats = useMemo(() => {
    const stats: Array<{
      databaseKey: string;
      databaseName: string;
      changeCount: number;
      statusChanges: number;
      rollbackChanges: number;
      confirmedChanges: number;
      totalQty: number;
      carriers: string[];
      clients: string[];
    }> = [];
    
    Object.entries(changesByDatabase).forEach(([dbKey, records]) => {
      if (records.length > 0) {
        // 分别计算三种变更类型
        const trueStatusChanges = records.filter(r => 
          (r.previousStatus === 'PENDING' && r.newStatus === 'CONFIRMED') ||
          (r.previousStatus === 'UNDETERMINED' && r.newStatus === 'CONFIRMED')
        );
        
        const rollbackChanges = records.filter(r => 
          r.previousStatus === 'CONFIRMED' && r.newStatus === 'PENDING'
        );
        
        const confirmedChanges = records.filter(r => 
          r.previousStatus === 'CONFIRMED' && 
          r.newStatus === 'CONFIRMED' &&
          (r.previousPol !== r.newPol || 
           r.previousPod !== r.newPod || 
           r.previousClient !== r.newClient ||
           r.previous_qty !== r.new_qty ||
           r.previous_type !== r.new_type ||
           r.previous_allocation !== r.new_allocation)
        );
        
        // 合并所有有效的记录
        const validRecords = [...trueStatusChanges, ...rollbackChanges, ...confirmedChanges];
        
        if (validRecords.length === 0) return;
        
        const databaseName = validRecords[0].databaseName || 
                           validRecords[0].database_name || 
                           '未知数据库';
        const totalQty = validRecords.reduce((sum, record) => sum + (record.qty || 0), 0);
        const carriers = [...new Set(validRecords.map(r => r.carrier).filter(Boolean))];
        const clients = [...new Set(validRecords.map(r => {
          // 判断是否为退舱
          const isRollback = r.previousStatus === 'CONFIRMED' && r.newStatus === 'PENDING';
          
          // 如果是退舱，取previousClient；否则取newClient或client
          return isRollback ? 
            (r.previousClient || r.client || '') : 
            (r.newClient || r.client || '');
        }).filter(Boolean))];
        
        stats.push({
          databaseKey: dbKey,
          databaseName,
          changeCount: validRecords.length,
          statusChanges: trueStatusChanges.length,
          rollbackChanges: rollbackChanges.length,
          confirmedChanges: confirmedChanges.length,
          totalQty,
          carriers,
          clients
        });
      }
    });
    
    return stats.sort((a, b) => b.changeCount - a.changeCount);
  }, [changesByDatabase]);

  // 统计变更类型 - 精确区分三种变更类型
  const changeTypeStats = useMemo(() => {
    // 真正的放舱：PENDING → CONFIRMED 和 UNDETERMINED → CONFIRMED
    const trueStatusChangeRecords = dailyChangeRecords.filter(record => 
      (record.previousStatus === 'PENDING' && record.newStatus === 'CONFIRMED') ||
      (record.previousStatus === 'UNDETERMINED' && record.newStatus === 'CONFIRMED')
    );
    
    // 退舱：CONFIRMED → PENDING
    const rollbackRecords = dailyChangeRecords.filter(r => 
      r.previousStatus === 'CONFIRMED' && r.newStatus === 'PENDING'
    );
    
    // 已确认状态变更：CONFIRMED → CONFIRMED 且有字段变化
    const confirmedChangeRecords = dailyChangeRecords.filter(record => 
      record.previousStatus === 'CONFIRMED' && 
      record.newStatus === 'CONFIRMED' &&
      (record.previousPol !== record.newPol || 
       record.previousPod !== record.newPod || 
       record.previousClient !== record.newClient ||
       record.previous_qty !== record.new_qty ||
       record.previous_type !== record.new_type ||
       record.previous_allocation !== record.new_allocation)
    );
    
    const stats = {
      total: dailyChangeRecords.length,
      trueStatusChange: trueStatusChangeRecords.length,
      rollback: rollbackRecords.length,
      confirmedChange: confirmedChangeRecords.length,
    };
    
    return stats;
  }, [dailyChangeRecords]);

  // 过滤记录 - 移除搜索过滤，只保留变更类型过滤
  const filteredRecords = useMemo(() => {
    let filtered = [...dailyChangeRecords];
    
    // 按变更类型过滤
    if (changeTypeFilter !== 'all') {
      if (changeTypeFilter === 'status_change') {
        // 真正的放舱：PENDING/UNDETERMINED → CONFIRMED
        filtered = filtered.filter(record => 
          (record.previousStatus === 'PENDING' && record.newStatus === 'CONFIRMED') ||
          (record.previousStatus === 'UNDETERMINED' && record.newStatus === 'CONFIRMED')
        );
      } else if (changeTypeFilter === 'rollback') {
        // 退舱：CONFIRMED → PENDING
        filtered = filtered.filter(record => 
          record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING'
        );
      } else if (changeTypeFilter === 'confirmed_change') {
        // 已确认状态变更：CONFIRMED → CONFIRMED 且有字段变化
        filtered = filtered.filter(record => 
          record.previousStatus === 'CONFIRMED' && 
          record.newStatus === 'CONFIRMED' &&
          (record.previousPol !== record.newPol || 
           record.previousPod !== record.newPod || 
           record.previousClient !== record.newClient ||
           record.previous_qty !== record.new_qty ||
           record.previous_type !== record.new_type ||
           record.previous_allocation !== record.new_allocation)
        );
      }
    } else {
      // 默认显示所有变更类型：放舱、退舱、已确认状态变更
      filtered = filtered.filter(record => {
        // 真正的放舱：PENDING/UNDETERMINED → CONFIRMED
        const isTrueStatusChange = (record.previousStatus === 'PENDING' && record.newStatus === 'CONFIRMED') ||
                                   (record.previousStatus === 'UNDETERMINED' && record.newStatus === 'CONFIRMED');
        
        // 退舱：CONFIRMED → PENDING
        const isRollback = record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING';
        
        // 已确认状态变更：CONFIRMED → CONFIRMED 且有字段变化
        const isConfirmedChange = record.previousStatus === 'CONFIRMED' && 
                                  record.newStatus === 'CONFIRMED' &&
                                  (record.previousPol !== record.newPol || 
                                   record.previousPod !== record.newPod || 
                                   record.previousClient !== record.newClient ||
                                   record.previous_qty !== record.new_qty ||
                                   record.previous_type !== record.new_type ||
                                   record.previous_allocation !== record.new_allocation);
        
        return isTrueStatusChange || isRollback || isConfirmedChange;
      });
    }
    
    return filtered;
  }, [dailyChangeRecords, changeTypeFilter]);

  // 切换数据库展开状态
  const toggleDatabase = (databaseKey: string) => {
    setExpandedDatabases(prev => ({
      ...prev,
      [databaseKey]: !prev[databaseKey]
    }));
  };

  // 检查记录是否有变更
  const hasPolChange = (record: StatusChangeRecord): boolean => {
    return !!record.previousPol && !!record.newPol && record.previousPol !== record.newPol;
  };
  
  const hasPodChange = (record: StatusChangeRecord): boolean => {
    return !!record.previousPod && !!record.newPod && record.previousPod !== record.newPod;
  };
  
  const hasClientChange = (record: StatusChangeRecord): boolean => {
    return !!record.previousClient && !!record.newClient && record.previousClient !== record.newClient;
  };
  
  const hasQtyChange = (record: StatusChangeRecord): boolean => {
    return record.previous_qty !== undefined && 
           record.new_qty !== undefined && 
           record.previous_qty !== record.new_qty;
  };
  
  const hasTypeChange = (record: StatusChangeRecord): boolean => {
    return record.previous_type !== undefined && 
           record.new_type !== undefined && 
           record.previous_type !== record.new_type;
  };
  
  const hasAllocationChange = (record: StatusChangeRecord): boolean => {
    return record.previous_allocation !== undefined && 
           record.new_allocation !== undefined && 
           record.previous_allocation !== record.new_allocation;
  };
  
  const hasStatusChange = (record: StatusChangeRecord): boolean => {
    return !!record.previousStatus && !!record.newStatus && record.previousStatus !== record.newStatus;
  };

  // 获取字段显示值（退舱特殊处理）
  const getFieldDisplayValue = (record: StatusChangeRecord, field: 'pol' | 'pod' | 'client'): string => {
    // 判断是否为退舱
    const isRollback = record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING';
    
    if (field === 'pol') {
      // 退舱时显示newPol，非退舱时显示newPol或pol
      return isRollback ? 
        (record.newPol || record.pol || '-') : 
        (record.newPol || record.pol || '-');
    } else if (field === 'pod') {
      // 退舱时显示newPod，非退舱时显示newPod或pod
      return isRollback ? 
        (record.newPod || record.pod || '-') : 
        (record.newPod || record.pod || '-');
    } else if (field === 'client') {
      // 退舱时显示previousClient，非退舱时显示newClient或client
      return isRollback ? 
        (record.previousClient || record.client || '-') : 
        (record.newClient || record.client || '-');
    }
    
    return '-';
  };

  // 获取字段变更显示
  const getFieldChangeDisplay = (record: StatusChangeRecord, field: 'pol' | 'pod' | 'client') => {
    // 判断是否为退舱
    const isRollback = record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING';
    
    if (field === 'pol') {
      // 检查是否有POL变更
      const hasChange = hasPolChange(record);
      
      return {
        hasChange,
        display: hasChange ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-500" />
              <span className="text-[10px]">
                <span className="text-red-600 line-through">
                  {record.previousPol || '未知'}
                </span>
                <ArrowRight className="w-2 h-2 mx-1 inline text-gray-400" />
                <span className="text-green-600 font-medium">
                  {record.newPol || '-'}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-blue-500" />
            <span className="text-gray-700">
              {getFieldDisplayValue(record, 'pol')}
            </span>
          </div>
        )
      };
    } else if (field === 'pod') {
      // 检查是否有POD变更
      const hasChange = hasPodChange(record);
      
      return {
        hasChange,
        display: hasChange ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-indigo-500" />
              <span className="text-[10px]">
                <span className="text-red-600 line-through">
                  {record.previousPod || '未知'}
                </span>
                <ArrowRight className="w-2 h-2 mx-1 inline text-gray-400" />
                <span className="text-green-600 font-medium">
                  {record.newPod || '-'}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-indigo-500" />
            <span className="text-gray-700">
              {getFieldDisplayValue(record, 'pod')}
            </span>
          </div>
        )
      };
    } else if (field === 'client') {
      // 检查是否有CLIENT变更
      const hasChange = hasClientChange(record);
      
      return {
        hasChange,
        display: hasChange ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-purple-500" />
              <span className="text-[10px]">
                <span className="text-red-600 line-through">
                  {isRollback ? record.newClient || '未知' : record.previousClient || '未知'}
                </span>
                <ArrowRight className="w-2 h-2 mx-1 inline text-gray-400" />
                <span className="text-green-600 font-medium">
                  {isRollback ? record.previousClient || '-' : record.newClient || '-'}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-purple-500" />
            <span className="text-gray-700">
              {getFieldDisplayValue(record, 'client')}
            </span>
          </div>
        )
      };
    }
    
    return { hasChange: false, display: <div>-</div> };
  };

  // 导出数据函数（供父组件调用）
  const handleExportData = () => {
    exportDailyBookingStatsToCSV(filteredRecords, `放舱统计_${selectedDate}`);
  };

  return (
    <div className="space-y-0 h-full flex flex-col">
      {/* 内容区域 */}
      <div className="p-4 flex-grow overflow-auto">
        {/* 加载状态和错误提示 */}
        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mr-2" />
              <span className="text-blue-700">正在加载变更记录...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-800">加载失败</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button
                  onClick={handleRefresh}
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 统计概览 - 精确区分三种变更类型 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">总变更数</p>
                <p className="text-2xl font-bold text-gray-900">{changeTypeStats.total}</p>
              </div>
              <Edit className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">放舱</p>
                <p className="text-2xl font-bold text-green-600">
                  {changeTypeStats.trueStatusChange}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">退舱</p>
                <p className="text-2xl font-bold text-red-600">
                  {changeTypeStats.rollback}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">变更</p>
                <p className="text-2xl font-bold text-blue-600">
                  {changeTypeStats.confirmedChange}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* 数据库分组统计 - 使用选项卡样式 */}
        <div className="space-y-4">
          {/* 选项卡导航栏 - 添加水平滚动支持 */}
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex space-x-2 min-w-max" aria-label="Tabs">
              {databaseStats.map((stat, index) => (
                <button
                  key={stat.databaseKey}
                  onClick={() => toggleDatabase(stat.databaseKey)}
                  className={`
                    relative inline-flex items-center px-3 py-1.5 text-xs font-medium whitespace-nowrap
                    ${expandedDatabases[stat.databaseKey] 
                      ? 'bg-white border-t border-l border-r border-gray-300 text-gray-700 rounded-t-lg' 
                      : 'border-b border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    group
                  `}
                >
                  <span className="flex items-center">
                    <DatabaseIcon className="w-3.5 h-3.5 mr-1.5" />
                    {stat.databaseName}
                  </span>
                  {/* 统计信息徽章 */}
                  <span className={`
                    ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium
                    ${expandedDatabases[stat.databaseKey] 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                    }
                  `}>
                    {stat.changeCount}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* 选项卡内容区域 */}
          {databaseStats.map(stat => {
            if (!expandedDatabases[stat.databaseKey]) return null;
            
            return (
              <div key={stat.databaseKey} className="bg-white border border-gray-300 rounded-b-lg rounded-tr-lg shadow-sm flex flex-col">
                {/* 内容区域顶部标题栏 */}
                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
                  <div className="flex items-center justify-between">
                    {/* 统计信息 */}
                    <div className="flex space-x-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">变更总数:</span>
                        <span className="text-xs font-semibold">{stat.changeCount}</span>
                      </div>
                      {stat.statusChanges > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-green-600">放舱:</span>
                          <span className="text-xs font-semibold text-green-600">{stat.statusChanges}</span>
                        </div>
                      )}
                      {stat.rollbackChanges > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-red-600">退舱:</span>
                          <span className="text-xs font-semibold text-red-600">{stat.rollbackChanges}</span>
                        </div>
                      )}
                      {stat.confirmedChanges > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-blue-600">变更:</span>
                          <span className="text-xs font-semibold text-blue-600">{stat.confirmedChanges}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">总箱量:</span>
                        <span className="text-xs font-semibold">{stat.totalQty}</span>
                      </div>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const dbRecords = changesByDatabase[stat.databaseKey] || [];
                          exportDailyBookingStatsToCSV(dbRecords, `${stat.databaseName}_${selectedDate}`);
                        }}
                        className="h-8 text-xs px-3"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        导出
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleDatabase(stat.databaseKey)}
                        className="h-8 text-xs px-3"
                      >
                        折叠
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* 变更详情表格 - 修复：添加flex-grow和overflow-auto */}
                <div className="p-4 flex-grow overflow-auto">
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full min-w-[1400px]">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                          <th className="px-3 py-2">变更类型</th>
                          <th className="px-3 py-2 w-32">Booking Ref</th>
                          <th className="px-3 py-2">Carrier</th>
                          <th className="px-3 py-2">POL</th>
                          <th className="px-3 py-2">POD</th>
                          <th className="px-3 py-2">CLIENT</th>
                          <th className="px-3 py-2">ETD</th>
                          <th className="px-3 py-2">VESSEL</th>
                          <th className="px-3 py-2">QTY</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Allocation</th>
                          <th className="px-3 py-2">状态变更</th>
                          <th className="px-3 py-2">变更时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {changesByDatabase[stat.databaseKey]
                          ?.filter(record => 
                            filteredRecords.some(fr => fr.id === record.id)
                          )
                          .sort((a, b) => {
                            const timeA = a.changeTimestamp ? new Date(a.changeTimestamp).getTime() : 0;
                            const timeB = b.changeTimestamp ? new Date(b.changeTimestamp).getTime() : 0;
                            return timeA - timeB;
                          })
                          .map(record => {
                            const changeType = getChangeTypeLabel(record);
                            const statusChanged = hasStatusChange(record);
                            const isRollback = record.previousStatus === 'CONFIRMED' && record.newStatus === 'PENDING';
                            const polDisplay = getFieldChangeDisplay(record, 'pol');
                            const podDisplay = getFieldChangeDisplay(record, 'pod');
                            const clientDisplay = getFieldChangeDisplay(record, 'client');
                            const hasQtyChange = record.previous_qty !== undefined && record.new_qty !== undefined && 
                                                record.previous_qty !== record.new_qty;
                            const hasTypeChange = record.previous_type !== undefined && record.new_type !== undefined && 
                                                record.previous_type !== record.new_type;
                            const hasAllocationChange = record.previous_allocation !== undefined && record.new_allocation !== undefined && 
                                                      record.previous_allocation !== record.new_allocation;
                            
                            return (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-3 py-1.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${changeType.color}`}>
                                      {changeType.label}
                                    </span>
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5 w-32">
                                  <div className="font-medium text-blue-600 text-[12px] font-bold font-mono tracking-tight">
                                    {record.bookingRef || '-'}
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="font-medium text-[10px]">{record.carrier || '-'}</div>
                                  <div className="text-gray-500 text-[10px]">{record.service || ''}</div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-[10px]">
                                    {polDisplay.display}
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-[10px]">
                                    {podDisplay.display}
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-[10px]">
                                    {clientDisplay.display}
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-[11px]">{formatEtdDisplay(record.etd)}</div>
                                  <div className="text-gray-500 text-[10px]">{record.week || ''}</div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-0.5 text-[10px]">
                                    {record.vessel && <Ship className="w-2.5 h-2.5 text-gray-400" />}
                                    <span>{record.vessel || '-'}</span>
                                  </div>
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-[10px]">{record.qty || 0}</div>
                                  {hasQtyChange && (
                                    <div className="text-blue-600 text-[10px] mt-0">
                                      {record.previous_qty} → {record.new_qty}
                                    </div>
                                  )}
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-gray-700 text-[10px]">{record.type || '-'}</div>
                                  {hasTypeChange && (
                                    <div className="text-blue-600 text-[10px] mt-0">
                                      {record.previous_type || '-'} → {record.new_type || '-'}
                                    </div>
                                  )}
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="text-gray-700 text-[10px]">{record.allocation || '-'}</div>
                                  {hasAllocationChange && (
                                    <div className="text-blue-600 text-[10px] mt-0">
                                      {record.previous_allocation || '-'} → {record.new_allocation || '-'}
                                    </div>
                                  )}
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  {statusChanged || record.previousStatus === 'CONFIRMED' ? (
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-0.5">
                                        <span className="text-red-600 line-through text-[10px]">
                                          {record.previousStatus}
                                        </span>
                                        <ChevronsRight className="w-2 h-2 text-gray-400" />
                                        <span className={`text-[10px] font-medium ${
                                          isRollback ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                          {record.newStatus}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-gray-500 text-[10px]">-</div>
                                  )}
                                </td>
                                
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center text-gray-600 text-[11px]">
                                    <Clock className="w-2 h-2 mr-0.5" />
                                    {record.changeTimestamp ? formatChangeTimeDisplay(record.changeTimestamp) : '-'}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
          
          {databaseStats.length === 0 && !isLoading && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Edit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">当日无变更数据</h3>
              <p className="text-gray-500">
                选择其他日期查看统计数据。如果刚刚更新了预订状态，请点击"刷新"按钮重新加载数据。
              </p>
            </div>
          )}
        </div>

        {/* 调试信息 - 可选显示 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm mb-2">调试信息</h4>
            <Button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              variant="secondary"
              size="sm"
            >
              {showDebugInfo ? '隐藏' : '显示'}
            </Button>
          </div>
          {showDebugInfo && (
            <div className="text-xs space-y-1">
              <div>总记录数: {dailyChangeRecords.length}</div>
              <div>数据库分组数: {Object.keys(changesByDatabase).length}</div>
              <div>变更类型统计: {JSON.stringify(changeTypeStats)}</div>
              {Object.entries(changesByDatabase).map(([dbKey, records]) => (
                <div key={dbKey} className="ml-2">
                  数据库: {dbKey} - 记录数: {records.length}
                  {records.slice(0, 2).map((record, idx) => (
                    <div key={idx} className="ml-4">
                      {record.bookingRef}: {record.changeType} ({record.previousStatus}→{record.newStatus})
                      <div>POL: {record.pol} (前: {record.previousPol}, 新: {record.newPol})</div>
                      <div>POD: {record.pod} (前: {record.previousPod}, 新: {record.newPod})</div>
                      <div>CLIENT: {record.client} (前: {record.previousClient}, 新: {record.newClient})</div>
                      <div>QTY: {record.qty} (前: {record.previous_qty}, 新: {record.new_qty})</div>
                      <div>TYPE: {record.type} (前: {record.previous_type}, 新: {record.new_type})</div>
                      <div>ALLOCATION: {record.allocation} (前: {record.previous_allocation}, 新: {record.new_allocation})</div>
                      {record.vessel && `, VESSEL: ${record.vessel}`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};