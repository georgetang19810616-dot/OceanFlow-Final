import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Booking, FieldDefinition, FieldType, Allocation } from '../types';
import { Button } from './Button';
import { X, Calendar, Lock, FileText, ChevronDown, Info, AlertCircle, CheckCircle, Key } from 'lucide-react';
import { getWeekLabel, formatDateForInput, formatDateForDisplay } from '../utils/dateUtils';
import { apiService } from '../services/apiService';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (booking: Partial<Booking>) => void;
  initialData?: Booking;
  fields: FieldDefinition[];
  canEdit?: boolean;
  // Dropdown Options
  optionsMap: Record<string, string[]>; // Map field keys to option arrays (e.g. 'carrier' -> carriers[])
  allocations?: Allocation[];
  // 新增：用户信息（用于记录变更者）
  currentUser?: {
    username: string;
    name?: string;
  };
  // 新增：数据库信息
  databaseId?: string;
  databaseName?: string;
  // 新增：变更记录回调
  onBookingChange?: (changeRecord: BookingChangeRecord) => void;
}

// 变更记录接口（对应数据库表 booking_change_records）
interface BookingChangeRecord {
  // 注意：change_date 和 change_timestamp 不再由前端生成
  // 这些字段将由数据库自动生成（使用 CURRENT_TIMESTAMP）
  bookinger: string; // 编辑者（当前用户）
  database_id: string;
  database_name: string;
  change_type: 'status_change' | 'pol_change' | 'pod_change' | 'client_change' | 'multiple' | 'rollback';
  previous_status?: string;
  previous_client?: string;
  previous_pol?: string;
  previous_pod?: string;
  new_status?: string;
  new_client?: string;
  new_pol?: string;
  new_pod?: string;
  carrier?: string;
  etd?: string;
  qty?: number;
  type?: string;
  week?: string;
  service?: string;
  vessel?: string;
  allocation?: string;
  // 为了匹配 StatusChangeRecord 接口，添加以下字段
  booking_ref?: string;
  bookingRef?: string;
  pol?: string;
  pod?: string;
  client?: string;
  previousStatus?: string;
  newStatus?: string;
  previousPol?: string;
  newPol?: string;
  previousPod?: string;
  newPod?: string;
  previousClient?: string;
  newClient?: string;
  // 新增：QTY和TYPE变更字段 - 允许undefined
  previous_qty?: number;
  new_qty?: number;
  previous_type?: string;
  new_type?: string;
  previous_allocation?: string;
  new_allocation?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  fields, 
  optionsMap,
  currentUser,
  databaseId,
  databaseName,
  onBookingChange
}) => {
  const [formData, setFormData] = useState<Partial<Booking>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showFieldKeys, setShowFieldKeys] = useState(false);
  
  // 用于跟踪日期字段的本地格式
  const [localDates, setLocalDates] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 新增：保存原始数据用于比较
  const [originalData, setOriginalData] = useState<Partial<Booking>>({});
  
  // 新增：ROLLED复选框状态
  const [isRolled, setIsRolled] = useState(false);
  
  // 新增：DELAY复选框状态
  const [isDelayed, setIsDelayed] = useState(false);

  // 新增：记录勾选复选框时ETD/VESSEL/WEEK的值
  const [snapshotValues, setSnapshotValues] = useState<{
    etd: string;
    vessel: string;
    week: string;
  }>({
    etd: '',
    vessel: '',
    week: ''
  });

  // 新增：标记REMARK是否是由勾选生成的
  const [isRemarkGeneratedByCheckbox, setIsRemarkGeneratedByCheckbox] = useState(false);

  // 系统字段列表
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
    'type': 'containerTypes', // 将 type 映射到 containerTypes
    'client': 'client',
    'allocation': 'allocation',
    'gateIn': 'gateIn',
    'job': 'job',
    'contact': 'contact', // 新增CONTACT字段
    'remark': 'remark',
    'eta': 'eta',
    'etb': 'etb'
  };

  // 需要比较的字段列表
  const COMPARE_FIELDS = ['state', 'client', 'pol', 'pod', 'qty', 'type', 'allocation'];

  // 字段排序逻辑 - 按指定顺序排列（将contact放在job后面）
  const sortedFields = useMemo(() => {
    // 定义期望的字段顺序
    const desiredOrder = [
      'state', 'week', 'carrier', 'service', 'bookingRef', 
      'client', 'pol', 'pod', 'vessel', 'etd', 'qty', 
      'type', 'allocation', 'gateIn', 'job', 'contact', 'remark'
    ];
    
    // 创建字段映射以便快速查找
    const fieldMap = new Map(fields.map(field => [field.key, field]));
    
    // 按指定顺序排列字段
    const orderedFields: FieldDefinition[] = [];
    
    desiredOrder.forEach(key => {
      const field = fieldMap.get(key);
      if (field) {
        orderedFields.push(field);
        fieldMap.delete(key);
      }
    });
    
    // 添加剩余的字段（按照它们在原始数组中的顺序）
    const remainingFields: FieldDefinition[] = [];
    fields.forEach(field => {
      if (fieldMap.has(field.key)) {
        remainingFields.push(field);
      }
    });
    
    return [...orderedFields, ...remainingFields];
  }, [fields]);

  // 格式化日期为YYYY/MM/DD格式
  const formatDateToSlashFormat = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      // 处理不同的日期格式
      let year, month, day;
      
      if (dateString.includes('-')) {
        // YYYY-MM-DD格式
        [year, month, day] = dateString.split('-');
      } else if (dateString.includes('/')) {
        // 已经是YYYY/MM/DD格式
        [year, month, day] = dateString.split('/');
      } else {
        console.warn('无法识别的日期格式:', dateString);
        return dateString;
      }
      
      return `${year}/${month}/${day}`;
    } catch (error) {
      console.warn('日期格式化错误:', error);
      return dateString;
    }
  };

  // 生成甩柜备注内容（纯文本，不带HTML标签）
  const generateRolledRemark = (week: string, vessel: string, etd: string): string => {
    const formattedEtd = formatDateToSlashFormat(etd);
    return `甩柜 - ${week} - ${vessel} - ${formattedEtd}`;
  };

  // 生成晚开备注内容（纯文本，不带HTML标签）
  const generateDelayedRemark = (week: string, vessel: string, etd: string): string => {
    const formattedEtd = formatDateToSlashFormat(etd);
    return `晚开 - ${week} - ${vessel} - ${formattedEtd}`;
  };

  // 检查是否为甩柜备注格式
  const isRolledRemarkFormat = (remark: string): boolean => {
    if (!remark) return false;
    
    // 检查是否包含"甩柜"字样
    return remark.includes('甩柜');
  };

  // 检查是否为晚开备注格式
  const isDelayedRemarkFormat = (remark: string): boolean => {
    if (!remark) return false;
    
    // 检查是否包含"晚开"字样
    return remark.includes('晚开');
  };

  // Initialize form data when modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      setLocalDates({});
      setValidationErrors({});
      setIsSubmitting(false);
      setOriginalData({});
      setIsRolled(false); // 重置ROLLED状态
      setIsDelayed(false); // 重置DELAY状态
      setSnapshotValues({ etd: '', vessel: '', week: '' }); // 重置快照值
      setIsRemarkGeneratedByCheckbox(false); // 重置生成状态
      return;
    }

    if (initialData) {
      console.log('📝 初始化编辑数据:', {
        id: initialData.id,
        etd: initialData.etd,
        hasEtd: !!initialData.etd,
        data: initialData.data,
        allFields: Object.keys(initialData)
      });
      
      // 处理初始数据，正确提取所有字段
      const processedData: Partial<Booking> = {};
      const newLocalDates: Record<string, string> = {};
      
      // 首先设置系统字段
      processedData.id = initialData.id;
      processedData.week = initialData.week || '';
      processedData.bookingRef = initialData.bookingRef || '';
      processedData.state = initialData.state || 'PENDING';
      processedData.isLocked = initialData.isLocked || false;
      processedData.finance = initialData.finance || {};
      
      // 关键修复：确保 ETD 字段正确设置
      // 直接使用数据库返回的 etd 值（已经是 YYYY-MM-DD 格式）
      if (initialData.etd) {
        processedData.etd = initialData.etd as string;
        console.log('✅ 使用数据库返回的 ETD:', { 
          raw: initialData.etd, 
          processed: processedData.etd 
        });
        
        // 设置 ETD 的本地显示格式
        const formattedEtd = formatDateForDisplay(processedData.etd as string);
        newLocalDates.etd = formattedEtd;
        console.log('📅 ETD 格式化:', { 
          raw: processedData.etd, 
          formatted: formattedEtd 
        });
      } else {
        processedData.etd = '';
        console.log('❌ ETD 字段为空');
      }
      
      // 处理所有其他业务字段
      fields.forEach(field => {
        const key = field.key;
        
        // 跳过已处理的系统字段
        if (SYSTEM_FIELDS.includes(key) && key !== 'week' && key !== 'bookingRef') {
          if (key === 'etd') {
            // ETD 已经处理过，跳过
            return;
          }
        }
        
        // 尝试从不同位置获取字段值
        let value: any = '';
        
        // 1. 直接从 initialData 获取（除了 etd）
        if (key in initialData && key !== 'etd') {
          value = (initialData as any)[key];
          console.log(`从 initialData 获取 ${key}:`, value);
        } 
        // 2. 从 data 对象获取
        else if (initialData.data && typeof initialData.data === 'object') {
          const dataObj = initialData.data;
          if (key in dataObj) {
            value = (dataObj as any)[key];
            console.log(`从 data 获取 ${key}:`, value);
          }
        }
        // 3. 从其他可能的字段名获取
        else if (key === 'type' && initialData.containerType) {
          value = initialData.containerType;
          console.log(`从 containerType 获取 ${key}:`, value);
        }
        // 4. 使用默认值
        else {
          value = field.defaultValue || '';
          console.log(`使用默认值 ${key}:`, value);
        }
        
        // 处理其他日期字段（gateIn, eta, etb）
        if (['gateIn', 'eta', 'etb'].includes(key) && value) {
          try {
            // 直接使用值，假设已经是 YYYY-MM-DD 格式
            processedData[key as keyof Booking] = value;
            
            // 设置本地显示格式
            if (value) {
              newLocalDates[key] = formatDateForDisplay(value);
            }
          } catch (error) {
            console.warn(`日期字段 ${key} 解析错误:`, error);
            processedData[key as keyof Booking] = value;
          }
        } else {
          processedData[key as keyof Booking] = value;
        }
      });
      
      // 确保 WEEK 字段根据 ETD 正确计算
      if (processedData.etd && !processedData.week) {
        processedData.week = getWeekLabel(processedData.etd as string);
        console.log('🔢 计算 WEEK 字段:', {
          etd: processedData.etd,
          week: processedData.week
        });
      }
      
      console.log('✅ 最终表单数据:', processedData);
      console.log('📊 本地日期显示:', newLocalDates);
      
      // 保存原始数据用于比较
      setOriginalData({ ...processedData });
      setLocalDates(newLocalDates);
      setFormData(processedData);
      
      // 检查是否应该自动勾选ROLLED或DELAY复选框
      // 如果remark字段包含相应格式，则自动勾选
      const remark = processedData.remark as string || '';
      const isRolledRemark = isRolledRemarkFormat(remark);
      const isDelayedRemark = isDelayedRemarkFormat(remark);
      
      if (isRolledRemark) {
        setIsRolled(true);
        setIsRemarkGeneratedByCheckbox(true); // 标记为由勾选生成
        
        // 记录勾选时的值
        setSnapshotValues({
          etd: processedData.etd as string || '',
          vessel: processedData.vessel as string || '',
          week: processedData.week as string || ''
        });
        
        console.log('✅ 检测到甩柜备注，自动勾选ROLLED');
      } else if (isDelayedRemark) {
        setIsDelayed(true);
        setIsRemarkGeneratedByCheckbox(true); // 标记为由勾选生成
        
        // 记录勾选时的值
        setSnapshotValues({
          etd: processedData.etd as string || '',
          vessel: processedData.vessel as string || '',
          week: processedData.week as string || ''
        });
        
        console.log('✅ 检测到晚开备注，自动勾选DELAY');
      }
      
      setIsInitialized(true);
    } else if (!isInitialized) {
      console.log('🆕 初始化新预订表单');
      
      // 新建模式
      const emptyData: Partial<Booking> = {};
      
      // 设置默认值
      emptyData.state = 'PENDING';
      emptyData.week = '';
      emptyData.etd = '';
      emptyData.qty = 0;
      emptyData.isLocked = false;
      emptyData.finance = {};
      
      // 设置其他字段为空
      fields.forEach(field => {
        if (!SYSTEM_FIELDS.includes(field.key) && field.key !== 'state' && field.key !== 'etd') {
          const defaultValue = field.defaultValue || '';
          (emptyData as any)[field.key] = defaultValue;
        }
      });
      
      console.log('✅ 初始化的新数据:', emptyData);
      setFormData(emptyData);
      setLocalDates({});
      setOriginalData({});
      setIsRolled(false);
      setIsDelayed(false);
      setSnapshotValues({ etd: '', vessel: '', week: '' });
      setIsRemarkGeneratedByCheckbox(false);
      setIsInitialized(true);
    }
  }, [isOpen, initialData, fields, isInitialized]);

  // 新增：处理ROLLED复选框变化
  const handleRolledChange = (checked: boolean) => {
    setIsRolled(checked);
    
    // 如果勾选ROLLED，取消DELAY
    if (checked) {
      setIsDelayed(false);
      
      // 记录当前的ETD/VESSEL/WEEK值
      const currentEtd = formData.etd as string || '';
      const currentVessel = formData.vessel as string || '';
      const currentWeek = formData.week as string || '';
      
      setSnapshotValues({
        etd: currentEtd,
        vessel: currentVessel,
        week: currentWeek
      });
      
      // 标记为由勾选生成
      setIsRemarkGeneratedByCheckbox(true);
      
      // 勾选时，使用当前值生成REMARK字段（纯文本）
      const rolledRemark = generateRolledRemark(currentWeek, currentVessel, currentEtd);
      
      console.log('🔄 勾选ROLLED，更新REMARK字段（纯文本）:', rolledRemark);
      console.log('📸 记录快照值:', { etd: currentEtd, vessel: currentVessel, week: currentWeek });
      
      setFormData(prev => ({
        ...prev,
        remark: rolledRemark
      }));
    }
    // 取消勾选时，不清除REMARK字段，用户可以手动删除或保留
    else {
      console.log('🔄 取消ROLLED，保留现有REMARK字段');
    }
  };

  // 新增：处理DELAY复选框变化
  const handleDelayedChange = (checked: boolean) => {
    setIsDelayed(checked);
    
    // 如果勾选DELAY，取消ROLLED
    if (checked) {
      setIsRolled(false);
      
      // 记录当前的ETD/VESSEL/WEEK值
      const currentEtd = formData.etd as string || '';
      const currentVessel = formData.vessel as string || '';
      const currentWeek = formData.week as string || '';
      
      setSnapshotValues({
        etd: currentEtd,
        vessel: currentVessel,
        week: currentWeek
      });
      
      // 标记为由勾选生成
      setIsRemarkGeneratedByCheckbox(true);
      
      // 勾选时，使用当前值生成REMARK字段（纯文本）
      const delayedRemark = generateDelayedRemark(currentWeek, currentVessel, currentEtd);
      
      console.log('🔄 勾选DELAY，更新REMARK字段（纯文本）:', delayedRemark);
      console.log('📸 记录快照值:', { etd: currentEtd, vessel: currentVessel, week: currentWeek });
      
      setFormData(prev => ({
        ...prev,
        remark: delayedRemark
      }));
    }
    // 取消勾选时，不清除REMARK字段，用户可以手动删除或保留
    else {
      console.log('🔄 取消DELAY，保留现有REMARK字段');
    }
  };

  // 比较新旧数据，生成变更记录（修改：不再生成时间字段）
  const compareBookingData = (
    oldData: Partial<Booking>,
    newData: Partial<Booking>
  ): BookingChangeRecord | null => {
    // 如果旧数据为空（新建操作），则不记录变更
    if (!oldData || Object.keys(oldData).length === 0) {
      console.log('🆕 新建操作，不记录变更');
      return null;
    }
    
    // 记录变更的字段
    const changes: Record<string, { old: any; new: any }> = {};
    
    // 获取旧状态和新状态
    const oldStatus = oldData.state;
    const newStatus = newData.state;
    
    // 检查状态是否发生变化
    const hasStatusChange = oldStatus !== newStatus;
    const isRollback = hasStatusChange && oldStatus === 'CONFIRMED' && newStatus === 'PENDING';
    // 修复：添加对 UNDETERMINED → CONFIRMED 状态变更的识别
    const isStatusChangeToConfirmed = hasStatusChange && 
      ((oldStatus === 'PENDING' && newStatus === 'CONFIRMED') ||
      (oldStatus === 'UNDETERMINED' && newStatus === 'CONFIRMED'));
    
    const isStatusStayConfirmed = !hasStatusChange && oldStatus === 'CONFIRMED' && newStatus === 'CONFIRMED';
    
    console.log('🔍 状态检查:', {
      oldStatus,
      newStatus,
      hasStatusChange,
      isRollback,
      isStatusChangeToConfirmed,
      isStatusStayConfirmed
    });
    
    // 处理不同的状态变更场景
    let changeType: BookingChangeRecord['change_type'] = 'status_change';
    let changedFields: string[] = [];
    
    // 场景1: 退舱 (CONFIRMED -> PENDING)
    if (isRollback) {
      changeType = 'rollback';
      console.log('🔙 检测到退舱操作');
      
      // 对于退舱，需要特别处理
      // 1. 记录状态变更
      changes.state = { old: oldStatus || '', new: newStatus || '' };
      changedFields.push('状态');
      
      // 2. 对于退舱，POL/POD读取NEW_POL/NEW_POD
      // CLIENT字段渲染为：PREVIOUS_CLIENT -> 未分配
      const previousClient = oldData.client as string || '';
      const newClient = ''; // 退舱后客户变为未分配
      
      if (previousClient !== newClient) {
        changes.client = { old: previousClient, new: newClient };
        changedFields.push('CLIENT');
      }
      
      // 检查POL/POD是否有变更
      if (oldData.pol !== newData.pol) {
        changes.pol = { old: oldData.pol || '', new: newData.pol || '' };
        changedFields.push('POL');
      }
      if (oldData.pod !== newData.pod) {
        changes.pod = { old: oldData.pod || '', new: newData.pod || '' };
        changedFields.push('POD');
      }
      
      // 检查QTY、TYPE、ALLOCATION是否有变更
      if (oldData.qty !== newData.qty) {
        changes.qty = { 
          old: oldData.qty || 0, 
          new: newData.qty || 0 
        };
        changedFields.push('QTY');
      }
      if (oldData.type !== newData.type) {
        changes.type = { 
          old: oldData.type as string || '', 
          new: newData.type as string || '' 
        };
        changedFields.push('TYPE');
      }
      if (oldData.allocation !== newData.allocation) {
        changes.allocation = { 
          old: oldData.allocation as string || '', 
          new: newData.allocation as string || '' 
        };
        changedFields.push('ALLOCATION');
      }
    } 
    // 场景2: 放舱 (PENDING -> CONFIRMED)
    else if (isStatusChangeToConfirmed) {
      changeType = 'status_change';
      console.log('✅ 检测到放舱操作');
      
      // 记录状态变更
      changes.state = { old: oldStatus || '', new: newStatus || '' };
      changedFields.push('状态');
      
      // 检查其他字段是否有变更
      COMPARE_FIELDS.forEach(field => {
        if (field === 'state') return; // 已经处理了状态
        
        const oldValue = (oldData as any)[field];
        const newValue = (newData as any)[field];
        
        // 处理空值情况
        const oldValueStr = oldValue === null || oldValue === undefined ? '' : String(oldValue);
        const newValueStr = newValue === null || newValue === undefined ? '' : String(newValue);
        
        // 检查是否发生变化
        if (oldValueStr !== newValueStr) {
          changes[field] = { old: oldValueStr, new: newValueStr };
          
          // 记录变更字段
          const fieldLabel = field.toUpperCase();
          if (!changedFields.includes(fieldLabel)) {
            changedFields.push(fieldLabel);
          }
          
          console.log(`🔄 检测到 ${field} 变更: ${oldValueStr} -> ${newValueStr}`);
        }
      });
    }
    // 场景3: 状态保持CONFIRMED，但有其他字段变更
    else if (isStatusStayConfirmed) {
      console.log('📝 状态保持CONFIRMED，检查其他字段变更');
      
      // 检查其他字段是否有变更
      let hasOtherChanges = false;
      
      COMPARE_FIELDS.forEach(field => {
        if (field === 'state') return; // 状态没有变化
        
        const oldValue = (oldData as any)[field];
        const newValue = (newData as any)[field];
        
        // 处理空值情况
        const oldValueStr = oldValue === null || oldValue === undefined ? '' : String(oldValue);
        const newValueStr = newValue === null || newValue === undefined ? '' : String(newValue);
        
        // 检查是否发生变化
        if (oldValueStr !== newValueStr) {
          changes[field] = { old: oldValueStr, new: newValueStr };
          hasOtherChanges = true;
          
          // 记录变更字段
          const fieldLabel = field.toUpperCase();
          if (!changedFields.includes(fieldLabel)) {
            changedFields.push(fieldLabel);
          }
          
          console.log(`🔄 检测到 ${field} 变更: ${oldValueStr} -> ${newValueStr}`);
        }
      });
      
      // 确定变更类型
      if (hasOtherChanges) {
        // 如果有多个字段变更，标记为multiple
        if (changedFields.length > 1) {
          changeType = 'multiple';
        } 
        // 单个字段变更
        else if (changes.pol) {
          changeType = 'pol_change';
        } else if (changes.pod) {
          changeType = 'pod_change';
        } else if (changes.client) {
          changeType = 'client_change';
        } else if (changes.qty || changes.type || changes.allocation) {
          changeType = 'multiple'; // QTY/TYPE/ALLOCATION变更也归类为multiple
        }
      } else {
        // 没有变更，不记录
        console.log('✅ 没有检测到需要记录的变更');
        return null;
      }
    }
    // 场景4: 状态保持PENDING，有其他字段变更（不记录到放舱统计）
    else if (!hasStatusChange && oldStatus === 'PENDING' && newStatus === 'PENDING') {
      console.log('📝 状态保持PENDING时的字段变更，不记录到放舱统计');
      return null;
    } else {
      // 其他情况不记录
      console.log('❌ 不需要记录的变更类型');
      return null;
    }
    
    // 如果没有变化，返回 null
    if (Object.keys(changes).length === 0) {
      console.log('✅ 没有检测到需要记录的变更');
      return null;
    }
    
    console.log('📝 变更类型:', changeType);
    console.log('📋 变更详情:', changes);
    console.log('🏷️ 变更字段列表:', changedFields);
    
    // 对于退舱，特别处理CLIENT字段
    const isRollbackCase = isRollback;
    const previousClient = oldData.client as string || '';
    const newClient = isRollbackCase ? '' : (newData.client as string || '');
    
    const changeRecord: BookingChangeRecord = {
      // 注意：change_date 和 change_timestamp 不再由前端生成
      // 这些字段将由数据库自动生成（使用 CURRENT_TIMESTAMP）
      
      bookinger: currentUser?.username || currentUser?.name || '未知用户',
      database_id: databaseId || oldData.databaseId || '',
      database_name: databaseName || oldData.databaseName || '',
      change_type: changeType,
      
      // 状态变更
      previous_status: oldStatus || '',
      new_status: newStatus || '',
      
      // POL变更 - 关键修复：确保PREVIOUS_POL和NEW_POL正确设置
      previous_pol: oldData.pol as string || '',
      new_pol: newData.pol as string || '',
      
      // POD变更 - 关键修复：确保PREVIOUS_POD和NEW_POD正确设置
      previous_pod: oldData.pod as string || '',
      new_pod: newData.pod as string || '',
      
      // CLIENT变更 - 关键修复：确保PREVIOUS_CLIENT和NEW_CLIENT正确设置
      previous_client: previousClient || '',
      new_client: newClient || '',
      
      // QTY变更
      previous_qty: Number(oldData.qty) || 0,
      new_qty: Number(newData.qty) || 0,
      
      // TYPE变更
      previous_type: (oldData.type as string) || '',
      new_type: (newData.type as string) || '',
      
      // ALLOCATION变更
      previous_allocation: (oldData.allocation as string) || '',
      new_allocation: (newData.allocation as string) || '',
      
      // 其他字段
      carrier: newData.carrier || oldData.carrier || '',
      etd: newData.etd as string || oldData.etd as string || '',
      qty: Number(newData.qty) || Number(oldData.qty) || 0,
      type: newData.type as string || oldData.type as string || '',
      week: newData.week || oldData.week || '',
      service: newData.service || oldData.service || '',
      vessel: newData.vessel || oldData.vessel || '', // 添加VESSEL字段
      allocation: newData.allocation as string || oldData.allocation as string || '',
      
      // 为了匹配其他接口的字段名
      booking_ref: oldData.bookingRef || newData.bookingRef || '',
      bookingRef: oldData.bookingRef || newData.bookingRef || '',
      pol: newData.pol as string || oldData.pol as string || '',
      pod: newData.pod as string || oldData.pod as string || '',
      client: newClient || oldData.client as string || '',
      previousStatus: oldStatus || '',
      newStatus: newStatus || '',
      previousPol: oldData.pol as string || '',
      newPol: newData.pol as string || '',
      previousPod: oldData.pod as string || '',
      newPod: newData.pod as string || '',
      previousClient: previousClient || '',
      newClient: newClient || '',
    };
    
    console.log('✅ 生成的变更记录（不含时间字段）:', changeRecord);
    return changeRecord;
  };

  // 在 BookingModal.tsx 的 saveChangeRecord 函数中，添加时间字段
  const saveChangeRecord = async (changeRecord: BookingChangeRecord): Promise<boolean> => {
    try {
      console.log('💾 保存变更记录到数据库...');
      
      // 获取上海时区当前日期和时间
      const getShanghaiDate = (): string => {
        const now = new Date();
        const shanghaiOffset = 8 * 60 * 60 * 1000;
        const shanghaiTime = new Date(now.getTime() + shanghaiOffset);
        
        const year = shanghaiTime.getUTCFullYear();
        const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      };
      
      const getShanghaiDateTime = (): string => {
        const now = new Date();
        const shanghaiOffset = 8 * 60 * 60 * 1000;
        const shanghaiTime = new Date(now.getTime() + shanghaiOffset);
        
        const year = shanghaiTime.getUTCFullYear();
        const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
        const hours = String(shanghaiTime.getUTCHours()).padStart(2, '0');
        const minutes = String(shanghaiTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(shanghaiTime.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(shanghaiTime.getUTCMilliseconds()).padStart(3, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
      };
      
      const changeDate = getShanghaiDate();
      const changeTimestamp = getShanghaiDateTime();
      
      console.log('🕐 生成的上海时区时间:', { changeDate, changeTimestamp });
      
      // 确保字段名匹配后端期望
      const recordToSend = {
        // 包含时间字段以通过数据库的 NOT NULL 约束
        change_date: changeDate,
        change_timestamp: changeTimestamp,
        
        booking_ref: changeRecord.booking_ref || changeRecord.bookingRef,
        bookinger: changeRecord.bookinger,
        database_id: changeRecord.database_id,
        database_name: changeRecord.database_name,
        change_type: changeRecord.change_type,
        previous_status: changeRecord.previous_status || changeRecord.previousStatus,
        previous_client: changeRecord.previous_client || changeRecord.previousClient,
        previous_pol: changeRecord.previous_pol || changeRecord.previousPol,
        previous_pod: changeRecord.previous_pod || changeRecord.previousPod,
        new_status: changeRecord.new_status || changeRecord.newStatus,
        new_client: changeRecord.new_client || changeRecord.newClient,
        new_pol: changeRecord.new_pol || changeRecord.newPol,
        new_pod: changeRecord.new_pod || changeRecord.newPod,
        carrier: changeRecord.carrier,
        etd: changeRecord.etd,
        qty: changeRecord.qty,
        type: changeRecord.type,
        week: changeRecord.week,
        service: changeRecord.service,
        vessel: changeRecord.vessel,
        allocation: changeRecord.allocation,
        // 新增：QTY和TYPE变更字段
        previous_qty: changeRecord.previous_qty,
        new_qty: changeRecord.new_qty,
        previous_type: changeRecord.previous_type,
        new_type: changeRecord.new_type,
        previous_allocation: changeRecord.previous_allocation,
        new_allocation: changeRecord.new_allocation
      };
      
      console.log('📤 发送的变更记录（包含时间戳）:', recordToSend);
      
      // 使用 apiService 保存变更记录
      const response = await apiService.saveBookingChangeRecord(recordToSend);
      
      if (response.success) {
        console.log('✅ 变更记录保存成功');
        console.log('🕐 数据库返回的时间:', {
          change_date: response.record?.change_date,
          change_timestamp: response.record?.change_timestamp
        });
        
        // 如果有回调函数，调用它
        if (onBookingChange) {
          onBookingChange(changeRecord);
        }
        
        return true;
      } else {
        console.error('❌ 变更记录保存失败:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ 保存变更记录时出错:', error);
      return false;
    }
  };

  // 修改 handleChange 函数
  const handleChange = (key: string, value: string) => {
    console.log(`字段变更: ${key} = ${value}`);
    
    // 清除该字段的验证错误
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
    
    // 如果用户手动修改了REMARK字段，取消由勾选生成的状态
    if (key === 'remark') {
      const currentRemark = value;
      const isAutoRemark = isRolledRemarkFormat(currentRemark) || isDelayedRemarkFormat(currentRemark);
      
      if (!isAutoRemark) {
        // 用户手动输入了其他内容，标记为非勾选生成
        setIsRemarkGeneratedByCheckbox(false);
      }
    }
    
    // 日期字段处理
    if (['etd', 'gateIn', 'eta', 'etb'].includes(key)) {
      // 直接使用 input[type="date"] 的值（YYYY-MM-DD 格式）
      setFormData(prev => ({ 
        ...prev, 
        [key]: value 
      }));
      
      // 更新本地显示格式
      if (value) {
        setLocalDates(prev => ({ 
          ...prev, 
          [key]: formatDateForDisplay(value) 
        }));
      } else {
        setLocalDates(prev => ({ ...prev, [key]: '' }));
      }
      
      // 关键修复：根据新的规则计算 WEEK
      if (key === 'etd' && value) {
        const newWeek = getWeekLabel(value);
        console.log(`计算 WEEK: ETD=${value} => WEEK=${newWeek}`);
        setFormData(prev => ({ 
          ...prev, 
          week: newWeek 
        }));
      } else if (key === 'etd' && !value) {
        // 如果 ETD 被清空，也清空 WEEK
        setFormData(prev => ({ 
          ...prev, 
          week: '' 
        }));
      }
      return;
    }
    
    // 数字字段处理
    if (key === 'qty') {
      const numValue = value === '' ? 0 : Number(value);
      if (isNaN(numValue)) {
        setValidationErrors(prev => ({ 
          ...prev, 
          [key]: 'Quantity must be a number' 
        }));
        return;
      }
      setFormData(prev => ({ 
        ...prev, 
        qty: numValue 
      }));
      return;
    }
    
    // 其他字段更新
    setFormData(prev => ({ 
      ...prev, 
      [key]: value 
    }));
  };

  // 验证表单数据 - 修改：CLIENT 和 CONTACT 都不是必填项
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // 检查必填字段，但排除 CLIENT 和 CONTACT 字段
    fields.forEach(field => {
      // 修改：跳过 CLIENT 和 CONTACT 字段的必填检查
      if (field.key === 'client' || field.key === 'contact') {
        return; // 跳过，不检查这些字段是否必填
      }
      
      if ((field.isSystem || field.required) && !formData[field.key as keyof Booking]) {
        errors[field.key] = `${field.label} 是必填字段`;
      }
    });
    
    // 特殊字段验证
    if (formData.qty !== undefined && isNaN(Number(formData.qty))) {
      errors.qty = 'Quantity must be a number';
    }
    
    // 检查日期格式
    const dateFields = ['etd', 'gateIn', 'eta', 'etb'];
    dateFields.forEach(dateField => {
      const dateValue = formData[dateField as keyof Booking];
      if (dateValue && !isValidDate(dateValue as string)) {
        errors[dateField] = 'Invalid date format';
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidDate = (dateString: string): boolean => {
    if (!dateString) return false;
    
    try {
      // 检查 YYYY-MM-DD 格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
      }
      
      const [year, month, day] = dateString.split('-').map(Number);
      
      // 检查日期是否有效
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      
      // 检查月份对应的天数
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && 
             date.getMonth() === month - 1 && 
             date.getDate() === day;
    } catch (error) {
      console.warn('日期验证错误:', error);
      return false;
    }
  };

  // 简化 handleSubmit 函数中的日期处理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    console.log('🚀 表单提交开始');
    console.log('📋 当前表单数据（新数据）:', {
      ...formData,
      // 特别关注 ETD
      etd: formData.etd,
      isEdit: !!initialData,
      isRolled: isRolled,
      isDelayed: isDelayed,
      isRemarkGeneratedByCheckbox: isRemarkGeneratedByCheckbox,
      snapshotValues: snapshotValues
    });
    console.log('📋 原始数据（旧数据）:', originalData);
    
    try {
      // 验证表单
      if (!validateForm()) {
        console.log('❌ 表单验证失败:', validationErrors);
        
        // 如果 ETD 验证失败，特别提示
        if (validationErrors.etd) {
          alert('ETD 日期是必填字段，请选择日期');
        }
        
        setIsSubmitting(false);
        return;
      }
      
      // 比较新旧数据，生成变更记录
      const changeRecord = compareBookingData(originalData, formData);
      
      // 处理表单数据
      const processedData: Partial<Booking> = { ...formData };

      console.log('📤 准备发送的数据（处理前）:', processedData);
      
      // 确保 ETD 字段存在且格式正确
      if (!processedData.etd || processedData.etd.trim() === '') {
        alert('ETD 日期是必填字段，请选择日期');
        setIsSubmitting(false);
        return;
      }
      
      // 验证 ETD 格式（应该是 YYYY-MM-DD）
      if (!isValidDate(processedData.etd as string)) {
        alert('ETD 日期格式不正确，请使用 YYYY-MM-DD 格式');
        setIsSubmitting(false);
        return;
      }
      
      console.log('✅ ETD 验证通过:', processedData.etd);
      
      // 确保 bookingRef 存在
      if (!processedData.bookingRef) {
        if (initialData?.bookingRef) {
          processedData.bookingRef = initialData.bookingRef;
        } else {
          const timestamp = new Date().getTime();
          const random = Math.random().toString(36).substr(2, 5).toUpperCase();
          processedData.bookingRef = `BK${timestamp}${random}`;
        }
      }
      
      // 确保 week 字段存在（从 ETD 计算）
      if (!processedData.week && processedData.etd) {
        processedData.week = getWeekLabel(processedData.etd as string);
      }
      
      // 确保数值字段是数字
      if (processedData.qty === undefined || processedData.qty === null) {
        processedData.qty = 0;
      } else {
        processedData.qty = Number(processedData.qty);
      }
      
      // 确保状态字段有值
      if (!processedData.state) {
        processedData.state = 'PENDING';
      }
      
      // 同时设置 status 字段（后端使用）
      processedData.status = processedData.state;
      
      // 如果是退舱操作，更新client为"未分配"
      if (changeRecord && changeRecord.change_type === 'rollback') {
        console.log('🔙 退舱操作，更新客户端为"未分配"');
        processedData.client = '';
      }
      
      // 注意：创建新预订时，不设置id，让后端生成
      // 只有编辑时才保留原有ID
      if (!initialData) {
        console.log('🆕 创建模式：不设置ID，让后端生成');
        // 不设置id字段
        delete processedData.id;
      } else {
        console.log('🔄 编辑模式：保留原有ID', initialData.id);
        processedData.id = initialData.id;
      }
      
      // 确保所有字段都有值，不是undefined
      const allFields = [...SYSTEM_FIELDS, ...Object.keys(BUSINESS_FIELD_MAPPING)];
      allFields.forEach(field => {
        if (processedData[field as keyof Booking] === undefined) {
          console.log(`⚠️ 字段 ${field} 为 undefined，设置为空字符串`);
          (processedData as any)[field] = '';
        }
      });
      
      console.log('✅ 最终要保存的数据:', {
        ...processedData,
        etd: processedData.etd,
        week: processedData.week,
        isEdit: !!initialData,
        client: processedData.client, // 特别显示client值
        contact: processedData.contact, // 显示contact值
        remark: processedData.remark  // 显示remark值
      });
      
      // 发送数据
      await onSave(processedData);
      
      console.log('✅ 表单提交成功');
      
      // 保存变更记录（如果有变更）
      if (changeRecord) {
        console.log('📝 保存变更记录（数据库自动生成时间）...');
        
        // 如果是退舱操作，确保在表单提交前更新formData中的client为"未分配"
        if (changeRecord.change_type === 'rollback') {
          console.log('🔙 退舱操作，更新客户端显示');
          // 更新表单数据中的client字段为"未分配"
          setFormData(prev => ({
            ...prev,
            client: ''
          }));
        }
        
        const saveSuccess = await saveChangeRecord(changeRecord);
        
        if (saveSuccess) {
          console.log('✅ 变更记录已保存，时间由数据库自动生成');
        } else {
          console.warn('⚠️ 变更记录保存失败，但不影响主操作');
          // 不阻止用户，只记录警告
        }
      } else {
        console.log('✅ 没有需要记录的变更');
      }
      
    } catch (error) {
      console.error('❌ 表单提交错误:', error);
      alert('保存失败，请重试');
      throw error; // 重新抛出错误
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({});
    setLocalDates({});
    setValidationErrors({});
    setIsInitialized(false);
    setIsSubmitting(false);
    setOriginalData({});
    setIsRolled(false); // 重置ROLLED状态
    setIsDelayed(false); // 重置DELAY状态
    setSnapshotValues({ etd: '', vessel: '', week: '' }); // 重置快照值
    setIsRemarkGeneratedByCheckbox(false); // 重置生成状态
    onClose();
  };

  if (!isOpen) return null;

  // Helper styles
  const labelStyle = "block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1";
  const inputContainerStyle = "relative group";
  const inputBaseStyle = "block w-full rounded-lg border-gray-200 bg-gray-50/50 px-4 py-2.5 text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200 sm:text-sm shadow-sm group-hover:bg-white group-hover:border-gray-300";

  // 在 BookingModal.tsx 的 getFieldRenderInfo 函数中，修改 VESSEL 字段的处理
  const getFieldRenderInfo = (field: FieldDefinition): { type: FieldType; mappedKey: string; options?: string[] } => {
    const key = field.key;
    
    console.log('🔍 获取字段渲染信息:', {
      fieldKey: key,
      fieldLabel: field.label,
      optionsMapKeys: Object.keys(optionsMap),
      typeInOptionsMap: optionsMap['type']?.length,
      containerTypesInOptionsMap: optionsMap['containerTypes']?.length
    });
    
    // 系统字段
    if (SYSTEM_FIELDS.includes(key)) {
      switch (key) {
        case 'week':
          return { type: 'WEEK', mappedKey: key };
        case 'etd':
          return { type: 'DATE', mappedKey: key };
        case 'state':
          return { 
            type: 'SELECT', 
            mappedKey: key,
            options: optionsMap[key] || []
          };
        case 'bookingRef':
          return { type: 'TEXT', mappedKey: key };
        default:
          return { type: field.type, mappedKey: key };
      }
    }
    
    // 修改：将 VESSEL 字段强制设置为 TEXT 类型
    if (key === 'vessel') {
      console.log('✅ VESSEL 字段强制设置为 TEXT 类型');
      return { type: 'TEXT', mappedKey: key };
    }
    
    // 业务字段 - 特殊处理 type 字段
    let businessKey = BUSINESS_FIELD_MAPPING[key] || key;
    
    // 关键修复：type 字段应该使用 containerTypes 的选项
    if (key === 'type' && optionsMap['containerTypes']?.length > 0) {
      businessKey = 'containerTypes';
    }
    
    // 确定字段类型
    let fieldType: FieldType = field.type;
    let options: string[] = [];
    
    // 如果是 SELECT 类型或有选项的字段
    if (field.type === 'SELECT' || optionsMap[businessKey]?.length > 0) {
      fieldType = 'SELECT';
      options = optionsMap[businessKey] || optionsMap[key] || [];
      
      // 如果是 type 字段但没有找到选项，尝试从字段本身的 options 获取
      if (key === 'type' && options.length === 0 && field.options?.length > 0) {
        options = field.options;
      }
    }
    
    // 日期字段
    if (['gateIn', 'eta', 'etb'].includes(key)) {
      fieldType = 'DATE';
    }
    
    // 数字字段
    if (key === 'qty') {
      fieldType = 'NUMBER';
    }
    
    console.log('✅ 最终字段信息:', {
      key,
      businessKey,
      fieldType,
      optionsCount: options.length
    });
    
    return {
      type: fieldType,
      mappedKey: businessKey,
      options: options
    };
  };

  // 获取字段显示标签 - 修改：CLIENT 和 CONTACT 字段不显示必填标记
  const getFieldLabel = (field: FieldDefinition) => {
    const renderInfo = getFieldRenderInfo(field);
    const isSystem = SYSTEM_FIELDS.includes(field.key);
    const isBusiness = BUSINESS_FIELD_MAPPING[field.key];
    
    let label = field.label;
    
    if (showFieldKeys) {
      label += ` (${field.key})`;
    }
    
    if (isSystem) {
      label += ' 🔒';
    } else if (isBusiness) {
      label += ' 📊';
    }
    
    return label;
  };

  // 渲染字段输入 - 修改：CLIENT 和 CONTACT 字段不是必填项，为ETD字段添加垂直排列的ROLLED和DELAY复选框（优化高度）
  const renderFieldInput = (field: FieldDefinition) => {
    const renderInfo = getFieldRenderInfo(field);
    const error = validationErrors[field.key];
    const hasError = !!error;
    const value = (formData as any)[field.key] || '';
    const isSystem = SYSTEM_FIELDS.includes(field.key);
    
    // 修改：CLIENT 和 CONTACT 字段不是必填项
    const isRequired = (field.key === 'client' || field.key === 'contact') ? false : (field.isSystem || field.required);
    
    console.log(`🎨 渲染字段 ${field.key}:`, {
      value,
      type: renderInfo.type,
      options: renderInfo.options?.length,
      isRequired: isRequired,
      isClientField: field.key === 'client',
      isContactField: field.key === 'contact'
    });
    
    // Week 字段（只读）
    if (renderInfo.type === 'WEEK') {
      return (
        <div className={inputContainerStyle}>
          <label className={labelStyle}>
            {getFieldLabel(field)} <span className="text-blue-400 text-[10px] ml-1">(Auto)</span>
          </label>
          <div className="relative">
            <input 
              readOnly
              value={value as string} 
              className={`${inputBaseStyle} bg-blue-50/50 text-blue-800 font-semibold pl-10 border-blue-100 cursor-default`} 
            />
            <Calendar className="w-4 h-4 text-blue-400 absolute left-3.5 top-3" />
            <Lock className="w-3.5 h-3.5 text-blue-300 absolute right-3 top-3.5 opacity-50" />
          </div>
        </div>
      );
    }

    // 修改 ETD 字段的渲染部分，调整复选框对齐方式

    // DATE 字段 - 优化 ETD 字段的 ROLLED/DELAY 复选框布局
    if (renderInfo.type === 'DATE') {
        const localDate = localDates[field.key] || '';
        
        console.log(`📅 日期字段 ${field.key}:`, { 
            value: value,
            localDisplay: localDate,
            inFormData: !!value,
            inLocalDates: !!localDate
        });
        
        // 只在ETD字段显示ROLLED和DELAY复选框
        const isEtdField = field.key === 'etd';
        const isEditMode = !!initialData && initialData.id;
        
        // 如果是 ETD 字段且是编辑模式，使用特殊布局
        if (isEtdField && isEditMode) {
            return (
                <div key={field.key} className={inputContainerStyle}>
                    <div className="flex items-center justify-between mb-2">
                        <label className={labelStyle}>
                            {getFieldLabel(field)} 
                            {isRequired && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        {hasError && (
                            <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        {/* 日期输入框 - 占主要宽度 */}
                        <div className="flex-1">
                            <input
                                type="date"
                                required={isRequired}
                                value={value}
                                onChange={(e) => handleChange(field.key, e.target.value)}
                                className={`${inputBaseStyle} h-[42px] ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
                                placeholder="选择日期"
                            />
                        </div>
                        
                        {/* ROLLED 和 DELAY 复选框 - 垂直排列，总高度与ETD输入框相同，左对齐 */}
                        <div className="flex flex-col min-w-[80px] h-[42px]">
                            {/* ROLLED复选框 - 红色主题，左对齐 */}
                            <div className="flex-1 flex items-center gap-1.5 bg-red-50/50 px-2 rounded-t-md border border-b-0 border-red-100 hover:border-red-200 transition-colors">
                                <input
                                    type="checkbox"
                                    id="rolled-checkbox"
                                    checked={isRolled}
                                    onChange={(e) => handleRolledChange(e.target.checked)}
                                    className="h-3.5 w-3.5 text-red-600 rounded focus:ring-1 focus:ring-red-500 cursor-pointer"
                                />
                                <label 
                                    htmlFor="rolled-checkbox" 
                                    className="text-xs font-medium text-red-700 whitespace-nowrap cursor-pointer select-none"
                                >
                                    ROLLED
                                </label>
                            </div>
                            
                            {/* DELAY复选框 - 蓝色主题，左对齐 */}
                            <div className="flex-1 flex items-center gap-1.5 bg-blue-50/50 px-2 rounded-b-md border border-t-0 border-blue-100 hover:border-blue-200 transition-colors">
                                <input
                                    type="checkbox"
                                    id="delay-checkbox"
                                    checked={isDelayed}
                                    onChange={(e) => handleDelayedChange(e.target.checked)}
                                    className="h-3.5 w-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                />
                                <label 
                                    htmlFor="delay-checkbox" 
                                    className="text-xs font-medium text-blue-700 whitespace-nowrap cursor-pointer select-none"
                                >
                                    DELAY
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        
        // 其他日期字段（gateIn, eta, etb）保持原样
        return (
            <div key={field.key} className={inputContainerStyle}>
                <div className="flex items-center justify-between mb-2">
                    <label className={labelStyle}>
                        {getFieldLabel(field)} 
                        {isRequired && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {hasError && (
                        <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </span>
                    )}
                </div>
                
                <input
                    type="date"
                    required={isRequired}
                    value={value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className={`${inputBaseStyle} ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
                    placeholder="选择日期"
                />
            </div>
        );
    }

    // SELECT 字段
    if (renderInfo.type === 'SELECT') {
      const options = renderInfo.options || [];
      console.log(`📋 SELECT字段 ${field.key} 选项:`, options);
      
      return (
        <div key={field.key} className={inputContainerStyle}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelStyle}>
              {getFieldLabel(field)} 
              {isRequired && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {hasError && (
              <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
          
          <div className="relative">
            <select
              required={isRequired}
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`${inputBaseStyle} appearance-none cursor-pointer ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
            >
              <option value="" className="text-gray-400">
                {options.length ? '请选择...' : '无可用选项'}
              </option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      );
    }

    // NUMBER 字段
    if (renderInfo.type === 'NUMBER') {
      return (
        <div key={field.key} className={inputContainerStyle}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelStyle}>
              {getFieldLabel(field)} 
              {isRequired && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {hasError && (
              <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
          
          <input
            type="number"
            min="0"
            step="1"
            required={isRequired}
            value={value as string | number}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className={`${inputBaseStyle} ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
            placeholder={`输入 ${field.label}...`}
          />
        </div>
      );
    }

    // TEXT 字段（带 datalist）
    if (renderInfo.options && renderInfo.options.length > 0) {
      const datalistId = `${field.key}-options`;
      
      return (
        <div key={field.key} className={inputContainerStyle}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelStyle}>
              {getFieldLabel(field)} 
              {isRequired && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {hasError && (
              <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
          
          <div className="relative">
            <input
              type="text"
              list={datalistId}
              required={isRequired}
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`${inputBaseStyle} ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
              placeholder={`输入 ${field.label}...`}
            />
            <datalist id={datalistId}>
              {renderInfo.options.map((option, index) => (
                <option key={index} value={option} />
              ))}
            </datalist>
          </div>
        </div>
      );
    }

    // CONTACT字段 - 新增：与JOB字段类似，使用SELECT类型
    if (field.key === 'contact') {
      const options = optionsMap['contact'] || optionsMap['jobs'] || [];
      
      return (
        <div key={field.key} className={inputContainerStyle}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelStyle}>
              {getFieldLabel(field)} 
              {/* CONTACT不是必填项 */}
            </label>
            {hasError && (
              <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
          
          <div className="relative">
            <select
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={`${inputBaseStyle} appearance-none cursor-pointer`}
            >
              <option value="" className="text-gray-400">
                {options.length ? '请选择合约方...' : '无可用选项'}
              </option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      );
    }

    // 默认 TEXT 字段（包括 VESSEL 字段和 REMARK 字段）
    // 特殊处理 REMARK 字段
    if (field.key === 'remark') {
      const remarkValue = value as string;
      const isRolledRemark = isRolledRemarkFormat(remarkValue);
      const isDelayedRemark = isDelayedRemarkFormat(remarkValue);
      
      return (
        <div key={field.key} className={inputContainerStyle}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelStyle}>
              {getFieldLabel(field)} 
              {isRequired && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {hasError && (
              <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </span>
            )}
          </div>
          
          {/* REMARK字段 - 始终显示为文本域，用户可以自由编辑 */}
          <textarea
            value={remarkValue}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className={`${inputBaseStyle} min-h-[80px] resize-y ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
            placeholder="输入备注..."
            rows={3}
          />
        </div>
      );
    }

    // 其他普通TEXT字段
    return (
      <div key={field.key} className={inputContainerStyle}>
        <div className="flex items-center justify-between mb-2">
          <label className={labelStyle}>
            {getFieldLabel(field)} 
            {isRequired && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          {hasError && (
            <span className="text-red-500 text-[10px] font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>
        
        <input
          type="text"
          required={isRequired}
          value={value as string}
          onChange={(e) => handleChange(field.key, e.target.value)}
          className={`${inputBaseStyle} ${hasError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}`}
          placeholder={`输入 ${field.label}...`}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-all duration-300 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
        
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${initialData ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                {initialData && initialData.id ? '编辑预订记录' : '创建新预订'}
              </h3>
              
              {/* 如果是复制新建模式，显示额外指示 */}
              {initialData && !initialData.id && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-block">
                    📋 复制新建模式
                  </div>
                  <div className="text-xs text-gray-500">
                    （新记录将插入到原记录下方）
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-500 font-medium">
                  {initialData && initialData.id ? `Ref: ${initialData.bookingRef || 'Unknown'}` : '输入物流详细信息'}
                </p>
                <button 
                  onClick={() => setShowFieldKeys(!showFieldKeys)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  title={showFieldKeys ? "隐藏字段标识" : "显示字段标识"}
                >
                  <Key className="w-3 h-3" />
                  {showFieldKeys ? 'Hide Keys' : 'Show Keys'}
                </button>
                {/* 添加调试按钮 */}
                <button 
                  onClick={() => {
                    console.log('🔍 调试表单数据:', {
                      formData,
                      originalData,
                      localDates,
                      initialData,
                      fields: fields.map(f => ({ key: f.key, label: f.label })),
                      isRolled: isRolled,
                      isDelayed: isDelayed,
                      isRemarkGeneratedByCheckbox: isRemarkGeneratedByCheckbox,
                      snapshotValues: snapshotValues
                    });
                    alert('查看控制台查看详细数据');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-1 ml-2"
                  title="调试表单数据"
                >
                  <span className="text-xs">🐛</span>
                  Debug
                </button>
              </div>
            </div>
          </div>
          <button 
            onClick={resetForm} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 p-2 rounded-full transition-all"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto p-8 custom-scrollbar">
          <form onSubmit={handleSubmit} id="bookingForm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              {sortedFields.map(field => {
                // 特殊处理 JOB 和 CONTACT 字段，让它们在同一行
                if (field.key === 'job') {
                  return (
                    <div key={field.key} className="col-span-1">
                      {renderFieldInput(field)}
                    </div>
                  );
                }
                
                // CONTACT 字段放在 JOB 旁边
                if (field.key === 'contact') {
                  return (
                    <div key={field.key} className="col-span-1">
                      {renderFieldInput(field)}
                    </div>
                  );
                }
                
                // 其他字段正常渲染
                return renderFieldInput(field);
              })}
            </div>
            
            {/* 字段说明 */}
            {/* <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Info className="w-4 h-4" />
                <span>字段说明: </span>
                <span className="text-blue-500">🔒 系统字段</span>
                <span className="mx-2">•</span>
                <span className="text-green-500">📊 业务字段</span>
                <span className="mx-2">•</span>
                <span className="text-gray-400">其他字段</span>
                <span className="mx-2">|</span>
                <span className="text-amber-500">⚠️ CLIENT/CONTACT 非必填项</span>
                <span className="mx-2">|</span>
                <span className="text-red-500">⏱️ ROLLED 甩柜标记</span>
                <span className="mx-2">|</span>
                <span className="text-blue-500">⏱️ DELAY 晚开标记</span>
              </div>
            </div> */}
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-8 py-5 border-t border-gray-100 bg-gray-50/30">
          <div className="flex-1">
            {Object.keys(validationErrors).length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>请修正上述错误后再保存</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={resetForm} 
              className="text-gray-600 hover:bg-gray-100"
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              form="bookingForm" 
              className="shadow-lg shadow-blue-500/30 px-6"
              disabled={!isInitialized || isSubmitting || Object.keys(validationErrors).length > 0}
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  保存中...
                </>
              ) : initialData ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  保存更改
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  创建预订
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};