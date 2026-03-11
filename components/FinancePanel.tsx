import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Booking, FinanceData, FieldDefinition, FilterCondition, GateInRate } from '../types';
import { FinanceOverview } from './FinanceOverview';
import { Button } from './Button';
import { AdvancedFilter } from './AdvancedFilter';
import { 
  Search, Download, Lock, Unlock, DollarSign, Calendar, ChevronDown, ChevronUp, 
  GripHorizontal, Eye, EyeOff, Filter, ChevronLeft, ChevronRight, Check, FileText 
} from 'lucide-react';
// import { SystemSettings } from '../services/storageService';
import { SystemSettings } from '../types';
import { exportToCSV } from '../utils/exportUtils';
import { formatDateForDisplay, formatDateWithoutTimezone, parseDateWithoutTimezone } from '../utils/dateUtils';

export type FinanceVariant = 'MY_FINANCE' | 'SAF_FINANCE' | 'CMA_FINANCE' | 'CONCORD_FINANCE';

interface FinancePanelProps {
  databases: Array<{ id: string; name: string; bookings: Booking[] }>;
  onUpdateBooking: (dbId: string, booking: Booking) => void;
  canUpdate: boolean;
  canLock: boolean;
  systemSettings?: SystemSettings;
  variant: FinanceVariant;
  // 新增来自父组件的props
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  selectedMonth?: string;
  onSelectedMonthChange?: (month: string) => void;
  isFilterPanelOpen?: boolean;
  onFilterPanelOpenChange?: (isOpen: boolean) => void;
  activeFilters?: FilterCondition[];
  onActiveFiltersChange?: (filters: FilterCondition[]) => void;
}

// 定义暴露给父组件的方法
export interface FinancePanelMethods {
  handleExport: () => void;
  handleBatchInvoice: () => void;
}

// --- 格式化数字输入组件 ---
const FormattedNumberInput = ({ 
    value, 
    onChange, 
    disabled, 
    placeholder, 
    className = '',
    forceTextColor 
}: { 
    value: number | undefined | null, 
    onChange: (val: string) => void, 
    disabled?: boolean, 
    placeholder?: string,
    className?: string,
    forceTextColor?: string
}) => {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (value === undefined || value === null || isNaN(value)) {
            setDisplayValue('');
        } else {
            setDisplayValue(value.toLocaleString('en-US'));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (/^[\d,.-]*$/.test(raw)) {
            setDisplayValue(raw);
        }
    };

    const handleBlur = () => {
        if (!displayValue) {
            onChange('');
            return;
        }
        const cleanVal = displayValue.replace(/,/g, '');
        const num = parseFloat(cleanVal);
        if (!isNaN(num)) {
            onChange(String(num));
            setDisplayValue(num.toLocaleString('en-US'));
        } else {
            onChange('');
            setDisplayValue('');
        }
    };

    const isPositive = value && value > 0;
    const textColorClass = forceTextColor ? forceTextColor : (isPositive ? 'text-emerald-600 font-bold' : '');

    return (
        <input
            type="text"
            disabled={disabled}
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={(e) => e.target.select()}
            placeholder={placeholder}
            className={`${className} ${textColorClass}`}
        />
    );
};

// --- 财务过滤器字段定义 ---
const FINANCE_FILTER_FIELDS: FieldDefinition[] = [
    { key: 'week', label: '周次', type: 'TEXT' },
    { key: 'client', label: '客户', type: 'SELECT', options: [] }, 
    { key: 'service', label: '航线', type: 'SELECT', options: [] },
    { key: 'pol', label: '起运港', type: 'TEXT' },
    { key: 'pod', label: '目的港', type: 'TEXT' },
    { key: 'vessel', label: '船名', type: 'TEXT' },
    { key: 'bookingRef', label: '订舱号', type: 'TEXT' },
    { key: 'containerType', label: '箱型', type: 'TEXT' },
    { key: 'dbName', label: '数据源', type: 'TEXT' }
];

const ExpandableCell = ({ value, className = '', title }: { value: React.ReactNode, className?: string, title?: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayTitle = title || (typeof value === 'string' ? value : undefined);
    
    return (
        <div 
            onClick={() => setIsExpanded(!isExpanded)}
            title={displayTitle}
            className={`cursor-pointer transition-all duration-200 text-center flex items-center justify-center ${
                isExpanded ? 'whitespace-normal break-words h-auto' : 'truncate'
            } ${className}`}
        >
            {value}
        </div>
    );
};

// 发票管理对话框组件
interface InvoiceDialogProps {
  isOpen: boolean;
  dbId: string;
  booking: Booking | null;
  onClose: () => void;
  onSave: (dbId: string, booking: Booking) => void;
  canUpdate: boolean;
  canLock: boolean;
}

const InvoiceManagementDialog: React.FC<InvoiceDialogProps> = ({
  isOpen,
  dbId,
  booking,
  onClose,
  onSave,
  canUpdate,
  canLock
}) => {
  const [localBooking, setLocalBooking] = useState<Booking | null>(booking);

  useEffect(() => {
    setLocalBooking(booking);
  }, [booking]);

  if (!isOpen || !localBooking) return null;

  const finance = localBooking.finance || {};
  const isLocked = finance.isLocked;

  const handleSave = () => {
    if (!localBooking || !canUpdate) return;

    const currentFinance = localBooking.finance || {};
    
    // 如果开票状态为true且没有开票日期，自动设置当前日期
    const updatedFinance: FinanceData = {
      ...currentFinance,
      invoiced: true,
      invoicedDate: currentFinance.invoicedDate || new Date().toISOString().split('T')[0],
      invoicedNumber: currentFinance.invoicedNumber || '',
      invoiceRemark: currentFinance.invoiceRemark || ''
    };

    const updatedBooking: Booking = {
      ...localBooking,
      finance: updatedFinance
    };

    onSave(dbId, updatedBooking);
    onClose();
  };

  const handleRemoveInvoice = () => {
    if (!localBooking || !canUpdate) return;

    const currentFinance = localBooking.finance || {};
    const updatedFinance: FinanceData = {
      ...currentFinance,
      invoiced: false,
      invoicedDate: undefined,
      invoicedNumber: undefined,
      invoiceRemark: undefined
    };

    const updatedBooking: Booking = {
      ...localBooking,
      finance: updatedFinance
    };

    onSave(dbId, updatedBooking);
    onClose();
  };

  const handleFieldChange = (field: keyof FinanceData, value: any) => {
    if (!localBooking) return;
    
    const currentFinance = localBooking.finance || {};
    const updatedFinance: FinanceData = {
      ...currentFinance,
      [field]: value
    };

    setLocalBooking({
      ...localBooking,
      finance: updatedFinance
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {finance.invoiced ? '修改发票信息' : '标记为已开票'}
        </h3>
        
        <div className="space-y-4">
          {/* 开票状态 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="invoiced"
              checked={finance.invoiced || false}
              onChange={(e) => handleFieldChange('invoiced', e.target.checked)}
              disabled={isLocked && !canLock}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="invoiced" className="ml-2 text-sm font-medium text-gray-700">
              开票
            </label>
          </div>
          
          {/* 开票日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开票日期
            </label>
            <input
              type="date"
              value={finance.invoicedDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => handleFieldChange('invoicedDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled={isLocked && !canLock}
            />
          </div>
          
          {/* 发票号码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发票号码
            </label>
            <input
              type="text"
              value={finance.invoicedNumber || ''}
              onChange={(e) => handleFieldChange('invoicedNumber', e.target.value)}
              placeholder="输入发票号码"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled={isLocked && !canLock}
            />
          </div>
          
          {/* 发票备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发票备注
            </label>
            <textarea
              value={finance.invoiceRemark || ''}
              onChange={(e) => handleFieldChange('invoiceRemark', e.target.value)}
              placeholder="可选：输入发票备注"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={2}
              disabled={isLocked && !canLock}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          {finance.invoiced && (
            <button
              onClick={handleRemoveInvoice}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800"
              disabled={isLocked && !canLock}
            >
              删除开票记录
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            取消
          </button>
          
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            disabled={isLocked && !canLock}
          >
            {finance.invoiced ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const FinancePanel = forwardRef<FinancePanelMethods, FinancePanelProps>(({ 
  databases, onUpdateBooking, canUpdate, canLock, systemSettings, variant,
  // 新增的props
  searchTerm: externalSearchTerm,
  onSearchTermChange: externalOnSearchTermChange,
  selectedMonth: externalSelectedMonth,
  onSelectedMonthChange: externalOnSelectedMonthChange,
  isFilterPanelOpen: externalIsFilterPanelOpen,
  onFilterPanelOpenChange: externalOnFilterPanelOpenChange,
  activeFilters: externalActiveFilters,
  onActiveFiltersChange: externalOnActiveFiltersChange
}, ref) => {
  // 内部状态（如果外部没有提供）
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [internalSelectedMonth, setInternalSelectedMonth] = useState('');
  const [internalIsFilterPanelOpen, setInternalIsFilterPanelOpen] = useState(false);
  const [internalActiveFilters, setInternalActiveFilters] = useState<FilterCondition[]>([]);
  
  // 使用外部状态或内部状态
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = externalOnSearchTermChange || setInternalSearchTerm;
  
  const selectedMonth = externalSelectedMonth !== undefined ? externalSelectedMonth : internalSelectedMonth;
  const setSelectedMonth = externalOnSelectedMonthChange || setInternalSelectedMonth;
  
  const isFilterPanelOpen = externalIsFilterPanelOpen !== undefined ? externalIsFilterPanelOpen : internalIsFilterPanelOpen;
  const setIsFilterPanelOpen = externalOnFilterPanelOpenChange || setInternalIsFilterPanelOpen;
  
  const activeFilters = externalActiveFilters !== undefined ? externalActiveFilters : internalActiveFilters;
  const setActiveFilters = externalOnActiveFiltersChange || setInternalActiveFilters;
  
  // 其他现有状态
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false); // 默认收起仪表板
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // 发票管理对话框状态
  const [invoiceDialog, setInvoiceDialog] = useState<{
    isOpen: boolean;
    dbId: string;
    booking: Booking | null;
  }>({ isOpen: false, dbId: '', booking: null });
  
  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasPrev: false,
    hasNext: false
  });
  
  const [visibleColumns, setVisibleColumns] = useState({
      week: false, vessel: false, service: false, contact: false, invoicedNumber: false,
      remark: false
  });

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    handleExport,
    handleBatchInvoice
  }));

  const toggleColumn = (key: keyof typeof visibleColumns) => {
      setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') setSortConfig(null);
      else setSortConfig({ key, direction });
  };

  // 修改：直接使用原始字符串，不进行格式化
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    // 直接返回原始字符串（假设已经是 YYYY-MM-DD 格式）
    return dateStr;
  };

  // --- 基于变体的过滤逻辑 ---
  const allFinanceData = useMemo(() => {
    const flattened: Array<{ booking: Booking; dbId: string; dbName: string }> = [];
    databases.forEach(db => {
      db.bookings.forEach(b => {
        if (b.state !== 'CONFIRMED') return;
        const carrier = (b.carrier || '').toUpperCase();
        const client = (b.client || '').trim();
        const service = (b.service || '').toUpperCase();
        const job = String(b.job || '').trim();
        
        let include = false;
        if (variant === 'MY_FINANCE') include = job === '飞克斯';
        else if (variant === 'SAF_FINANCE') include = carrier.includes('MAERSK') && service.includes('SAF');
        else if (variant === 'CMA_FINANCE') {
            const validServices = ['EUR', 'FAL', 'FAL2', 'FAL3', 'FAL5', 'FAL6', 'FAL7', 'FAL8'];
            const hasValidService = validServices.some(s => service.includes(s));
            include = carrier.includes('CMA') && hasValidService;
        } else if (variant === 'CONCORD_FINANCE') include = client === '祥泰';

        if (include) {
          const adjustedDbName = db.name.includes('-') ? db.name.substring(db.name.indexOf('-') + 1) : db.name;
          flattened.push({ booking: b, dbId: db.id, dbName: adjustedDbName });
        }
      });
    });
    
    // 排序
    return flattened.sort((a, b) => {
        if (!sortConfig) {
            if (a.booking.week !== b.booking.week) return a.booking.week > b.booking.week ? -1 : 1;
            return (a.booking.etd || '') > (b.booking.etd || '') ? -1 : 1;
        }
        let valA: any = a.booking[sortConfig.key as keyof Booking];
        let valB: any = b.booking[sortConfig.key as keyof Booking];
        if (sortConfig.key === 'contact') { valA = a.dbName; valB = b.dbName; }
        if (['etd', 'gateInDate'].includes(sortConfig.key)) {
            valA = new Date(valA || '').getTime(); valB = new Date(valB || '').getTime();
        } else {
            valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [databases, sortConfig, variant]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allFinanceData.forEach(({ booking }) => {
        if (booking.etd) {
            // 直接使用原始字符串，假设是 YYYY-MM-DD 格式
            const yearMonthMatch = booking.etd.match(/^(\d{4})-(\d{2})/);
            if (yearMonthMatch) {
                months.add(`${yearMonthMatch[1]}-${yearMonthMatch[2]}`);
            }
        }
    });
    return Array.from(months).sort().reverse();
  }, [allFinanceData]);

  // 过滤器的可选项
  const optionsMap = useMemo(() => {
      const opts: Record<string, Set<string>> = {
          week: new Set(), client: new Set(), service: new Set(), pol: new Set(),
          pod: new Set(), vessel: new Set(), bookingRef: new Set(), containerType: new Set(), 
          dbName: new Set(), contact: new Set() // 新增contact字段
      };
      allFinanceData.forEach(({ booking, dbName }) => {
          Object.keys(opts).forEach(k => {
              if (k === 'dbName') opts[k].add(dbName);
              else if ((booking as any)[k]) opts[k].add(String((booking as any)[k]));
          });
      });
      const result: Record<string, string[]> = {};
      Object.keys(opts).forEach(k => result[k] = Array.from(opts[k]).sort());
      return result;
  }, [allFinanceData]);

  // 计算过滤后的总数据
  const filteredAllData = useMemo(() => {
    return allFinanceData.filter(({ booking, dbName }) => {
        if (selectedMonth) {
            if (!booking.etd) return false;
            // 直接使用原始字符串，假设是 YYYY-MM-DD 格式
            const yearMonthMatch = booking.etd.match(/^(\d{4})-(\d{2})/);
            if (!yearMonthMatch) return false;
            
            const bookingMonth = `${yearMonthMatch[1]}-${yearMonthMatch[2]}`;
            if (bookingMonth !== selectedMonth) return false;
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            const matches = (
                booking.bookingRef?.toLowerCase().includes(lower) || booking.client?.toLowerCase().includes(lower) ||
                booking.vessel?.toLowerCase().includes(lower) || dbName.toLowerCase().includes(lower) ||
                booking.week.toLowerCase().includes(lower) || booking.contact?.toLowerCase().includes(lower)
            );
            if (!matches) return false;
        }
        if (activeFilters.length > 0) {
            const passFilters = activeFilters.every(filter => {
                let bookingValue = filter.fieldKey === 'dbName' ? dbName : String((booking as any)[filter.fieldKey] || '');
                return bookingValue.toLowerCase().includes(filter.value.toLowerCase());
            });
            if (!passFilters) return false;
        }
        return true;
    });
  }, [allFinanceData, searchTerm, selectedMonth, activeFilters]);

  // 计算当前页数据
  const currentPageData = useMemo(() => {
    // 计算分页信息
    const total = filteredAllData.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const hasPrev = pagination.page > 1;
    const hasNext = pagination.page < totalPages;
    
    // 更新分页状态（避免无限循环）
    if (pagination.total !== total || 
        pagination.totalPages !== totalPages || 
        pagination.hasPrev !== hasPrev || 
        pagination.hasNext !== hasNext) {
      // 使用setTimeout避免在渲染过程中更新状态
      setTimeout(() => {
        setPagination(prev => ({
          ...prev,
          total,
          totalPages,
          hasPrev,
          hasNext
        }));
      }, 0);
    }
    
    // 计算当前页数据
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = Math.min(startIndex + pagination.limit, total);
    
    return filteredAllData.slice(startIndex, endIndex);
  }, [filteredAllData, pagination.page, pagination.limit]);

  // 处理页码变化
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
    
    // 滚动到表格顶部
    setTimeout(() => {
      const tableContainer = document.querySelector('.custom-scrollbar');
      if (tableContainer) {
        tableContainer.scrollTop = 0;
      }
    }, 100);
  };

  // 监听搜索和筛选条件变化，重置到第一页
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  }, [searchTerm, selectedMonth, activeFilters]);

  // 分页组件
  const PaginationControls = () => {
    const { page, total, totalPages, hasPrev, hasNext } = pagination;
    
    if (total <= 0) return null;
    
    // 生成页码范围
    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        let start = Math.max(1, page - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
          start = Math.max(1, end - maxVisible + 1);
        }
        
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      }
      
      return pages;
    };
    
    return (
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center text-xs">
        <div className="text-gray-500">
          <span className="font-semibold text-gray-900">总计: {total}</span>
          <span className="mx-2">•</span>
          <span className="font-semibold text-gray-900">第 {page} 页 / 共 {totalPages} 页</span>
          <span className="mx-2">•</span>
          <span className="text-gray-600">每页 {pagination.limit} 条</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => handlePageChange(page - 1)} 
            disabled={!hasPrev}
            className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
            title="上一页"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          
          {/* 页码按钮 */}
          <div className="flex gap-1 mx-1">
            {getPageNumbers().map(pageNum => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-2 py-1 min-w-[28px] rounded text-xs ${
                  page === pageNum 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {pageNum}
              </button>
            ))}
            
            {/* 省略号 */}
            {totalPages > 5 && page < totalPages - 2 && (
              <span className="px-1 py-1 text-gray-400">...</span>
            )}
            
            {/* 最后一页 */}
            {totalPages > 5 && page < totalPages - 2 && (
              <button
                onClick={() => handlePageChange(totalPages)}
                className={`px-2 py-1 min-w-[28px] rounded text-xs ${
                  page === totalPages 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {totalPages}
              </button>
            )}
          </div>
          
          <button 
            onClick={() => handlePageChange(page + 1)} 
            disabled={!hasNext}
            className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
            title="下一页"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  // --- 计算辅助函数 ---
  const calculateCmaSComm = (sccfi: number, type: string, qty: number, ap: number) => {
      const normalizedType = (type || '').toUpperCase();
      const totalAP = ap * qty; 
      if (normalizedType.includes('20')) {
          const part1 = (sccfi * 2 * 0.7 * qty) * 0.63 * qty;
          return Math.round((part1 - totalAP + (qty * 35)) / 2);
      } else {
          const baseTerm = sccfi * 2 * 0.7 * qty;
          return Math.round((baseTerm - totalAP + (qty * 70)) / 2);
      }
  };

  // --- 更新处理函数 ---
  const handleUpdateFinance = (dbId: string, booking: Booking, field: keyof FinanceData, value: string) => {
    if (!canUpdate) return;
    const numValue = parseFloat(value);
    const finalValue = isNaN(numValue) ? (value === '' ? undefined : value) : numValue;
    const currentFinance = booking.finance || {};
    if (currentFinance.isLocked && !canLock) { alert("该记录已锁定。"); return; }
    
    // 基础更新
    const updatedFinance: FinanceData = { ...currentFinance, [field]: finalValue };
    const qty = booking.qty || 1;

    if (variant === 'MY_FINANCE' && field === 'ens' ) {
        const oldValue = Number(currentFinance[field]) || 0;
        const newValue = typeof finalValue === 'number' ? Number(finalValue) : 0;
        const delta = newValue - oldValue;
        
        // 更新应收
        const currentReceivable = Number(currentFinance.receivable) || 0;
        updatedFinance.receivable = currentReceivable + delta;

    }

    // MyFinance: 处理船东佣金输入
    if (variant === 'MY_FINANCE' && field === 'brokerageShip') {
        if (updatedFinance.brokerageShipLocked) {
            alert("船东佣金已被其他模块锁定，不可修改。");
            return;
        }
        updatedFinance.brokerageShip = typeof finalValue === 'number' ? finalValue : undefined;
    }

    // --- CmaFinance 逻辑: S.COMM/AP 计算 ---
    if (variant === 'CMA_FINANCE') {
        if (field === 'sccfi' || field === 'ffeP') {
            const ffeP = field === 'ffeP' ? (typeof finalValue === 'number' ? finalValue : 0) : (updatedFinance.ffeP || 0);
            const sccfi = field === 'sccfi' ? (typeof finalValue === 'number' ? finalValue : 0) : (updatedFinance.sccfi || 0);
            
            // 修改：检查 SCCFI 和 FFE 是否都有有效值
            const hasValidSccfi = typeof sccfi === 'number' && !isNaN(sccfi) && sccfi > 0;
            const hasValidFfeP = typeof ffeP === 'number' && !isNaN(ffeP) && ffeP > 0;
            
            // 只有当两者都有有效值时才计算船东佣金
            if (hasValidSccfi && hasValidFfeP) {
                const sComm = calculateCmaSComm(sccfi, booking.type, qty, ffeP);
                if (!isNaN(sComm)) {
                    updatedFinance.brokerageShip = sComm;
                    updatedFinance.brokerageShipLocked = true;
                } else {
                    // 如果计算失败，清空船东佣金
                    updatedFinance.brokerageShip = undefined;
                    updatedFinance.brokerageShipLocked = false;
                }
            } else {
                // 如果 SCCFI 或 FFE 没有有效值，清空船东佣金并解锁
                updatedFinance.brokerageShip = undefined;
                updatedFinance.brokerageShipLocked = false;
            }
            
            if (field === 'ffeP' && ffeP !== undefined) {
                updatedFinance.payable = (ffeP * qty) + 25;
            }
        }
        
        if (field === 'brokerageShip' && finalValue !== undefined) {
            updatedFinance.brokerageShipLocked = true;
        }
    }

    // --- ConcordFinance 逻辑: 将 A.R 同步到 Saf A.R ---
    if (variant === 'CONCORD_FINANCE') {
        if (field === 'unitReceivable') { 
             const unitAR = typeof finalValue === 'number' ? finalValue : 0;
             const totalAR = unitAR * qty;
             updatedFinance.receivable = totalAR;
        }
    }

    // --- SafFinance 逻辑: 自动计算 COMM/S.COMM ---
    if (variant === 'SAF_FINANCE' || variant === 'CONCORD_FINANCE') { 
        const ar = updatedFinance.receivable || 0;
        const ffeP = updatedFinance.ffeP || 0;
        const hd = updatedFinance.handlingFee || 0;
        const realApUnit = updatedFinance.realAP;

        const apTotal = (ffeP + hd) * qty;
        
        const sComm = (ar - apTotal) / 2;
        updatedFinance.sComm = isNaN(sComm) ? undefined : sComm;

        if (realApUnit !== undefined && realApUnit !== null) {
            const realApTotal = (realApUnit + hd) * qty;
            const comm = (ar - realApTotal) / 2;
            updatedFinance.comm = isNaN(comm) ? undefined : comm;
        } else {
            updatedFinance.comm = undefined;
        }
        
        if (variant === 'SAF_FINANCE' && sComm !== undefined && !isNaN(sComm)) {
            updatedFinance.brokerageShip = sComm;
            updatedFinance.brokerageShipLocked = true;
        }
    }

    const updatedBooking: Booking = {
        ...booking,
        finance: updatedFinance
    };
    onUpdateBooking(dbId, updatedBooking);
  };

  const toggleLock = (dbId: string, booking: Booking) => {
      if (!canLock) return;
      const currentFinance = booking.finance || {};
      const updatedBooking: Booking = {
          ...booking, finance: { ...currentFinance, isLocked: !currentFinance.isLocked }
      };
      onUpdateBooking(dbId, updatedBooking);
  };

  // MyFinance A.P 计算逻辑 (自动填充) - 更新为匹配新的 GateInRate 数据结构
  const getEffectiveGateInPrice = (
    gateInDate?: string, 
    service?: string, 
    contact?: string, 
    containerType?: string,
    pol?: string,
    pod?: string
  ): number | null => {
    if (!gateInDate || !systemSettings?.gateInRates) return null;
    
    // 使用 parseDateWithoutTimezone 解析日期，避免时区问题
    const targetDate = parseDateWithoutTimezone(gateInDate);
    if (!targetDate) return null;
    
    // 查找匹配的费率记录
    const matchingRates = systemSettings.gateInRates.filter(rate => {
      const start = parseDateWithoutTimezone(rate.startDate);
      const end = parseDateWithoutTimezone(rate.endDate);
      if (!start || !end) return false;
      
      // 检查日期范围
      if (!(targetDate >= start && targetDate <= end)) return false;
      
      // 检查服务航线匹配（如果费率中有设置）
      const rateService = (rate.service || '').trim().toLowerCase();
      const bookingService = (service || '').trim().toLowerCase();
      if (rateService && rateService !== bookingService) return false;
      
      // 检查合约匹配（如果费率中有设置）
      const rateContact = (rate.contact || '').trim().toLowerCase();
      const bookingContact = (contact || '').trim().toLowerCase();
      if (rateContact && rateContact !== bookingContact) return false;
      
      return true;
    });
    
    if (matchingRates.length === 0) return null;
    
    // 优先使用第一个匹配的费率
    const rate = matchingRates[0];
    
    // 查找匹配的价格项目
    for (const item of rate.items) {
      // 检查起运港匹配
      const polsMatch = item.pols.length === 0 || 
        (pol && item.pols.some(ratePol => 
          ratePol.toLowerCase() === pol.toLowerCase()));
      
      // 检查目的港匹配
      const podsMatch = item.pods.length === 0 || 
        (pod && item.pods.some(ratePod => 
          ratePod.toLowerCase() === pod.toLowerCase()));
      
      // 检查箱型匹配
      const containerTypesMatch = item.containerTypes.length === 0 || 
        (containerType && item.containerTypes.some(rateType => 
          rateType.toLowerCase() === containerType.toLowerCase()));
      
      if (polsMatch && podsMatch && containerTypesMatch) {
        return item.price;
      }
    }
    
    // 如果没有找到完全匹配的项目，返回 null
    return null;
  };

  // 批量开票处理
  const handleBatchInvoice = () => {
    if (currentPageData.length === 0 || !canUpdate) return;
    
    const confirm = window.confirm(`确认将当前页 ${currentPageData.length} 条记录标记为已开票？`);
    if (!confirm) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    currentPageData.forEach(({ booking, dbId }) => {
      const currentFinance = booking.finance || {};
      if (!currentFinance.isLocked || (currentFinance.isLocked && canLock)) {
        // 如果记录未锁定，或者已锁定但用户有解锁权限
        if (!currentFinance.invoiced) {
          const updatedFinance: FinanceData = {
            ...currentFinance,
            invoiced: true,
            invoicedDate: currentFinance.invoicedDate || today,
          };
          
          const updatedBooking: Booking = {
            ...booking,
            finance: updatedFinance
          };
          
          onUpdateBooking(dbId, updatedBooking);
        }
      } else {
        // 记录已锁定且用户无解锁权限，跳过
        console.log(`跳过已锁定的记录: ${booking.bookingRef}`);
      }
    });
    
    alert(`批量开票完成。已处理 ${currentPageData.length} 条记录。`);
  };

  // 验证值是否存在 (非 null/undefined/NaN)
  const isValid = (val: any) => val !== undefined && val !== null && !isNaN(val);

  const renderMoneyInput = (
      dbId: string, 
      booking: Booking, 
      field: keyof FinanceData, 
      tooltip: string, 
      isReadOnly = false, 
      suggestedValue?: number | null,
      customTextColor?: string,
      displayAbs: boolean = false
  ) => {
      const val = booking.finance?.[field];
      const isLocked = booking.finance?.isLocked;
      const hasStoredValue = isValid(val);
      
      let displayVal: number | undefined = undefined;
      if (hasStoredValue) {
          displayVal = val as number;
      } else if (isValid(suggestedValue)) {
          displayVal = suggestedValue as number;
      }
      
      if (displayAbs && displayVal !== undefined) {
          displayVal = Math.abs(displayVal);
      }

      if (isReadOnly) {
          let colorClass = '';
          if (customTextColor) {
              colorClass = customTextColor;
          } else {
              colorClass = (displayVal||0) < 0 ? 'text-red-600' : (displayVal||0) > 0 ? 'text-emerald-600' : 'text-gray-500';
          }
          if (!isValid(displayVal)) {
              return <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>;
          }

          return (
              <div className={`px-2 py-1 text-center font-mono text-[11px] font-bold flex items-center justify-center h-full ${colorClass}`} title={tooltip}>
                  {(displayVal||0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
          );
      }

      return (
          <div className="relative group/input h-full flex items-center justify-center" title={tooltip}>
              <FormattedNumberInput 
                  disabled={isLocked && !canLock}
                  value={displayVal}
                  onChange={(v) => handleUpdateFinance(dbId, booking, field, v)}
                  className={`w-full h-full bg-transparent px-2 py-1 text-center font-mono text-[11px] outline-none focus:bg-blue-50 transition-colors flex items-center justify-center ${isLocked ? 'cursor-not-allowed text-gray-400' : 'text-gray-800'}`}
                  placeholder="-"
                  forceTextColor={customTextColor}
              />
          </div>
      );
  };

  // 渲染MyFinance的船东佣金字段
  const renderMyFinanceBrokerageShip = (dbId: string, booking: Booking) => {
      const f = booking.finance || {};
      const isLocked = f.isLocked;
      const brokerageShipLocked = f.brokerageShipLocked === true;
      const val = f.brokerageShip;
      const hasStoredValue = isValid(val);
      
      if (brokerageShipLocked) {
          let displayVal: number | undefined = undefined;
          if (hasStoredValue) {
              displayVal = val as number;
          }
          
          const colorClass = (displayVal||0) < 0 ? 'text-red-600' : (displayVal||0) > 0 ? 'text-emerald-600' : 'text-gray-500';
          
          if (!isValid(displayVal)) {
              return <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>;
          }

          return (
              <div className={`px-2 py-1 text-center font-mono text-[11px] font-bold flex items-center justify-center h-full ${colorClass}`} title="船东佣金 (已锁定)">
                  {(displayVal||0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
          );
      }
      
      return (
          <div className="relative group/input h-full flex items-center justify-center" title="船东佣金">
              <FormattedNumberInput 
                  disabled={isLocked && !canLock}
                  value={val}
                  onChange={(v) => handleUpdateFinance(dbId, booking, 'brokerageShip', v)}
                  className={`w-full h-full bg-transparent px-2 py-1 text-center font-mono text-[11px] outline-none focus:bg-blue-50 transition-colors flex items-center justify-center ${isLocked ? 'cursor-not-allowed text-gray-400' : 'text-gray-800'}`}
                  placeholder="-"
              />
          </div>
      );
  };

  // 渲染已开票状态
  const renderInvoicedStatus = (dbId: string, booking: Booking) => {
    const f = booking.finance || {};
    const isLocked = f.isLocked;
    
    return (
      <div className="flex items-center justify-center h-full">
        <button
          onClick={() => {
            if (!(isLocked && !canLock)) {
              setInvoiceDialog({ isOpen: true, dbId, booking });
            }
          }}
          className={`flex items-center justify-center w-full h-full px-2 py-1 ${
            f.invoiced 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } rounded text-[11px] font-medium transition-colors ${(isLocked && !canLock) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          disabled={isLocked && !canLock}
          title={f.invoiced 
            ? `已开票 ${f.invoicedDate ? formatDate(f.invoicedDate) : ''} ${f.invoicedNumber ? `(${f.invoicedNumber})` : ''}` 
            : '点击标记为已开票'
          }
        >
          {f.invoiced ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              {f.invoicedDate ? formatDate(f.invoicedDate) : '已开票'}
            </>
          ) : (
            '未开票'
          )}
        </button>
      </div>
    );
  };

  // 渲染发票号码
  const renderInvoiceNumber = (booking: Booking) => {
    const f = booking.finance || {};
    
    if (f.invoiced && f.invoicedNumber) {
      return (
        <div className="text-[11px] font-mono text-center text-blue-600 truncate" title={f.invoicedNumber}>
          {f.invoicedNumber}
        </div>
      );
    }
    
    return <div className="text-[11px] text-gray-300 text-center">-</div>;
  };

  const handleExport = () => {
    // 使用 filteredAllData 导出所有过滤后的数据
    const exportData = filteredAllData.map(({ booking, dbName }) => {
       const f = booking.finance || {};
       const qty = booking.qty || 1;
       
       let safCalculatedAP = 0;
       if (variant === 'SAF_FINANCE') {
           safCalculatedAP = ((f.ffeP || 0) + (f.handlingFee || 0)) * qty;
       }

        // 为所有变体创建一个基础导出对象
        const baseExportObj: any = {
        ...booking,
        ...f,
        safCalculatedAP,
        contact: dbName,
        gateInDate: booking.gateIn, // 将 gateIn 映射为 gateInDate
        };
        
        // 只为 MY_FINANCE 计算和添加 netProfit 和发票信息
        if (variant === 'MY_FINANCE') {
        const receivable = f.receivable || 0;
        const payable = f.payable || 0;
        const brokerage = f.brokerage || 0;
        const docFee = f.docFee || 0;
        const brokerageShip = f.brokerageShip || 0;
        const freeCost = f.freeCost || 0;
        const xiangTai = f.xiangTai || 0;
        
        // 净利 = (应收 - 应付) - 佣金 - 操作费 - 船东佣金 - 换单费 - 祥泰
        const netProfit = receivable - payable - brokerage - docFee - brokerageShip - freeCost - xiangTai;
        baseExportObj.netProfit = netProfit;
        
        // 添加发票信息
        baseExportObj.invoiced = f.invoiced ? '是' : '否';
        baseExportObj.invoicedDate = f.invoicedDate || '';
        baseExportObj.invoicedNumber = f.invoicedNumber || '';
        baseExportObj.invoiceRemark = f.invoiceRemark || '';
        // 添加祥泰字段
        baseExportObj.xiangTai = xiangTai;
        }

        return baseExportObj;
    });

    let exportFields: FieldDefinition[] = [];

    if (variant === 'CONCORD_FINANCE') {
        exportFields = [
            { key: 'week', label: '周次', type: 'TEXT' },
            { key: 'client', label: '客户', type: 'TEXT' },
            { key: 'etd', label: '开船日期', type: 'DATE' },
            { key: 'pol', label: '起运港', type: 'TEXT' },
            { key: 'pod', label: '目的港', type: 'TEXT' },
            { key: 'vessel', label: '船名', type: 'TEXT' },
            { key: 'bookingRef', label: '订舱号', type: 'TEXT' },
            { key: 'service', label: '航线', type: 'TEXT' },
            { key: 'contact', label: '数据源', type: 'TEXT' },
            { key: 'qty', label: '数量', type: 'NUMBER' },
            { key: 'type', label: '箱型', type: 'TEXT' },
            { key: 'unitReceivable', label: '应收(FFE)', type: 'NUMBER' }, 
            { key: 'receivable', label: '应收', type: 'NUMBER' }, 
            { key: 'finalAR', label: '最终应付', type: 'NUMBER' },
            { key: 'remark', label: '备注', type: 'TEXT' }
        ];
    } else if (variant === 'CMA_FINANCE') {
        exportFields = [
            { key: 'week', label: '周次', type: 'TEXT' },
            { key: 'client', label: '客户', type: 'TEXT' },
            { key: 'etd', label: '开船日期', type: 'DATE' },
            { key: 'pol', label: '起运港', type: 'TEXT' },
            { key: 'pod', label: '目的港', type: 'TEXT' },
            { key: 'vessel', label: '船名', type: 'TEXT' },
            { key: 'bookingRef', label: '订舱号', type: 'TEXT' },
            { key: 'service', label: '航线', type: 'TEXT' },
            { key: 'contact', label: '数据源', type: 'TEXT' },
            { key: 'qty', label: '数量', type: 'NUMBER' },
            { key: 'type', label: '箱型', type: 'TEXT' },
            { key: 'ffeP', label: '应付(FFE)', type: 'NUMBER' },
            { key: 'sccfi', label: 'SCCFI', type: 'NUMBER' },
            { key: 'brokerage', label: '佣金', type: 'NUMBER' }, 
            { key: 'brokerageShip', label: '船东佣金', type: 'NUMBER' },
            { key: 'remark', label: '备注', type: 'TEXT' }
        ];
    } else if (variant === 'SAF_FINANCE') {
        exportFields = [
            { key: 'week', label: '周次', type: 'TEXT' },
            { key: 'client', label: '客户', type: 'TEXT' },
            { key: 'etd', label: '开船日期', type: 'DATE' },
            { key: 'pol', label: '起运港', type: 'TEXT' },
            { key: 'pod', label: '目的港', type: 'TEXT' },
            { key: 'vessel', label: '船名', type: 'TEXT' },
            { key: 'bookingRef', label: '订舱号', type: 'TEXT' },
            { key: 'service', label: '航线', type: 'TEXT' },
            { key: 'contact', label: '数据源', type: 'TEXT' },
            { key: 'qty', label: '数量', type: 'NUMBER' },
            { key: 'type', label: '箱型', type: 'TEXT' },
            { key: 'realAP', label: '实际应付', type: 'NUMBER' },
            { key: 'ffeP', label: '应付(FFE)', type: 'NUMBER' },
            { key: 'handlingFee', label: '操作费', type: 'NUMBER' },
            { key: 'safCalculatedAP', label: '应付', type: 'NUMBER' },
            { key: 'receivable', label: '应收', type: 'NUMBER' },
            { key: 'comm', label: '佣金', type: 'NUMBER' },
            { key: 'sComm', label: '船东佣金', type: 'NUMBER' },
            { key: 'remark', label: '备注', type: 'TEXT' }
        ];
    } else {
        // MY_FINANCE 导出字段
        exportFields = [
            { key: 'week', label: '周次', type: 'TEXT' },
            { key: 'client', label: '客户', type: 'TEXT' },
            { key: 'etd', label: '开船日期', type: 'DATE' },
            { key: 'pol', label: '起运港', type: 'TEXT' },
            { key: 'pod', label: '目的港', type: 'TEXT' },
            { key: 'vessel', label: '船名', type: 'TEXT' },
            { key: 'bookingRef', label: '订舱号', type: 'TEXT' },
            { key: 'service', label: '航线', type: 'TEXT' },
            { key: 'contact', label: '数据源', type: 'TEXT' },
            { key: 'qty', label: '数量', type: 'NUMBER' },
            { key: 'type', label: '箱型', type: 'TEXT' },
            { key: 'gateInDate', label: '进港日期', type: 'DATE' },
            { key: 'ens', label: 'ENS', type: 'NUMBER' },
            { key: 'freeCost', label: '换单费', type: 'NUMBER' },
            { key: 'docFee', label: '提单费', type: 'NUMBER' },
            { key: 'payable', label: '应付', type: 'NUMBER' },
            { key: 'receivable', label: '应收', type: 'NUMBER' },
            { key: 'difference', label: '差额', type: 'NUMBER' },
            { key: 'brokerage', label: '佣金', type: 'NUMBER' },
            { key: 'brokerageShip', label: '船东佣金', type: 'NUMBER' },
            { key: 'docFee', label: '操作费', type: 'NUMBER' },
            { key: 'xiangTai', label: '祥泰', type: 'NUMBER' },
            { key: 'netProfit', label: '净利', type: 'NUMBER' },
            { key: 'invoiced', label: '开票', type: 'TEXT' },
            { key: 'invoicedDate', label: '开票日期', type: 'DATE' },
            { key: 'invoicedNumber', label: '发票号码', type: 'TEXT' },
            { key: 'invoiceRemark', label: '发票备注', type: 'TEXT' },
            { key: 'remark', label: '备注', type: 'TEXT' }
        ];
    }

    exportToCSV(exportData, exportFields, `${variant}_导出_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative">
      {/* 发票管理对话框 */}
      <InvoiceManagementDialog
        isOpen={invoiceDialog.isOpen}
        dbId={invoiceDialog.dbId}
        booking={invoiceDialog.booking}
        onClose={() => setInvoiceDialog({ isOpen: false, dbId: '', booking: null })}
        onSave={onUpdateBooking}
        canUpdate={canUpdate}
        canLock={canLock}
      />

      {/* 1. 仪表板概览 - 默认收起，高度压缩 */}
      <div className={`flex-shrink-0 bg-gray-50 border-b border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${isDashboardExpanded ? 'h-auto' : 'h-8 overflow-hidden'}`}>
          <div 
            className="flex justify-between items-center px-4 py-1 cursor-pointer hover:bg-gray-100/80 transition-colors select-none"
            onClick={() => setIsDashboardExpanded(!isDashboardExpanded)}
          >
              {/* <h2 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> */}
              <h2 className="text-xs font-bold text-gray-800">
                  {/* 仪表板 */}
                  {/* {variant === 'MY_FINANCE' ? '我的财务' : variant === 'SAF_FINANCE' ? '南非财务' : variant === 'CMA_FINANCE' ? 'CMA财务' : 'CONCORD财务'} 仪表板 */}
              </h2>
              <button className="text-gray-400 hover:text-gray-600">
                  {isDashboardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
          </div>
          <div className={`px-4 pb-2 ${isDashboardExpanded ? 'opacity-100' : 'opacity-0'}`}>
              <FinanceOverview data={filteredAllData} variant={variant} />
          </div>
      </div>

      {/* 2. 高级筛选面板 */}
      <AdvancedFilter isOpen={isFilterPanelOpen} fields={FINANCE_FILTER_FIELDS} optionsMap={optionsMap} filters={activeFilters} onAddFilter={(f) => setActiveFilters([...activeFilters, f])} onRemoveFilter={(id) => setActiveFilters(activeFilters.filter(f => f.id !== id))} onClearAll={() => setActiveFilters([])} onClose={() => setIsFilterPanelOpen(false)} />

      {/* 2.5 列显示切换 - 高度压缩 */}
      <div className="bg-slate-100 border-b border-gray-200 px-4 py-1 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-gray-500 font-bold uppercase tracking-wider text-[10px]"><GripHorizontal className="w-3 h-3" /> 列显示</div>
          <div className="flex gap-1">
              {[
                  { key: 'week', label: '周次' },
                  { key: 'vessel', label: '船名' },
                  { key: 'service', label: '航线' },
                  { key: 'contact', label: '数据源' },
                  { key: 'invoicedNumber', label: '发票号码' },
                  { key: 'remark', label: '备注' } // 新增财务备注列显示控制
              ].map(col => {
                  const isVisible = visibleColumns[col.key as keyof typeof visibleColumns];
                  return (
                      <button 
                          key={col.key}
                          onClick={() => toggleColumn(col.key as keyof typeof visibleColumns)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md border shadow-sm transition-all duration-200 text-[9px] font-medium min-h-[24px]
                              ${!isVisible 
                                  ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600' 
                                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                              }`}
                      >
                          {isVisible ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3 text-gray-400"/>}
                          {col.label}
                      </button>
                  );
              })}
          </div>
      </div>

      {/* 3. 数据表格 - 调整表头高度，新增合约方字段 */}
      <div className="flex-1 overflow-auto bg-white custom-scrollbar relative">
          <table className="w-full border-collapse text-left whitespace-nowrap table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-30 shadow-sm text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                  <tr className="h-8">
                      <th className="w-10 text-center border-r border-b border-gray-200 bg-gray-50 sticky left-0 z-40 text-xs font-bold align-middle">#</th>
                      {visibleColumns.week && <th className="w-[72px] px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('week')}>周次</th>}
                      <th className="w-[60px] px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('client')}>客户</th>
                      <th className="w-20 px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('etd')}>开船日期</th>
                      <th className="w-20 px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('pol')}>起运港</th>
                      <th className="w-[90px] px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('pod')}>目的港</th>
                      {visibleColumns.vessel && <th className="w-[200px] px-2 border-r border-b border-gray-200 text-xs font-bold text-center align-middle">船名</th>}
                      <th className="min-w-[100px] px-2 border-r border-b border-gray-200 text-xs font-bold text-center align-middle">订舱号</th>
                      {visibleColumns.service && <th className="w-16 px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('service')}>航线</th>}
                      {visibleColumns.contact && <th className="w-24 px-2 border-r border-b border-gray-200 bg-blue-50/30 cursor-pointer hover:bg-blue-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('contact')}>数据源</th>}
                      <th className="w-[40px] px-2 text-center border-r border-b border-gray-200 text-xs font-bold align-middle">数量</th>
                      <th className="w-16 px-2 border-r border-b border-gray-200 text-xs font-bold text-center align-middle">箱型</th>

                      {variant === 'MY_FINANCE' && <>
                            <th className="w-20 px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('gateInDate')}>进港日期</th>
                            {/* 新增：合约方字段 - 在备注字段前面 */}
                            <th className="w-[60px] px-2 border-r border-b border-gray-200 bg-purple-50/30 cursor-pointer hover:bg-purple-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('contact')}>合约方</th>
                            <th className="w-12 px-2 text-center border-r border-b border-gray-200 bg-emerald-50/30 text-xs font-bold align-middle">ENS</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-emerald-50/30 text-xs font-bold align-middle">换单费</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-red-50/30 text-xs font-bold align-middle">应付</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-green-50/30 text-xs font-bold align-middle">应收</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-gray-100 text-xs font-bold align-middle">差额</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-orange-50/30 text-xs font-bold align-middle">佣金</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-orange-50/30 text-xs font-bold align-middle">船东佣金</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-emerald-50/30 text-xs font-bold align-middle">操作费</th>
                            {/* 新增：祥泰字段表头 */}
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-purple-50/30 text-xs font-bold align-middle">祥泰</th>
                            <th className="w-14 px-2 text-center border-r border-b border-gray-200 bg-emerald-100/50 text-xs font-bold align-middle">净利</th>
                            {/* 新增：已开票相关列 */}
                            <th className="w-20 px-2 text-center border-r border-b border-gray-200 bg-green-50/30 text-xs font-bold align-middle">开票</th>
                            {/* 新增：财务备注列 */}
                            <th className="w-24 px-2 text-center border-r border-b border-gray-200 bg-yellow-50/30 text-xs font-bold align-middle">财务备注</th>
                            {visibleColumns.invoicedNumber && <th className="w-20 px-2 text-center border-r border-b border-gray-200 bg-blue-50/30 text-xs font-bold align-middle">发票号码</th>}
                      </>}
                      {variant === 'SAF_FINANCE' && <>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-50/10 text-xs font-bold align-middle">实际应付</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-50/30 text-xs font-bold align-middle">应付(FFE)</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-orange-50/30 text-xs font-bold align-middle">操作费</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-100/20 text-xs font-bold align-middle">应付</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-green-50/30 text-xs font-bold align-middle">应收</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-blue-50/30 text-xs font-bold align-middle">佣金</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-blue-100/20 text-xs font-bold align-middle">船东佣金</th>
                      </>}
                      {variant === 'CMA_FINANCE' && <>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-50/30 text-xs font-bold align-middle">应付(FFE)</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-indigo-50/30 text-xs font-bold align-middle">SCCFI</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-orange-50/30 text-xs font-bold align-middle">佣金</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-emerald-100/50 text-xs font-bold align-middle">船东佣金</th>
                            <th className="w-[60px] px-2 border-r border-b border-gray-200 bg-purple-50/30 cursor-pointer hover:bg-purple-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('contact')}>合约方</th>
                      </>}
                      {variant === 'CONCORD_FINANCE' && <>
                            <th className="w-20 px-2 border-r border-b border-gray-200 cursor-pointer hover:bg-gray-100 text-xs font-bold text-center align-middle" onClick={() => handleSort('gateInDate')}>进港日期</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-50/30 text-xs font-bold align-middle">应收(FFE)</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-red-100/20 text-xs font-bold align-middle">应收</th>
                            <th className="w-16 px-2 text-center border-r border-b border-gray-200 bg-green-100/20 text-xs font-bold align-middle">最终应付</th>
                      </>}
                      {/* 修改：备注字段表头 */}
                      {visibleColumns.remark && (
                        <th className="w-48 px-2 border-r border-b border-gray-200 text-xs font-bold text-center align-middle">备注</th>
                    )}
                  </tr>
              </thead>
              <tbody className="text-[10px] divide-y divide-gray-100">
                  {currentPageData.length === 0 ? (
                    <tr>
                      <td colSpan={100} className="py-16 text-center text-gray-400 align-middle">
                        <DollarSign className="w-8 h-8 opacity-20 mb-1 mx-auto" />
                        <p className="text-xs">没有匹配筛选条件的数据。</p>
                      </td>
                    </tr>
                  ) : (
                    currentPageData.map(({ booking, dbId, dbName }, idx) => {
                        const f = booking.finance || {};
                        const qty = booking.qty || 1;
                        // 更新函数调用，传递所有需要的参数
                        const effPrice = getEffectiveGateInPrice(
                          booking.gateIn, 
                          booking.service, 
                          dbName, 
                          booking.type,
                          booking.pol,
                          booking.pod
                        );
                        const autoAP = (effPrice !== null) ? (effPrice * qty) : undefined;

                        return (
                            <tr key={booking.id} className="hover:bg-blue-100/50 transition-colors group">
                                <td className="text-center text-gray-400 border-r border-gray-100 bg-white sticky left-0 z-20 group-hover:bg-blue-100/50 border-b text-[10px] align-middle">
                                    {canLock ? <button onClick={() => toggleLock(dbId, booking)} className="p-0.5 hover:text-blue-600 transition-colors mx-auto flex items-center justify-center">{f.isLocked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-gray-300" />}</button> : <span className="text-[10px] block text-center">{idx + 1 + (pagination.page - 1) * pagination.limit}</span>}
                                </td>
                                {visibleColumns.week && <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.week} className="text-[10px]" /></td>}
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.client} className="text-[11px]" /></td>
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                  {/* 修改：直接使用原始日期字符串 */}
                                  <ExpandableCell value={booking.etd || ''} className="text-[11px] text-gray-500 font-mono" />
                                </td>
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.pol} className="text-[10px]" /></td>
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.pod} className="text-[10px]" /></td>
                                {visibleColumns.vessel && <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.vessel} className="text-[10px]" /></td>}
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle relative">
                                    {/* 显示内容（截断） */}
                                    <div className="text-center text-[10px] font-medium text-blue-700 truncate max-w-[100px] mx-auto">
                                        {String(booking.bookingRef || '').trim()}
                                    </div>
                                    
                                    {/* 强制悬停层 - 覆盖整个单元格 */}
                                    <div 
                                        className="absolute inset-0 flex items-center justify-center bg-blue-50 opacity-0 hover:opacity-100 transition-opacity z-50 cursor-pointer border border-blue-200"
                                        title={String(booking.bookingRef || '').trim()}
                                    >
                                        <span className="text-[11px] font-bold text-blue-800 px-1">
                                            {String(booking.bookingRef || '').trim()}
                                        </span>
                                    </div>
                                </td>
                                {visibleColumns.service && <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.service} className="text-[10px]" /></td>}
                                {visibleColumns.contact && <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={dbName} className="text-[10px] text-blue-800 font-medium bg-blue-50/10 rounded" /></td>}
                                <td className="px-2 py-0.5 border-r border-gray-100 text-center font-bold align-middle text-[10px]">{qty}</td>
                                <td className="px-2 py-0.5 border-r border-gray-100 align-middle"><ExpandableCell value={booking.type} className="text-[10px]" /></td>

                                {variant === 'MY_FINANCE' && <>
                                      <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                        {/* 修改：直接使用原始日期字符串 */}
                                        <ExpandableCell value={booking.gateIn || ''} className="text-[11px] text-gray-500 font-mono" />
                                      </td>
                                      {/* 新增：合约方字段 */}
                                      <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                        <ExpandableCell value={booking.contact || ''} className="text-[11px] bg-purple-50/10 rounded" />
                                      </td>
                                      <td className="border-r border-gray-100 bg-emerald-50/10 align-middle">{renderMoneyInput(dbId, booking, 'ens', 'ENS')}</td>
                                      <td className="border-r border-gray-100 bg-emerald-50/10 align-middle">{renderMoneyInput(dbId, booking, 'freeCost', '换单费')}</td>
                                      
                                      <td className="border-r border-gray-100 bg-red-50/10 align-middle">{renderMoneyInput(dbId, booking, 'payable', '应付', false, autoAP)}</td>
                                      <td className="border-r border-gray-100 bg-green-50/10 align-middle">
                                          {renderMoneyInput(dbId, booking, 'receivable', '应收', false, undefined)}
                                      </td>
                                      <td className="border-r border-gray-100 bg-gray-50 align-middle">
                                          {isValid(f.receivable) && isValid(f.payable)
                                              ? renderMoneyInput(dbId, { ...booking, finance: { ...f, difference: (f.receivable! - f.payable!) } }, 'difference', '差额', true)
                                              : <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>
                                          }
                                      </td>
                                      <td className="border-r border-gray-100 bg-orange-50/10 align-middle">{renderMoneyInput(dbId, booking, 'brokerage', '佣金', false, null, "text-gray-900 font-bold")}</td>
                                      <td className="border-r border-gray-100 bg-orange-50/10 align-middle">
                                          {renderMyFinanceBrokerageShip(dbId, booking)}
                                      </td>
                                      <td className="border-r border-gray-100 bg-emerald-50/10 align-middle">{renderMoneyInput(dbId, booking, 'docFee', '操作费')}</td>
                                      {/* 新增：祥泰字段 */}
                                      <td className="border-r border-gray-100 bg-purple-50/10 align-middle">
                                          {renderMoneyInput(dbId, booking, 'xiangTai', '祥泰')}
                                      </td>
                                      {/* 修改净利计算，减去祥泰字段的值 */}
                                      <td className="border-r border-gray-100 bg-emerald-100/20 align-middle">
                                          {isValid(f.receivable) && isValid(f.payable)
                                              ? (() => {
                                                  const payableVal = f.payable || 0;
                                                  const diff = f.receivable! - payableVal;
                                                  const net = diff - (f.brokerage || 0) - (f.docFee || 0) - (f.brokerageShip || 0) - (f.freeCost || 0) - (f.xiangTai || 0);
                                                  return renderMoneyInput(dbId, { ...booking, finance: { ...f, netProfit: net } }, 'netProfit', '净利', true);
                                              })()
                                              : <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>
                                          }
                                      </td>
                                      {/* 新增：已开票相关列 */}
                                      <td className="border-r border-gray-100 bg-green-50/10 align-middle">
                                          {renderInvoicedStatus(dbId, booking)}
                                      </td>
                                      {/* 新增：财务备注字段 */}
                                      <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                          <input 
                                              disabled={f.isLocked && !canLock}
                                              value={f.financeRemark || ''} 
                                              onChange={(e) => {
                                                  if (!canUpdate) return;
                                                  if (f.isLocked && !canLock) {
                                                      alert("该记录已锁定。");
                                                      return;
                                                  }
                                                  
                                                  // 直接更新finance对象
                                                  const updatedBooking = {
                                                      ...booking,
                                                      finance: {
                                                          ...f,
                                                          financeRemark: e.target.value
                                                      }
                                                  };
                                                  
                                                  onUpdateBooking(dbId, updatedBooking);
                                              }}
                                              className={`w-full h-full bg-transparent px-2 py-0.5 text-[11px] outline-none focus:bg-yellow-50 text-center flex items-center justify-center ${
                                            f.financeRemark 
                                              ? 'text-red-600 font-medium'  // 有内容时红色高亮
                                              : 'text-gray-300'  // 无内容时灰色
                                          }`}
                                          placeholder="-"
                                          title={f.financeRemark || '财务备注'}  // 添加悬停提示
                                        />
                                      </td>
                                      {visibleColumns.invoicedNumber && (
                                          <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                              {renderInvoiceNumber(booking)}
                                          </td>
                                      )}
                                </>}

                                {variant === 'SAF_FINANCE' && <>
                                      <td className="border-r border-gray-100 bg-red-50/10 align-middle">{renderMoneyInput(dbId, booking, 'realAP', '实际应付')}</td>
                                      <td className="border-r border-gray-100 bg-red-50/10 align-middle">{renderMoneyInput(dbId, booking, 'ffeP', '应付(FFE)')}</td>
                                      <td className="border-r border-gray-100 bg-orange-50/10 align-middle">{renderMoneyInput(dbId, booking, 'handlingFee', '操作费')}</td>
                                      <td className="border-r border-gray-100 bg-red-100/20 align-middle">
                                          {(() => {
                                              const calculatedPayable = ((f.ffeP||0) + (f.handlingFee||0)) * qty;
                                              if (!isValid(f.ffeP) && !isValid(f.handlingFee)) {
                                                  return <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>;
                                              }
                                              return renderMoneyInput(dbId, { ...booking, finance: { ...f, payable: calculatedPayable } }, 'payable', '应付', true, undefined);
                                          })()}
                                      </td>
                                      <td className="border-r border-gray-100 bg-green-50/10 align-middle">{renderMoneyInput(dbId, booking, 'receivable', '应收')}</td>
                                      <td className="border-r border-gray-100 bg-blue-50/10 align-middle">
                                          {isValid(f.comm) 
                                              ? renderMoneyInput(dbId, booking, 'comm', '佣金', true, undefined, "text-gray-900 font-bold", true)
                                              : <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>
                                          }
                                      </td>
                                      <td className="border-r border-gray-100 bg-blue-100/20 align-middle">
                                          {isValid(f.sComm) 
                                              ? renderMoneyInput(dbId, booking, 'sComm', '船东佣金', true, undefined, "text-gray-900 font-bold", true)
                                              : <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>
                                          }
                                      </td>
                                </>}

                                {variant === 'CMA_FINANCE' && <>
                                      <td className="border-r border-gray-100 bg-red-50/10 align-middle">{renderMoneyInput(dbId, booking, 'ffeP', '应付(FFE)')}</td>
                                      <td className="border-r border-gray-100 bg-indigo-50/10 align-middle">{renderMoneyInput(dbId, booking, 'sccfi', 'SCCFI')}</td>
                                      <td className="border-r border-gray-100 bg-orange-50/10 align-middle">{renderMoneyInput(dbId, booking, 'brokerage', '佣金', false, null, "text-gray-900 font-bold")}</td>
                                      <td className="border-r border-gray-100 bg-emerald-100/20 align-middle">
                                          {isValid(f.brokerageShip) 
                                              ? renderMoneyInput(dbId, booking, 'brokerageShip', '船东佣金', true, null, "text-gray-900 font-bold", true)
                                              : <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>
                                          }
                                      </td>
                                      {/* 新增：合约方字段 */}
                                      <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                        <ExpandableCell value={booking.contact || ''} className="text-[11px] bg-purple-50/10 rounded" />
                                      </td>
                                </>}

                                {variant === 'CONCORD_FINANCE' && <>
                                      <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                        {/* 直接使用原始日期字符串 */}
                                        <ExpandableCell value={booking.gateIn || ''} className="text-[11px] text-gray-500 font-mono" />
                                      </td>
                                      <td className="border-r border-gray-100 bg-red-50/10 align-middle">{renderMoneyInput(dbId, booking, 'unitReceivable', '应收(FFE)')}</td>
                                      <td className="border-r border-gray-100 bg-red-100/20 align-middle">
                                          {(() => {
                                              const calculatedReceivable = (f.unitReceivable||0) * qty;
                                              if (!isValid(f.unitReceivable)) {
                                                  return <div className="px-2 py-1 text-center font-mono text-[11px] text-gray-300 flex items-center justify-center h-full">-</div>;
                                              }
                                              return renderMoneyInput(dbId, { ...booking, finance: { ...f, receivable: calculatedReceivable } }, 'receivable', '应收', true, undefined);
                                          })()}
                                      </td>
                                      <td className="border-r border-gray-100 bg-green-100/20 align-middle">{renderMoneyInput(dbId, booking, 'finalAR', '最终应付')}</td>
                                </>}

                                {/* 修改：将备注字段改为可点击展开的单元格 */}
                                {visibleColumns.remark && (
                                    <td className="px-2 py-0.5 border-r border-gray-100 align-middle">
                                        <ExpandableCell value={booking.remark || ''} className="text-[11px] text-gray-600 italic" />
                                    </td>
                                )}
                            </tr>
                        );
                    })
                  )}
              </tbody>
          </table>
      </div>
      
      {/* 4. 分页控件 - 确保始终显示（如果有数据） */}
      {filteredAllData.length > 0 && <PaginationControls />}
    </div>
  );
});