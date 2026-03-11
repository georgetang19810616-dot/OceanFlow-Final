import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Booking } from '../types';
import { TrendingUp, CircleDollarSign, Globe, Container, CalendarRange, ChevronDown, ChevronUp, Users, PieChart as PieChartIcon, Building2 } from 'lucide-react';
import { FinanceVariant } from './FinancePanel';
// 导入日期工具函数
import { formatDateWithoutTimezone, getWeekLabel as getWeekLabelUtil } from '../utils/dateUtils';

interface FinanceOverviewProps {
  data: Array<{ booking: Booking; dbName: string }>;
  variant?: FinanceVariant;
}

export const FinanceOverview: React.FC<FinanceOverviewProps> = ({ data, variant }) => {
  const [showTrend, setShowTrend] = useState(false);
  const [showNetProfitDetail, setShowNetProfitDetail] = useState(false); // 新增：NET PROFIT 详情展开状态
  
  // --- Calculation Helpers ---
  const calculateRowFinancials = (b: Booking) => {
    const f = b.finance || {};
    const qty = parseInt(String(b.qty || 1), 10) || 1;
    
    // Default Logic (MyFinance/Concord)
    let arVal = f.receivable || 0;
    if (b.client === '祥泰' && f.receivable === undefined) {
        arVal = (f.ffeP || 0) * qty;
    }
    const apVal = f.payable || 0;
    const hasAP = f.payable !== undefined && f.payable !== null;
    const hasAR = f.receivable !== undefined && f.receivable !== null;
    
    let diff = 0;
    let net = 0;
    let comm = 0;
    let sComm = 0;
    
    // 获取各项费用（用于详细统计）
    const brokerageVal = f.brokerage || 0;
    const brokerageShipVal = f.brokerageShip || 0;
    const xiangTaiVal = f.xiangTai || 0;
    const docFeeVal = f.docFee || 0;
    const freeCostVal = f.freeCost || 0;
    
    if (variant === 'MY_FINANCE') {
        // Strict Rule: Only calculate if BOTH A.P and A.R exist
        if (hasAP && hasAR) {
            // 与表格一致的计算逻辑
            diff = arVal - apVal; // 先计算基本差额
            // 净利 = 差额 - 佣金 - 船东佣金 - 操作费 - 换单费 - 祥泰
            net = diff - brokerageVal - brokerageShipVal - docFeeVal - freeCostVal - xiangTaiVal;
        }
        comm = brokerageVal;
        sComm = brokerageShipVal;
    }
    else if (variant === 'SAF_FINANCE') {
        // Dynamic calc for Saf
        const ffeP = f.ffeP || 0;
        const hd = f.handlingFee || 0;
        const realApUnit = f.realAP || 0;
        const apTotal = (ffeP + hd) * qty;
        const realApTotal = (realApUnit + hd) * qty;
        const ar = f.receivable || 0;

        sComm = (ar - apTotal) / 2;
        // Check realAP validity for COMM calculation
        if (f.realAP !== undefined && f.realAP !== null) {
            comm = (ar - realApTotal) / 2;
        } else {
            comm = 0;
        }
        // Total Profit Metric for Saf is Sum of Comms
        net = Math.abs(sComm) + Math.abs(comm); 
    }
    else if (variant === 'CMA_FINANCE') {
        // For CMA, Profit is S.COMM + COMM
        sComm = f.brokerageShip || 0; // Use stored value (calculated only when inputs exist)
        comm = f.brokerage || 0;
        net = Math.abs(sComm) + Math.abs(comm);
    }
    else if (variant === 'CONCORD_FINANCE') {
        // Concord A.R is stored in `receivable` (synced from FFE.A.R input)
        diff = arVal; 
        net = diff;
    }
    else {
        // Fallback
        diff = apVal; 
        net = diff;
    }
    
    return { 
      net, 
      ap: apVal, 
      ar: arVal, 
      comm, 
      sComm, 
      xiangTai: xiangTaiVal,
      brokerage: brokerageVal,
      brokerageShip: brokerageShipVal,
      hasValidData: hasAP && hasAR
    };
  };

  const calculateVolume = (b: Booking) => parseInt(String(b.qty || 0), 10) || 1;

  // --- Aggregations ---

  const metrics = useMemo(() => {
    let totalVol = 0;
    let totalFFE = 0;
    let totalMetric = 0; // Represents Profit or Payable depending on variant
    
    // 新增：费用统计
    let totalBrokerage = 0;
    let totalBrokerageShip = 0;
    let totalXiangTai = 0;

    data.forEach(({ booking }) => {
       const vol = calculateVolume(booking);
       totalVol += vol;
       
       const type = (booking.type || '').toUpperCase();
       const factor = type.includes('20') ? 0.5 : 1;
       totalFFE += vol * factor;

       const { net, ar, comm, sComm, brokerage, brokerageShip, xiangTai, hasValidData } = calculateRowFinancials(booking);
       
       if (variant === 'CONCORD_FINANCE') {
           totalMetric += ar; // Sum of A.R
       } else if (variant === 'SAF_FINANCE' || variant === 'CMA_FINANCE') {
           // Sum of Abs Comms
           totalMetric += Math.abs(comm) + Math.abs(sComm);
       } else {
           totalMetric += net;
       }
       
       // 统计费用（仅对有效数据）
       if (variant === 'MY_FINANCE' && hasValidData) {
           totalBrokerage += brokerage;
           totalBrokerageShip += brokerageShip;
           totalXiangTai += xiangTai;
       }
    });

    return { 
      totalVol, 
      totalFFE, 
      totalMetric, 
      totalBrokerage, 
      totalBrokerageShip, 
      totalXiangTai 
    };
  }, [data, variant]);

  // --- 按数据源分组的佣金统计 ---
  const commissionBySource = useMemo(() => {
    if (variant !== 'MY_FINANCE') return [];
    
    const grouped: Record<string, { 
      brokerage: number; 
      brokerageShip: number; 
      count: number;
      netProfit: number;
    }> = {};
    
    data.forEach(({ booking, dbName }) => {
      const { 
        brokerage, 
        brokerageShip, 
        net, 
        hasValidData 
      } = calculateRowFinancials(booking);
      
      if (!hasValidData) return;
      
      if (!grouped[dbName]) {
        grouped[dbName] = { brokerage: 0, brokerageShip: 0, count: 0, netProfit: 0 };
      }
      
      grouped[dbName].brokerage += brokerage;
      grouped[dbName].brokerageShip += brokerageShip;
      grouped[dbName].netProfit += net;
      grouped[dbName].count += 1;
    });
    
    return Object.entries(grouped)
      .map(([name, values]) => ({ 
        name, 
        ...values,
        total: values.brokerage + values.brokerageShip
      }))
      .sort((a, b) => b.total - a.total);
  }, [data, variant]);

  // --- Month Trend Data (AR / AP / NET / COMM / S.COMM) ---
  const monthTrendData = useMemo(() => {
    const grouped: Record<string, { ap: number, ar: number, net: number, comm: number, sComm: number }> = {};

    data.forEach(({ booking }) => {
        if (!booking.etd) return;
        
        // 使用统一的日期格式化函数处理
        const formattedDate = formatDateWithoutTimezone(booking.etd);
        const yearMonthMatch = formattedDate.match(/^(\d{4})-(\d{2})/);
        if (!yearMonthMatch) return;
        
        const monthKey = `${yearMonthMatch[1]}-${yearMonthMatch[2]}`;
        const { net, ap, ar, comm, sComm } = calculateRowFinancials(booking);
        
        if (!grouped[monthKey]) grouped[monthKey] = { ap: 0, ar: 0, net: 0, comm: 0, sComm: 0 };
        grouped[monthKey].ap += ap;
        grouped[monthKey].ar += ar;
        
        if (variant === 'SAF_FINANCE' || variant === 'CMA_FINANCE') {
             // For display in chart, net implies total comms
             grouped[monthKey].net += (Math.abs(comm) + Math.abs(sComm));
        } else {
             grouped[monthKey].net += net;
        }
        
        grouped[monthKey].comm += comm;
        grouped[monthKey].sComm += sComm;
    });

    return Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, vals]) => ({ month, ...vals }));
  }, [data, variant]);

  // --- Top Client Data ---
  const topClientData = useMemo(() => {
     const grouped: Record<string, number> = {};
     data.forEach(({ booking }) => {
         const client = booking.client || 'Unknown';
         const { net, ar, comm, sComm } = calculateRowFinancials(booking);
         
         let value = 0;
         if (variant === 'CONCORD_FINANCE') value = ar;
         else if (variant === 'SAF_FINANCE' || variant === 'CMA_FINANCE') value = Math.abs(comm) + Math.abs(sComm);
         else value = net;

         grouped[client] = (grouped[client] || 0) + value;
     });

     return Object.entries(grouped)
        .map(([name, val]) => ({ name, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5); // Top 5
  }, [data, variant]);

  // --- Chart Configuration ---
  const renderChartBars = () => {
      switch(variant) {
          case 'MY_FINANCE':
              return (
                  <>
                    <Bar dataKey="ap" name="A.P (Cost)" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="ar" name="A.R (Revenue)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="net" name="NET (Profit)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="comm" name="COMM" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="sComm" name="S.COMM" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={12} />
                  </>
              );
          case 'SAF_FINANCE':
              return (
                  <>
                    <Bar dataKey="comm" name="COMM" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={15} />
                    <Bar dataKey="sComm" name="S.COMM" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={15} />
                  </>
              );
          case 'CMA_FINANCE':
              return (
                  <>
                    <Bar dataKey="comm" name="COMM" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="sComm" name="S.COMM" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={20} />
                  </>
              );
          case 'CONCORD_FINANCE':
              return (
                  <>
                    <Bar dataKey="ar" name="A.R" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                  </>
              );
          default:
              return (
                  <>
                    <Bar dataKey="ap" name="A.P" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="ar" name="A.R" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="net" name="NET" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </>
              );
      }
  };

  // --- Components ---
  
  const KPI = ({ title, value, icon: Icon, color, onClick, isActive, subtitle }: any) => (
    <div 
        onClick={onClick}
        className={`bg-white p-4 rounded-xl border transition-all duration-200 shadow-sm flex items-center justify-between relative overflow-hidden select-none ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : 'border-gray-200'} ${isActive ? 'ring-1 ring-amber-500 border-amber-500 bg-amber-50/10' : ''}`}
    >
        {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>}
        <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                {title}
                {onClick && (isActive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </p>
            <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
            {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full bg-gray-50 ${color.replace('text-', 'text-opacity-80 text-')}`}>
            <Icon className="w-6 h-6" />
        </div>
    </div>
  );

  // 颜色配置
  const COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6', '#ef4444'];

  return (
    <div className="space-y-4 mb-6 transition-all duration-300">
       {/* 1. Overview KPIs */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <KPI 
              title="Total Volume" 
              value={
                <div className="flex items-baseline gap-1">
                  {metrics.totalVol} 
                  <span className="text-sm font-medium opacity-70">Shipments</span>
                </div>
              }
              icon={Globe} 
              color="text-blue-600" 
           />
           <KPI 
              title="Est. FFE" 
              value={metrics.totalFFE.toFixed(0)} 
              icon={Container} 
              color="text-indigo-600" 
           />
           <KPI 
              title={variant === 'CONCORD_FINANCE' ? "Total A.R" : "Net Profit"}
              value={`$${metrics.totalMetric.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
              subtitle={variant === 'MY_FINANCE' ? "点击查看费用详情" : undefined}
              icon={CircleDollarSign} 
              color={variant === 'CONCORD_FINANCE' ? "text-red-600" : (metrics.totalMetric >= 0 ? "text-emerald-600" : "text-red-600")}
              onClick={variant === 'MY_FINANCE' ? () => setShowNetProfitDetail(!showNetProfitDetail) : undefined}
              isActive={showNetProfitDetail}
           />
           <KPI 
              title="Active Months" 
              value={monthTrendData.length} 
              icon={CalendarRange} 
              color="text-amber-600"
              onClick={() => setShowTrend(!showTrend)}
              isActive={showTrend}
           />
       </div>

       {/* 2. NET PROFIT 详情展开面板 (仅 MY_FINANCE) */}
       {showNetProfitDetail && variant === 'MY_FINANCE' && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 左侧：费用总览卡片 */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <PieChartIcon className="w-4 h-4 text-amber-500" />
                   费用构成总览
                </h3>
                
                <div className="space-y-4 flex-1">
                    {/* 佣金 */}
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-amber-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                佣金 (COMM)
                            </span>
                            <span className="text-lg font-bold text-amber-700">
                                ${metrics.totalBrokerage.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-amber-200 rounded-full h-1.5">
                            <div 
                                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((metrics.totalBrokerage / (metrics.totalBrokerage + metrics.totalBrokerageShip + metrics.totalXiangTai || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* 船东佣金 */}
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-purple-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                船东佣金 (S.COMM)
                            </span>
                            <span className="text-lg font-bold text-purple-700">
                                ${metrics.totalBrokerageShip.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-1.5">
                            <div 
                                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((metrics.totalBrokerageShip / (metrics.totalBrokerage + metrics.totalBrokerageShip + metrics.totalXiangTai || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* 祥泰 */}
                    <div className="bg-pink-50 rounded-lg p-4 border border-pink-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-pink-800 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                                祥泰 (XiangTai)
                            </span>
                            <span className="text-lg font-bold text-pink-700">
                                ${metrics.totalXiangTai.toLocaleString()}
                            </span>
                        </div>
                        <div className="w-full bg-pink-200 rounded-full h-1.5">
                            <div 
                                className="bg-pink-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min((metrics.totalXiangTai / (metrics.totalBrokerage + metrics.totalBrokerageShip + metrics.totalXiangTai || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* 费用合计 */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-600">费用合计</span>
                            <span className="text-xl font-bold text-gray-800">
                                ${(metrics.totalBrokerage + metrics.totalBrokerageShip + metrics.totalXiangTai).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 中间：数据源分布饼图 */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Building2 className="w-4 h-4 text-blue-500" />
                   数据源费用分布
                </h3>
                <div className="flex-1 min-h-[200px]">
                    {commissionBySource.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={commissionBySource}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="total"
                                    nameKey="name"
                                >
                                    {commissionBySource.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                    formatter={(value: number) => `$${value.toLocaleString()}`}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36}
                                    iconType="circle"
                                    wrapperStyle={{ fontSize: '11px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <PieChartIcon className="w-10 h-10 opacity-20 mb-2" />
                            <p className="text-sm">无数据源分布数据</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 右侧：数据源详细统计表 */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Users className="w-4 h-4 text-emerald-500" />
                   按数据源统计 (Top 8)
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-gray-100">
                                <th className="text-left py-2 font-semibold text-gray-600">数据源</th>
                                <th className="text-right py-2 font-semibold text-amber-600">佣金</th>
                                <th className="text-right py-2 font-semibold text-purple-600">船东佣金</th>
                                <th className="text-right py-2 font-semibold text-gray-700">合计</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {commissionBySource.slice(0, 8).map((source, idx) => (
                                <tr key={source.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-2.5">
                                        <div className="flex items-center gap-2">
                                            <span 
                                                className="w-2 h-2 rounded-full" 
                                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                            ></span>
                                            <span className="font-medium text-gray-800">{source.name}</span>
                                            <span className="text-[10px] text-gray-400">({source.count}单)</span>
                                        </div>
                                    </td>
                                    <td className="text-right py-2.5 font-mono text-amber-700">
                                        ${source.brokerage.toLocaleString()}
                                    </td>
                                    <td className="text-right py-2.5 font-mono text-purple-700">
                                        ${source.brokerageShip.toLocaleString()}
                                    </td>
                                    <td className="text-right py-2.5 font-mono font-bold text-gray-800">
                                        ${source.total.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {commissionBySource.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-400">
                                        暂无数据
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {commissionBySource.length > 0 && (
                            <tfoot className="bg-gray-50 sticky bottom-0">
                                <tr className="border-t border-gray-200 font-bold">
                                    <td className="py-3 text-gray-700">总计</td>
                                    <td className="text-right py-3 text-amber-700">
                                        ${metrics.totalBrokerage.toLocaleString()}
                                    </td>
                                    <td className="text-right py-3 text-purple-700">
                                        ${metrics.totalBrokerageShip.toLocaleString()}
                                    </td>
                                    <td className="text-right py-3 text-gray-800">
                                        ${(metrics.totalBrokerage + metrics.totalBrokerageShip).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
       )}

       {/* 3. Expanded Area - Toggled by Active Months KPI */}
       {showTrend && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Left: Trend Chart */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80 lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-blue-500" />
                   Monthly Financials
                </h3>
                <div className="flex-1 w-full min-h-0">
                   {monthTrendData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => `$${val/1000}k`} />
                              <Tooltip 
                                 contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                 cursor={{fill: '#f9fafb'}}
                              />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }}/>
                              {renderChartBars()}
                          </BarChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center text-gray-400">
                           <TrendingUp className="w-10 h-10 opacity-20 mb-2" />
                           <p className="text-sm">No data to display</p>
                       </div>
                   )}
                </div>
            </div>

            {/* Right: Top Clients */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Users className="w-4 h-4 text-emerald-500" />
                   {variant === 'CONCORD_FINANCE' ? 'Clients A.R' : 'Top Clients (Net Profit)'}
                </h3>
                <div className="flex-1 w-full min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {topClientData.map((client, idx) => (
                        <div key={client.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors group border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${idx===0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <p className="text-xs font-bold text-gray-800">{client.name}</p>
                                </div>
                            </div>
                            <span className={`text-xs font-mono font-bold ${variant === 'CONCORD_FINANCE' ? 'text-red-600' : 'text-emerald-600'}`}>
                               ${client.val.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                            </span>
                        </div>
                    ))}
                    {topClientData.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                           <Users className="w-8 h-8 opacity-20 mb-2" />
                           <p className="text-xs">No client data</p>
                       </div>
                    )}
                </div>
            </div>

        </div>
       )}
    </div>
  );
};