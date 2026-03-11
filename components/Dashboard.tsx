import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Booking, BookingState, Database } from '../types';
import { analyzeBookingData } from '../services/geminiService';
import { Button } from './Button';
import { apiService } from '../services/apiService';
import { 
  Sparkles, Loader2, TrendingUp, Package, Clock, Users, Ship, Anchor, X, 
  ArrowUpRight, Database as DbIcon, ChevronRight, Filter, RefreshCw, BarChart3, Calendar,
  AlertCircle, CheckCircle, FileText, Info, Table, Eye, Layers, Calendar as CalendarIcon,
  MapPin, Box, ChevronLeft, ChevronDown, ChevronUp, Hash, Grid, List, BookOpen
} from 'lucide-react';

// 导入日期工具函数
import { getWeekLabel, formatDateForDisplay, formatDateForInput } from '../utils/dateUtils';

// 导入新的工具组件
import { AllocationWithTooltip } from './AllocationWithTooltip';

// --- Types ---
interface DashboardProps {
  databases: Database[];
  allocations?: any[]; // 添加分配项数据
}

interface KPIProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: any;
  gradient?: string;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
}

// 新类型：扩展的数据库信息，包含实际预订数据
interface DatabaseWithStats extends Database {
  bookings: Booking[];
  isLoading: boolean;
  stats?: {
    totalVolume: number;
    pendingCount: number;
    confirmedCount: number;
    topClient: string;
  };
}

// --- 非已确认预订详情类型 ---
interface NonConfirmedBookingDetail {
  week: string;
  service: string;
  bookings: Array<{
    id: string;
    bookingRef: string; // 添加 BOOKING REF 字段
    pol: string;
    pod: string;
    etd: string;
    vessel: string;
    qty: number;
    type: string;
    allocation?: string;
    allocationNote?: string; // 添加分配项备注字段
    state: string;
  }>;
}

// --- KPI Component ---
const KPI: React.FC<KPIProps> = ({ title, value, sub, icon: Icon, onClick, className, gradient, isActive }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden bg-white p-3 rounded-xl border transition-all hover:shadow-md group ${className || ''} ${isActive ? 'ring-2 ring-amber-500 border-amber-500' : 'border-gray-100 shadow-sm'}`}
  >
    <div className="relative z-10 flex justify-between items-start">
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{title}</p>
        <h3 className="text-xl font-bold text-gray-800 tracking-tight">{value}</h3>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><ArrowUpRight className="w-2.5 h-2.5 text-green-500"/> {sub}</p>}
      </div>
      <div className={`p-2 rounded-lg ${gradient} text-white shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <Icon className="absolute -bottom-2 -right-2 w-12 h-12 text-gray-5 opacity-[0.08] z-0 transform -rotate-12" />
  </div>
);

// --- 非已确认详情模态框组件 ---
const NonConfirmedBookingDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  details: NonConfirmedBookingDetail | null;
  allocations?: any[]; // 添加分配项参数
}> = ({ isOpen, onClose, details, allocations = [] }) => {
  if (!isOpen || !details) return null;

  const { week, service, bookings } = details;

  // 根据分配值查找分配项对象
  const getAllocationObject = (allocationValue?: string) => {
    if (!allocationValue) return null;
    return allocations.find(a => a.value === allocationValue) || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl 
        w-full max-w-full
        sm:max-w-md
        md:max-w-4xl 
        lg:max-w-5xl 
        xl:max-w-6xl 
        max-h-[calc(100vh-1rem)] 
        sm:max-h-[90vh]
        overflow-hidden flex flex-col 
        mx-auto"
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 sm:p-6 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">未分配详情</h3>
            <p className="text-sm sm:text-sm text-gray-500 mt-1 truncate">
              周次: <span className="font-medium text-gray-700">{week}</span> • 
              服务: <span className="font-medium text-gray-700">{service}</span> • 
              共 <span className="font-medium text-amber-600">{bookings.length}</span> 条记录
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-6">
          {/* 手机端：使用垂直卡片布局 */}
          <div className="sm:hidden">
            {bookings.map((booking, index) => {
              const allocationObj = getAllocationObject(booking.allocation);
              
              return (
                <div key={booking.id} className="mb-4 p-3 border border-gray-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">BOOKING REF</div>
                      <div className="text-sm font-semibold font-mono truncate">
                        {booking.bookingRef || booking.id.substring(0, 8)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">状态</div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded inline-block ${
                        booking.state === BookingState.PENDING 
                          ? 'bg-amber-100 text-amber-800' 
                          : booking.state === 'ROLLED'
                          ? 'bg-red-100 text-red-800'
                          : booking.state === BookingState.CONFIRMED
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.state === BookingState.PENDING ? '待处理' : 
                         booking.state === 'ROLLED' ? '已退回' :
                         booking.state === BookingState.CONFIRMED ? '已确认' : booking.state}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">POL</div>
                      <div className="font-medium">{booking.pol || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">POD</div>
                      <div className="font-medium">{booking.pod || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">QTY</div>
                      <div className="font-medium">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                          {booking.qty}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">ETD</div>
                      <div className="text-xs">{booking.etd ? formatDateForDisplay(booking.etd) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">TYPE</div>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {booking.type || '-'}
                      </span>
                    </div>
                  </div>

                  {/* 新增：手机端分配信息显示 */}
                  <div className="mt-2 text-sm">
                    <div className="text-xs text-gray-500 mb-0.5">分配情况</div>
                    <div className="font-medium">
                      {allocationObj ? (
                        <div>
                          <div className="font-medium text-blue-800 text-sm">
                            {allocationObj.label || allocationObj.value}
                          </div>
                          {allocationObj.note && (
                            <div className="text-xs text-gray-600 mt-0.5">{allocationObj.note}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic"></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 中等屏幕以上：使用表格布局 */}
          <div className="hidden sm:block">
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> BOOKING REF
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> POL
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> POD
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" /> ETD
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> QTY
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3" /> TYPE
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> STATUS
                      </div>
                    </th>
                    {/* 新增 ALLOCATION 列 */}
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3 h-3" /> ALLOCATION
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking, index) => {
                    const allocationObj = getAllocationObject(booking.allocation);
                    
                    return (
                      <tr 
                        key={booking.id} 
                        className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-semibold">
                          {booking.bookingRef || booking.id.substring(0, 8)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                          {booking.pol || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                          {booking.pod || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                          {booking.etd ? formatDateForDisplay(booking.etd) : '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">
                            {booking.qty}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {booking.type || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                            booking.state === BookingState.PENDING 
                              ? 'bg-amber-100 text-amber-800' 
                              : booking.state === 'ROLLED'
                              ? 'bg-red-100 text-red-800'
                              : booking.state === BookingState.CONFIRMED
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.state === BookingState.PENDING ? '待处理' : 
                            booking.state === 'ROLLED' ? '已退回' :
                            booking.state === BookingState.CONFIRMED ? '已确认' : booking.state}
                          </span>
                        </td>
                        {/* 新增 ALLOCATION 单元格 - 只显示分配项名称，悬停显示备注 */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allocationObj ? (
                            <div className="relative group inline-block">
                              <span className="text-xs font-medium text-blue-800 cursor-default">
                                {allocationObj.label || allocationObj.value}
                              </span>
                              {allocationObj.note && (
                                <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap">
                                  {allocationObj.note}
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic"></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 手机端：使用垂直卡片布局 */}
          <div className="sm:hidden">
            {bookings.map((booking, index) => {
              const allocationObj = getAllocationObject(booking.allocation);
              
              return (
                <div key={booking.id} className="mb-3 p-2.5 border border-gray-200 rounded-lg text-xs">
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">BOOKING REF</div>
                      <div className="font-semibold font-mono truncate">
                        {booking.bookingRef || booking.id.substring(0, 8)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">状态</div>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded inline-block ${
                        booking.state === BookingState.PENDING 
                          ? 'bg-amber-100 text-amber-800' 
                          : booking.state === 'ROLLED'
                          ? 'bg-red-100 text-red-800'
                          : booking.state === BookingState.CONFIRMED
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {booking.state === BookingState.PENDING ? '待处理' : 
                        booking.state === 'ROLLED' ? '已退回' :
                        booking.state === BookingState.CONFIRMED ? '已确认' : booking.state}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">POL</div>
                      <div className="font-medium">{booking.pol || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">POD</div>
                      <div className="font-medium">{booking.pod || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">QTY</div>
                      <div className="font-medium">
                        <span className="px-1 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                          {booking.qty}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">ETD</div>
                      <div className="text-xs">{booking.etd ? formatDateForDisplay(booking.etd) : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">TYPE</div>
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        {booking.type || '-'}
                      </span>
                    </div>
                  </div>

                  {/* 新增：手机端分配信息显示 */}
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-0.5">分配情况</div>
                    <div className="font-medium">
                      {allocationObj ? (
                        <div>
                          <div className="font-medium text-blue-800 text-xs">
                            {allocationObj.label || allocationObj.value}
                          </div>
                          {allocationObj.note && (
                            <div className="text-xs text-gray-600 mt-0.5">{allocationObj.note}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic"></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {bookings.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">没有找到匹配的预订记录</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            显示 {bookings.length} 条记录 • 合计数量: {bookings.reduce((sum, b) => sum + b.qty, 0)}
          </div>
          <Button onClick={onClose} variant="secondary">
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Sub-Component: Detailed Analytics (完整的详细分析组件) ---
const DetailedAnalytics = ({ 
  databaseId, 
  dbName, 
  onBack,
  allocations = [] // 添加分配项参数
}: { 
  databaseId: string;
  dbName: string; 
  onBack: () => void;
  allocations?: any[];
}) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'carriers' | 'trends' | 'nonConfirmedDetails'>('overview');
  const [nonConfirmedDetail, setNonConfirmedDetail] = useState<NonConfirmedBookingDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // 筛选相关状态
  const [filterStartWeek, setFilterStartWeek] = useState<string>('');
  const [filterEndWeek, setFilterEndWeek] = useState<string>('');
  const [filterService, setFilterService] = useState<string>('');
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);

  // 加载该数据库的预订数据
  useEffect(() => {
    const loadDatabaseBookings = async () => {
      try {
        setIsLoadingBookings(true);
        const result = await apiService.getBookingsByDatabase(databaseId);
        if (result.success) {
          setBookings(result.bookings);
          console.log(`✅ 加载数据库 ${dbName} 的预订数据:`, result.bookings.length);
        }
      } catch (error) {
        console.error('加载数据库预订数据失败:', error);
      } finally {
        setIsLoadingBookings(false);
      }
    };

    if (databaseId) {
      loadDatabaseBookings();
    }
  }, [databaseId, dbName]);

  const getQty = (b: Booking): number => {
    const val = b.qty;
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? 1 : parsed;
  };

  // 根据分配值获取完整的分配信息
  const getAllocationWithNote = (allocationValue?: string) => {
    if (!allocationValue) return null;
    const allocation = allocations.find(a => a.value === allocationValue);
    return allocation || { value: allocationValue, note: '' };
  };

  // 使用所有预订数据
  const allBookings = useMemo(() => bookings, [bookings]);
  const confirmedBookings = useMemo(() => bookings.filter((b: Booking) => b.state === BookingState.CONFIRMED), [bookings]);
  const pendingCount = useMemo(() => bookings.filter((b: Booking) => b.state === BookingState.PENDING).length, [bookings]);
  const rolledCount = useMemo(() => bookings.filter((b: Booking) => b.state === 'ROLLED').length, [bookings]);

  // 计算总数量
  const totalVolume = useMemo(() => allBookings.reduce((acc: number, b: Booking) => acc + getQty(b), 0), [allBookings]);

  // 计算FFE
  const totalFFE = useMemo(() => {
    return allBookings.reduce((acc: number, curr: Booking) => {
      const type = (curr.type || '').toUpperCase();
      const qty = getQty(curr);
      const factor = type.includes('20') ? 0.5 : 1;
      return acc + (factor * qty);
    }, 0);
  }, [allBookings]);

  // 计算客户统计 - 修复：过滤空客户和无效值
  const clientStats = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    
    allBookings.forEach((b: Booking) => {
      // 过滤掉空客户和无效客户
      if (!b.client || b.client.trim() === '' || b.client.toLowerCase() === 'unknown' || b.client === '未知') {
        return; // 跳过没有客户信息的记录
      }
      
      const qty = getQty(b);
      const client = b.client.trim();
      counts[client] = (counts[client] || 0) + qty;
      total += qty;
    });
    
    // 如果没有有效的客户数据，返回空数组
    if (Object.keys(counts).length === 0) {
      return [];
    }
    
    return Object.entries(counts)
      .map(([name, count]) => ({ 
        name, 
        count, 
        percent: total > 0 ? (count / total) * 100 : 0 
      }))
      .sort((a, b) => b.count - a.count);
  }, [allBookings]);

  const topClientName = clientStats.length > 0 ? clientStats[0].name : '暂无客户数据';

  // 计算趋势数据（全部预订）- 使用统一的 getWeekLabel 函数
  const trendData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    allBookings.forEach((booking: Booking) => {
      let label = booking.week || getWeekLabel(booking.etd) || '无周数';
      const wk = label;
      const svc = booking.service || 'Unknown';
      const qty = getQty(booking);
      if (!grouped[wk]) grouped[wk] = { total: 0 };
      grouped[wk][svc] = (grouped[wk][svc] || 0) + qty;
    });
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(week => ({ week, ...grouped[week] }));
  }, [allBookings]);

  // 计算已确认的趋势数据 - 使用统一的 getWeekLabel 函数
  const confirmedTrendData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    confirmedBookings.forEach((booking: Booking) => {
      let label = booking.week || getWeekLabel(booking.etd) || '无周数';
      const wk = label;
      const svc = booking.service || 'Unknown';
      const qty = getQty(booking);
      if (!grouped[wk]) grouped[wk] = { total: 0 };
      grouped[wk][svc] = (grouped[wk][svc] || 0) + qty;
    });
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(week => ({ week, ...grouped[week] }));
  }, [confirmedBookings]);

  // 获取可用的周次列表
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    confirmedTrendData.forEach(item => {
      if (item.week && item.week !== '无周数') {
        weeks.add(item.week);
      }
    });
    return Array.from(weeks).sort((a, b) => a.localeCompare(b));
  }, [confirmedTrendData]);

  // 获取可用的航线列表
  const availableServices = useMemo(() => {
    const servicesSet = new Set<string>();
    confirmedBookings.forEach(booking => {
      if (booking.service && booking.service !== 'Unknown') {
        servicesSet.add(booking.service);
      }
    });
    return Array.from(servicesSet).sort();
  }, [confirmedBookings]);

  // 计算非已确认的预订
  const nonConfirmedBookings = useMemo(() => 
    bookings.filter((b: Booking) => b.state === BookingState.PENDING), 
    [bookings]
  );

  // 计算非已确认的趋势数据 - 使用统一的 getWeekLabel 函数
  const nonConfirmedTrendData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    nonConfirmedBookings.forEach((booking: Booking) => {
      let label = booking.week || getWeekLabel(booking.etd) || '无周数';
      const wk = label;
      const svc = booking.service || 'Unknown';
      const qty = getQty(booking);
      if (!grouped[wk]) grouped[wk] = { total: 0 };
      grouped[wk][svc] = (grouped[wk][svc] || 0) + qty;
    });
    return Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(week => ({ week, ...grouped[week] }));
  }, [nonConfirmedBookings]);

  // 按周次和服务类型组织的非已确认预订数据
  const nonConfirmedGroupedData = useMemo(() => {
    const grouped: Record<string, Record<string, NonConfirmedBookingDetail>> = {};
    
    nonConfirmedBookings.forEach((booking: Booking) => {
      const week = booking.week || getWeekLabel(booking.etd) || '无周数';
      const service = booking.service || 'Unknown';
      const allocationData = getAllocationWithNote(booking.allocation);
      
      if (!grouped[week]) grouped[week] = {};
      if (!grouped[week][service]) {
        grouped[week][service] = {
          week,
          service,
          bookings: []
        };
      }
      
      // 使用 booking.ref 或 booking.id 作为 BOOKING REF
      grouped[week][service].bookings.push({
        id: booking.id,
        bookingRef: booking.bookingRef || booking.id, // 优先使用 booking.ref，如果没有则使用 booking.id
        pol: booking.pol || '',
        pod: booking.pod || '',
        etd: booking.etd || '',
        vessel: booking.vessel || '',
        qty: getQty(booking),
        type: booking.type || '',
        allocation: booking.allocation || '',
        allocationNote: allocationData?.note || '', // 添加分配项备注
        state: booking.state || ''
      });
    });
    
    return grouped;
  }, [nonConfirmedBookings, allocations]);

  // 计算承运商统计
  const carrierData = useMemo(() => {
    const counts: Record<string, number> = {};
    allBookings.forEach((b: Booking) => {
      const c = b.carrier || 'Unknown';
      const qty = getQty(b);
      counts[c] = (counts[c] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [allBookings]);

  // 计算POD统计
  const podData = useMemo(() => {
    const counts: Record<string, number> = {};
    allBookings.forEach((b: Booking) => {
      const p = b.pod || 'Unknown';
      const qty = getQty(b);
      counts[p] = (counts[p] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [allBookings]);

  // 计算POL统计
  const polData = useMemo(() => {
    const counts: Record<string, number> = {};
    allBookings.forEach((b: Booking) => {
      const p = b.pol || 'Unknown';
      const qty = getQty(b);
      counts[p] = (counts[p] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [allBookings]);

  const services = useMemo(() => {
    const s = new Set<string>();
    allBookings.forEach((b: Booking) => { if(b.service) s.add(b.service); });
    return Array.from(s).sort();
  }, [allBookings]);

  // 获取非已确认的服务类型
  const nonConfirmedServices = useMemo(() => {
    const s = new Set<string>();
    nonConfirmedBookings.forEach((b: Booking) => { 
      if(b.service) s.add(b.service); 
    });
    return Array.from(s).sort();
  }, [nonConfirmedBookings]);

  const containerTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    allBookings.forEach((b: Booking) => {
      const type = b.type || 'Unknown';
      const qty = getQty(b);
      counts[type] = (counts[type] || 0) + qty;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [allBookings]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
  const PIE_COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f43f5e', '#a855f7', '#14b8a6', '#8b5cf6'];

  const handleGenerateInsight = async () => {
    setInsightLoading(true);
    try {
      const result = await analyzeBookingData(confirmedBookings);
      setInsight(result);
    } catch (error) {
      console.error('生成AI分析失败:', error);
      setInsight('无法生成AI分析，请稍后重试。');
    } finally {
      setInsightLoading(false);
    }
  };

  // 处理非已确认柱状图点击事件
  const handleNonConfirmedBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const week = data.activePayload[0].payload.week;
      const service = data.activePayload[0].dataKey;
      
      const weekData = nonConfirmedGroupedData[week];
      if (weekData && weekData[service]) {
        setNonConfirmedDetail(weekData[service]);
        setIsDetailModalOpen(true);
      }
    }
  };

  // 切换周次展开状态
  const toggleWeekExpansion = (week: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(week)) {
        newSet.delete(week);
      } else {
        newSet.add(week);
      }
      return newSet;
    });
  };

  // 查看服务详情
  const viewServiceDetails = (week: string, service: string) => {
    const weekData = nonConfirmedGroupedData[week];
    if (weekData && weekData[service]) {
      setNonConfirmedDetail(weekData[service]);
      setIsDetailModalOpen(true);
    }
  };

  // 计算筛选后的总量
  const calculateFilteredTotal = () => {
    if (!filterStartWeek || !filterEndWeek) {
      setFilteredTotal(null);
      return;
    }
    
    let total = 0;
    
    // 遍历已确认的趋势数据
    confirmedTrendData.forEach(weekData => {
      const week = weekData.week;
      
      // 检查周次是否在筛选范围内
      const weekIndex = availableWeeks.indexOf(week);
      const startIndex = availableWeeks.indexOf(filterStartWeek);
      const endIndex = availableWeeks.indexOf(filterEndWeek);
      
      if (weekIndex >= startIndex && weekIndex <= endIndex) {
        if (filterService) {
          // 如果指定了航线，只计算该航线的数量
          total += weekData[filterService] || 0;
        } else {
          // 否则计算所有航线的总和
          Object.keys(weekData).forEach(key => {
            if (key !== 'week' && key !== 'total') {
              total += weekData[key] || 0;
            }
          });
        }
      }
    });
    
    setFilteredTotal(total);
  };

  // 重置筛选
  const resetFilter = () => {
    setFilterStartWeek('');
    setFilterEndWeek('');
    setFilterService('');
    setFilteredTotal(null);
  };

  // 当筛选条件变化时重新计算
  useEffect(() => {
    if (filterStartWeek && filterEndWeek) {
      calculateFilteredTotal();
    } else {
      setFilteredTotal(null);
    }
  }, [filterStartWeek, filterEndWeek, filterService, confirmedTrendData]);

  if (isLoadingBookings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-gray-500">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={onBack} className="h-8 px-3">
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回概览
          </Button>
          <div>
            {/* <h2 className="text-xl font-bold text-gray-900 tracking-tight">{dbName} - 详细分析</h2> */}
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <DbIcon className="w-3.5 h-3.5" />
              数据库ID: <span className="text-[14px] font-bold text-gray-900 tracking-tight">{databaseId}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
            <FileText className="w-4 h-4" />
            <span>共 <span className="font-bold text-gray-800">{bookings.length}</span> 条记录</span>
          </div>
          
          <Button 
            size="sm" 
            onClick={handleGenerateInsight} 
            disabled={insightLoading || confirmedBookings.length === 0} 
            className="shadow-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border-0 text-white px-3 py-1.5 h-8"
          >
            {insightLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            AI分析
          </Button>
        </div>
      </div>

      {/* AI Insight */}
      {insight && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-16 h-16 text-indigo-500"/>
          </div>
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2 text-indigo-800 relative z-10 text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Gemini AI分析
            </h3>
            <button 
              onClick={() => setInsight(null)} 
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="whitespace-pre-line leading-relaxed text-gray-700 text-sm relative z-10">
            {insight}
          </p>
        </div>
      )}

      {/* 状态概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">总预订量</p>
              <p className="text-2xl font-bold text-gray-900">{totalVolume}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">总集装箱数量</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">已确认</p>
              <p className="text-2xl font-bold text-emerald-700">{confirmedBookings.length}</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">已完成确认的预订</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">待处理</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">等待确认的预订</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">最大客户</p>
              <p className="text-lg font-bold text-gray-900 truncate">{topClientName}</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">预订量最高的客户</p>
        </div>
      </div>

      {/* 选项卡 */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            概览
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'clients'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            客户分析
          </button>
          <button
            onClick={() => setActiveTab('carriers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'carriers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            承运商分析
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            趋势分析
          </button>
          <button
            onClick={() => setActiveTab('nonConfirmedDetails')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'nonConfirmedDetails'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            未确认详情
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 承运商占比 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Ship className="w-4 h-4 text-gray-400" />
                承运商占比
              </h3>
              <div className="h-64">
                {carrierData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={carrierData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60} 
                        outerRadius={80} 
                        paddingAngle={2} 
                        dataKey="value" 
                        stroke="none"
                      >
                        {carrierData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '8px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                          fontSize: '12px', 
                          padding: '8px' 
                        }} 
                      />
                      <Legend 
                        wrapperStyle={{ 
                          paddingTop: '10px', 
                          fontSize: '11px' 
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <Info className="w-5 h-5 mr-2" />
                    暂无承运商数据
                  </div>
                )}
              </div>
            </div>

            {/* 集装箱类型分布 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                集装箱类型分布
              </h3>
              <div className="space-y-3">
                {containerTypes.map((type, idx) => (
                  <div key={type.name} className="relative group">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">{type.name}</span>
                      <span className="text-gray-500 font-mono">{type.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" 
                        style={{ 
                          width: `${(type.value / (containerTypes[0]?.value || 1)) * 100}%`, 
                          opacity: 1 - (idx * 0.1) 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                {containerTypes.length === 0 && (
                  <p className="text-sm text-gray-400 italic text-center py-8">
                    暂无集装箱类型数据
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="space-y-6">
            {/* 客户排名 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  客户排名 (按预订量)
                </span>
                <span className="text-xs font-normal text-gray-500">
                  共 {clientStats.length} 个客户
                </span>
              </h3>
              <div className="space-y-4">
                {clientStats.slice(0, 10).map((stat, index) => (
                  <div key={stat.name} className="group hover:bg-gray-50 p-3 rounded-lg transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold
                          ${index === 0 ? 'bg-amber-100 text-amber-800' : 
                            index === 1 ? 'bg-gray-100 text-gray-800' : 
                            index === 2 ? 'bg-orange-100 text-orange-800' : 
                            'bg-blue-50 text-blue-700'}
                        `}>
                          {index + 1}
                        </div>
                        {/* 统一字体大小：所有客户名称统一使用 text-sm */}
                        <span className="font-medium text-gray-900 text-sm">
                          {stat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">{stat.count}</span>
                        <span className="text-xs text-gray-500">
                          ({stat.percent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          index === 0 ? 'bg-amber-500' : 
                          index === 1 ? 'bg-gray-500' : 
                          index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                        }`} 
                        style={{ width: `${stat.percent}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
                {clientStats.length === 0 && (
                  <p className="text-center text-gray-500 py-8 text-sm">
                    暂无客户数据
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'carriers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 承运商详细统计 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Ship className="w-4 h-4 text-gray-400" />
                承运商详细统计
              </h3>
              <div className="space-y-4">
                {carrierData.map((carrier, idx) => (
                  <div key={carrier.name} className="group hover:bg-gray-50 p-3 rounded-lg transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-50">
                          <Ship className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{carrier.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{carrier.value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ 
                          width: `${(carrier.value / (carrierData[0]?.value || 1)) * 100}%`,
                          opacity: 1 - (idx * 0.15)
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                {carrierData.length === 0 && (
                  <p className="text-center text-gray-500 py-8 text-sm">
                    暂无承运商数据
                  </p>
                )}
              </div>
            </div>

            {/* 港口统计 */}
            <div className="space-y-6">
              {/* POL统计 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-gray-400" />
                  起运港 (POL) 排名
                </h3>
                <div className="space-y-3">
                  {polData.map((pol, idx) => (
                    <div key={pol.name} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{pol.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{pol.value}</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(pol.value / (polData[0]?.value || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* POD统计 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-gray-400" />
                  目的港 (POD) 排名
                </h3>
                <div className="space-y-3">
                  {podData.map((pod, idx) => (
                    <div key={pod.name} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">{pod.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{pod.value}</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(pod.value / (podData[0]?.value || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* 状态分布卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">已确认</p>
                    <p className="text-2xl font-bold text-emerald-700">{confirmedBookings.length}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ 
                      width: `${bookings.length > 0 ? (confirmedBookings.length / bookings.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">待处理</p>
                    <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ 
                      width: `${bookings.length > 0 ? (pendingCount / bookings.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">已退回</p>
                    <p className="text-2xl font-bold text-red-600">{rolledCount}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <div className="mt-4 w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full"
                    style={{ 
                      width: `${bookings.length > 0 ? (rolledCount / bookings.length) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 双趋势图表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 已确认的周度趋势图表 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    已确认 - 周度预订趋势
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                    {confirmedBookings.length} 条记录
                  </span>
                </div>
                <div className="h-72">
                  {confirmedTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={confirmedTrendData} 
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="week" 
                          stroke="#9ca3af" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          allowDecimals={false} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            borderRadius: '8px', 
                            border: 'none', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                            fontSize: '12px', 
                            padding: '12px' 
                          }} 
                          cursor={{ fill: '#f3f4f6', radius: 4 }} 
                        />
                        <Legend 
                          iconType="circle" 
                          wrapperStyle={{ 
                            paddingTop: '10px', 
                            fontSize: '12px' 
                          }} 
                        />
                        {services.map((svc, index) => (
                          <Bar 
                            key={svc} 
                            dataKey={svc} 
                            fill={COLORS[index % COLORS.length]} 
                            radius={[4, 4, 0, 0]} 
                            barSize={16} 
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <CheckCircle className="w-8 h-8 mb-2 text-gray-300" />
                      <p className="text-sm">暂无已确认的预订趋势数据</p>
                    </div>
                  )}
                </div>
                
                {/* 周次区间筛选功能 */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">周次区间筛选</h4>
                    <button
                      onClick={resetFilter}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重置
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 起始周 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        起始周次
                      </label>
                      <select
                        value={filterStartWeek}
                        onChange={(e) => setFilterStartWeek(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">选择起始周</option>
                        {availableWeeks.map(week => (
                          <option key={`start-${week}`} value={week}>{week}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* 结束周 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        结束周次
                      </label>
                      <select
                        value={filterEndWeek}
                        onChange={(e) => setFilterEndWeek(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={!filterStartWeek}
                      >
                        <option value="">选择结束周</option>
                        {availableWeeks
                          .filter(week => {
                            if (!filterStartWeek) return true;
                            const startIndex = availableWeeks.indexOf(filterStartWeek);
                            const weekIndex = availableWeeks.indexOf(week);
                            return weekIndex >= startIndex;
                          })
                          .map(week => (
                            <option key={`end-${week}`} value={week}>{week}</option>
                          ))
                        }
                      </select>
                    </div>
                    
                    {/* 航线筛选 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        航线筛选（可选）
                      </label>
                      <select
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">全部航线</option>
                        {availableServices.map(service => (
                          <option key={`service-${service}`} value={service}>{service}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {/* 结果显示 */}
                  {(filterStartWeek && filterEndWeek) && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-600 font-medium mb-1">
                            筛选结果统计
                          </p>
                          <p className="text-sm text-gray-700">
                            周次区间: <span className="font-semibold">{filterStartWeek}</span> 至 <span className="font-semibold">{filterEndWeek}</span>
                            {filterService && (
                              <> • 航线: <span className="font-semibold">{filterService}</span></>
                            )}
                          </p>
                        </div>
                        
                        {filteredTotal !== null && (
                          <div className="text-right">
                            <p className="text-xs text-blue-600 font-medium mb-1">总量合计</p>
                            <p className="text-2xl font-bold text-blue-700">{filteredTotal}</p>
                          </div>
                        )}
                      </div>
                      
                      {filteredTotal === null && (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
                          <span className="text-sm text-gray-500">计算中...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 筛选提示 */}
                  <div className="mt-3 text-xs text-gray-500 flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>选择起始周和结束周，可查看该周次区间内的预订总量。可额外选择特定航线进行筛选。</span>
                  </div>
                </div>
              </div>

              {/* 非已确认的周度趋势图表（修改为与已确认相同的布局） */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    未确认 - 周度预订趋势
                  </h3>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {nonConfirmedBookings.length} 条记录
                  </span>
                </div>
                
                <div className="h-72">
                  {nonConfirmedTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={nonConfirmedTrendData} 
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        onClick={handleNonConfirmedBarClick}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="week" 
                          stroke="#9ca3af" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          allowDecimals={false} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            borderRadius: '8px', 
                            border: 'none', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                            fontSize: '12px', 
                            padding: '12px' 
                          }} 
                          cursor={{ fill: '#f3f4f6', radius: 4 }} 
                        />
                        <Legend 
                          iconType="circle" 
                          wrapperStyle={{ 
                            paddingTop: '10px', 
                            fontSize: '12px' 
                          }} 
                        />
                        {nonConfirmedServices.map((svc, index) => (
                          <Bar 
                            key={svc} 
                            dataKey={svc} 
                            fill={COLORS[index % COLORS.length]} 
                            radius={[4, 4, 0, 0]} 
                            barSize={16} 
                            cursor="pointer"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <AlertCircle className="w-8 h-8 mb-2 text-gray-300" />
                      <p className="text-sm">暂无未确认的预订趋势数据</p>
                    </div>
                  )}
                </div>
                
                {/* 点击提示 */}
                <div className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    提示：点击柱状图可查看该周次和服务的详细预订列表
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nonConfirmedDetails' && (
          <div className="space-y-6">
            {/* 非已确认详细列表视图 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <List className="w-4 h-4 text-amber-500" />
                  未确认 - 详细预订详情 (按周次和服务)
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {Object.keys(nonConfirmedGroupedData).length} 个周次
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {nonConfirmedBookings.length} 条记录
                  </span>
                </div>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {Object.keys(nonConfirmedGroupedData).sort((a, b) => a.localeCompare(b)).map((week) => (
                  <div key={week} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div 
                      className="bg-gray-50 hover:bg-gray-100 p-4 cursor-pointer flex justify-between items-center"
                      onClick={() => toggleWeekExpansion(week)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedWeeks.has(week) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-medium text-gray-900">周次: {week}</span>
                        <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                          {Object.keys(nonConfirmedGroupedData[week]).length} 个服务
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        总记录: {Object.values(nonConfirmedGroupedData[week]).reduce((sum, service) => sum + service.bookings.length, 0)}
                      </div>
                    </div>
                    
                    {expandedWeeks.has(week) && (
                      <div className="p-4 bg-white border-t border-gray-200">
                        {Object.keys(nonConfirmedGroupedData[week]).sort().map((service) => {
                          const serviceData = nonConfirmedGroupedData[week][service];
                          return (
                            <div key={service} className="mb-4 last:mb-0 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800">服务: {service}</span>
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {serviceData.bookings.length} 条记录
                                  </span>
                                </div>
                                <button
                                  onClick={() => viewServiceDetails(week, service)}
                                  className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                  查看详情
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">集装箱类型</div>
                                  <div className="font-medium">
                                    {Array.from(new Set(serviceData.bookings.map(b => b.type))).join(', ') || '-'}
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">主要POL</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const polCounts: Record<string, number> = {};
                                      serviceData.bookings.forEach(b => {
                                        if (b.pol) polCounts[b.pol] = (polCounts[b.pol] || 0) + b.qty;
                                      });
                                      const topPol = Object.entries(polCounts).sort((a, b) => b[1] - a[1])[0];
                                      return topPol ? topPol[0] : '-';
                                    })()}
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">主要POD</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const podCounts: Record<string, number> = {};
                                      serviceData.bookings.forEach(b => {
                                        if (b.pod) podCounts[b.pod] = (podCounts[b.pod] || 0) + b.qty;
                                      });
                                      const topPod = Object.entries(podCounts).sort((a, b) => b[1] - a[1])[0];
                                      return topPod ? topPod[0] : '-';
                                    })()}
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">总数量</div>
                                  <div className="font-medium text-amber-700">
                                    {serviceData.bookings.reduce((sum, b) => sum + b.qty, 0)}
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">状态分布</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const stateCounts: Record<string, number> = {};
                                      serviceData.bookings.forEach(b => {
                                        stateCounts[b.state] = (stateCounts[b.state] || 0) + 1;
                                      });
                                      return Object.entries(stateCounts).map(([state, count]) => 
                                        state === BookingState.PENDING ? `${count}待处理` : 
                                        state === 'ROLLED' ? `${count}已退回` : `${count}${state}`
                                      ).join(', ');
                                    })()}
                                  </div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <div className="text-gray-500">分配情况</div>
                                  <div className="font-medium">
                                    {(() => {
                                      const hasAllocation = serviceData.bookings.some(b => b.allocation);
                                      const allocationsWithNotes = serviceData.bookings
                                        .filter(b => b.allocation)
                                        .map(b => getAllocationWithNote(b.allocation))
                                        .filter(a => a?.note);
                                      return hasAllocation ? 
                                        (allocationsWithNotes.length > 0 ? '部分已分配（有备注）' : '部分已分配') : 
                                        '未分配';
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                
                {Object.keys(nonConfirmedGroupedData).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>暂无未确认的预订数据</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 非已确认预订详情模态框 */}
      <NonConfirmedBookingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setNonConfirmedDetail(null);
        }}
        details={nonConfirmedDetail}
        allocations={allocations}
      />
    </div>
  );
};

// --- Sub-Component: Summary Card (Overview List Item) ---
const DbSummaryCard: React.FC<{ 
  db: DatabaseWithStats; 
  onClick: () => void;
  onRefresh?: () => void;
}> = ({ db, onClick, onRefresh }) => {
  
  const stats = useMemo(() => {
    // 使用数据库的预订数据计算统计
    const allBookings = db.bookings || [];
    const locked = allBookings.filter((b: Booking) => b.state === BookingState.CONFIRMED);
    const pending = allBookings.filter((b: Booking) => b.state === BookingState.PENDING).length;
    
    // Total Volume
    const vol = allBookings.reduce((acc: number, b: Booking) => {
        const val = b.qty || 0;
        const parsed = parseInt(String(val), 10);
        return acc + (isNaN(parsed) ? 0 : parsed);
    }, 0);

    // Top Client - 修复：过滤空客户和无效值
    const clientCounts: Record<string, number> = {};
    allBookings.forEach((b: Booking) => {
        // 过滤掉空客户和无效客户
        if (!b.client || b.client.trim() === '' || b.client.toLowerCase() === 'unknown' || b.client === '未知') {
          return;
        }
        
        const client = b.client.trim();
        const qty = parseInt(String(b.qty || 0), 10) || 0;
        if (qty > 0) {
          clientCounts[client] = (clientCounts[client] || 0) + qty;
        }
    });
    
    const topClientEntry = Object.entries(clientCounts).sort((a,b) => b[1]-a[1])[0];
    const topClient = topClientEntry ? topClientEntry[0] : '暂无客户数据';

    return { 
      vol, 
      pending, 
      topClient: topClient,
      confirmedCount: locked.length
    };
  }, [db.bookings]);

  return (
    <div 
        onClick={onClick}
        className="relative bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 hover:ring-2 hover:ring-blue-50 transition-all cursor-pointer group flex flex-col justify-between h-40"
    >
      {db.isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <DbIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{db.name}</h3>
                    <p className="text-xs text-gray-500">{db.bookings?.length || 0} 条记录</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
              {onRefresh && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                  title="刷新数据"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 group-hover:text-blue-500">
                  <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-50">
            <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">总箱量</p>
                <p className="text-lg font-bold text-gray-800">{stats.vol}</p>
            </div>
            <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">待处理</p>
                <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
            </div>
            <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">已确认</p>
                <p className="text-lg font-bold text-emerald-600">{stats.confirmedCount}</p>
            </div>
            <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">最大客户</p>
                <p className="text-sm font-bold text-gray-700 truncate" title={stats.topClient}>{stats.topClient}</p>
            </div>
        </div>
    </div>
  );
};

// --- Main Dashboard Component ---
export const Dashboard: React.FC<DashboardProps> = ({ databases, allocations = [] }) => {
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [databasesWithStats, setDatabasesWithStats] = useState<DatabaseWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<any>(null);

  // 为每个数据库加载预订数据
  const loadDatabaseBookings = async (databaseId: string) => {
    try {
      const result = await apiService.getBookingsByDatabase(databaseId);
      if (result.success) {
        return result.bookings || [];
      }
      return [];
    } catch (error) {
      console.error(`加载数据库 ${databaseId} 预订数据失败:`, error);
      return [];
    }
  };

  // 初始化加载所有数据库的数据
  const loadAllDatabasesData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 获取全局统计数据
      const globalStatsResult = await apiService.getDashboardStats();
      if (globalStatsResult.success) {
        setGlobalStats(globalStatsResult);
      }

      // 2. 为每个数据库加载预订数据
      const databasesWithBookings = await Promise.all(
        databases.map(async (db) => {
          const bookings = await loadDatabaseBookings(db.id);
          return {
            ...db,
            bookings,
            isLoading: false,
            stats: {
              totalVolume: bookings.reduce((acc, b) => acc + (Number(b.qty) || 0), 0),
              pendingCount: bookings.filter(b => b.state === BookingState.PENDING).length,
              confirmedCount: bookings.filter(b => b.state === BookingState.CONFIRMED).length,
              topClient: (() => {
                const clientCounts: Record<string, number> = {};
                bookings.forEach(b => {
                  // 过滤掉空客户和无效客户
                  if (!b.client || b.client.trim() === '' || b.client.toLowerCase() === 'unknown' || b.client === '未知') {
                    return;
                  }
                  const client = b.client.trim();
                  const qty = Number(b.qty) || 1;
                  clientCounts[client] = (clientCounts[client] || 0) + qty;
                });
                const top = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0];
                return top ? top[0] : '暂无客户数据';
              })()
            }
          };
        })
      );

      setDatabasesWithStats(databasesWithBookings);
    } catch (error: any) {
      console.error('加载Dashboard数据失败:', error);
      setError(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 刷新单个数据库的数据
  const refreshDatabaseData = async (databaseId: string) => {
    const dbIndex = databasesWithStats.findIndex(db => db.id === databaseId);
    if (dbIndex === -1) return;

    setDatabasesWithStats(prev => 
      prev.map((db, idx) => 
        idx === dbIndex ? { ...db, isLoading: true } : db
      )
    );

    try {
      const bookings = await loadDatabaseBookings(databaseId);
      setDatabasesWithStats(prev => 
        prev.map((db, idx) => 
          idx === dbIndex 
            ? { 
                ...db, 
                bookings, 
                isLoading: false,
                stats: {
                  totalVolume: bookings.reduce((acc, b) => acc + (Number(b.qty) || 0), 0),
                  pendingCount: bookings.filter(b => b.state === BookingState.PENDING).length,
                  confirmedCount: bookings.filter(b => b.state === BookingState.CONFIRMED).length,
                  topClient: (() => {
                    const clientCounts: Record<string, number> = {};
                    bookings.forEach(b => {
                      // 过滤掉空客户和无效客户
                      if (!b.client || b.client.trim() === '' || b.client.toLowerCase() === 'unknown' || b.client === '未知') {
                        return;
                      }
                      const client = b.client.trim();
                      const qty = Number(b.qty) || 1;
                      clientCounts[client] = (clientCounts[client] || 0) + qty;
                    });
                    const top = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0];
                    return top ? top[0] : '暂无客户数据';
                  })()
                }
              } 
            : db
        )
      );
    } catch (error) {
      console.error(`刷新数据库 ${databaseId} 数据失败:`, error);
      setDatabasesWithStats(prev => 
        prev.map((db, idx) => 
          idx === dbIndex ? { ...db, isLoading: false } : db
        )
      );
    }
  };

  // 初始化加载
  useEffect(() => {
    if (databases.length > 0) {
      loadAllDatabasesData();
    } else {
      setLoading(false);
    }
  }, [databases]);

  // 刷新所有数据
  const handleRefreshAll = () => {
    loadAllDatabasesData();
  };

  const selectedDb = useMemo(() => 
    databasesWithStats.find(d => d.id === selectedDbId), 
  [databasesWithStats, selectedDbId]);

  // If detailed view is active
  if (selectedDbId && selectedDb) {
    return (
      <DetailedAnalytics 
        databaseId={selectedDb.id}
        dbName={selectedDb.name} 
        onBack={() => setSelectedDbId(null)}
        allocations={allocations}
      />
    );
  }

  // Overview List View
  return (
    <div className="space-y-4 pb-6 animate-in fade-in zoom-in-95 duration-300">
        {/* <div className="flex items-center justify-between mb-2">
            <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">数据仪表板</h2>
                <p className="text-sm text-gray-500">查看所有数据库的实时统计概览</p>
            </div>
            <button
              onClick={handleRefreshAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              刷新所有数据
            </button>
        </div> */}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <X className="w-5 h-5" />
              <span className="font-medium">加载失败: {error}</span>
            </div>
            <button 
              onClick={handleRefreshAll}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              重试
            </button>
          </div>
        )}

        {/* 全局统计卡片 */}
        {globalStats && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">全局统计</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>最后更新: {globalStats.timestamp ? formatDateForDisplay(globalStats.timestamp) : '未知'}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI 
                title="总数据库数" 
                value={globalStats.stats?.databases || 0} 
                sub="系统数据库" 
                icon={DbIcon} 
                gradient="bg-gradient-to-br from-purple-500 to-purple-600" 
                className="font-bold"
              />
              <KPI 
                title="总预订数" 
                value={globalStats.stats?.bookings || 0} 
                sub="所有数据库" 
                icon={Package} 
                gradient="bg-gradient-to-br from-blue-500 to-blue-600" 
                className="font-bold"
              />
              <KPI 
                title="用户数" 
                value={globalStats.stats?.users || 0} 
                sub="活跃用户" 
                icon={Users} 
                gradient="bg-gradient-to-br from-emerald-500 to-emerald-600" 
                className="font-bold"
              />
              <KPI 
                title="报价数" 
                value={globalStats.stats?.quotations || 0} 
                sub="系统报价" 
                icon={BarChart3} 
                gradient="bg-gradient-to-br from-amber-500 to-amber-600" 
                className="font-bold"
              />
            </div>
          </div>
        )}

        {/* 数据库列表 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">数据概览</h3>
            <p className="text-sm text-gray-500">
              共 {databasesWithStats.length} 个数据库 • {databasesWithStats.reduce((acc, db) => acc + (db.bookings?.length || 0), 0)} 条记录
            </p>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">加载数据库数据中...</span>
            </div>
          ) : databasesWithStats.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <DbIcon className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-gray-500">未找到数据库或数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {databasesWithStats.map(db => (
                <DbSummaryCard 
                  key={db.id} 
                  db={db} 
                  onClick={() => setSelectedDbId(db.id)}
                  onRefresh={() => refreshDatabaseData(db.id)}
                />
              ))}
            </div>
          )}
        </div>
    </div>
  );
};