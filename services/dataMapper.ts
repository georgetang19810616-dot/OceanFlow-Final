import { 
  User, Database as DatabaseType, Booking, Quotation, 
  UserRole, Permission, SystemSettings, FieldDefinition, FieldType, DatabaseAccess, Allocation, GateInRate, GateInRateItem
} from '../types';

// 导入日期工具函数
import { 
  formatDateForDisplay, 
  formatDateForInput,
  isDateField 
} from '../utils/dateUtils';

// ==================== 辅助函数 ====================
// 添加 Allocation 转换函数
function convertToAllocationArray(data: any): Allocation[] {
  if (!data) return [];
  
  if (Array.isArray(data)) {
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
          note: item.note || item.description || ''
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
  } else if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return convertToAllocationArray(parsed);
    } catch (e) {
      console.warn('解析 allocations 字符串失败:', e);
      return [];
    }
  }
  
  return [];
}

const safeParseArray = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

// 修改：更新 GateInRate 解析函数以匹配新的数据结构
const safeParseGateInRates = (value: any): GateInRate[] => {
  if (!value) return [];
  
  if (Array.isArray(value)) {
    return value.map((rate: any) => {
      // 解析 items 数组
      let items: GateInRateItem[] = [];
      if (Array.isArray(rate.items)) {
        items = rate.items.map((item: any) => ({
          id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pols: Array.isArray(item.pols) ? item.pols : (item.pols ? [item.pols] : []),
          pods: Array.isArray(item.pods) ? item.pods : (item.pods ? [item.pods] : []),
          containerTypes: Array.isArray(item.containerTypes) ? item.containerTypes : 
                         (item.containerTypes ? [item.containerTypes] : []),
          price: Number(item.price) || 0
        }));
      } else if (rate.pols || rate.pods || rate.containerTypes) {
        // 兼容旧的数据结构：单个价格项目
        items = [{
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          pols: Array.isArray(rate.pols) ? rate.pols : (rate.pols ? [rate.pols] : []),
          pods: Array.isArray(rate.pods) ? rate.pods : (rate.pods ? [rate.pods] : []),
          containerTypes: Array.isArray(rate.containerTypes) ? rate.containerTypes : 
                         (rate.containerTypes ? [rate.containerTypes] : []),
          price: Number(rate.price) || 0
        }];
      }
      
      return {
        id: rate.id || `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startDate: rate.startDate || rate.start_date || '',
        endDate: rate.endDate || rate.end_date || '',
        service: rate.service || '',
        contact: rate.contact || '',
        items: items
      };
    });
  }
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return safeParseGateInRates(parsed);
    } catch (e) {
      console.warn('解析 gateInRates 字符串失败:', e);
      return [];
    }
  }
  
  return [];
};

// ==================== 用户数据映射 ====================
export const mapUserFromApi = (apiUser: any): User => {
  console.log('📥 映射用户数据:', apiUser?.username);
  
  // 确保权限是数组格式
  let permissions: Permission[] = [];
  if (apiUser.permissions) {
    if (Array.isArray(apiUser.permissions)) {
      permissions = apiUser.permissions.map(p => String(p) as Permission);
    } else if (typeof apiUser.permissions === 'string') {
      try {
        const parsed = JSON.parse(apiUser.permissions);
        if (Array.isArray(parsed)) {
          permissions = parsed.map(p => String(p) as Permission);
        }
      } catch (e) {
        console.warn('解析用户权限失败:', e);
      }
    }
  }
  
  // 处理 databaseAccess/database_access 字段 - 修复版本
  let databaseAccess: DatabaseAccess[] = [];
  
  // 首先检查 databaseAccess 字段
  if (apiUser.databaseAccess) {
    if (Array.isArray(apiUser.databaseAccess)) {
      databaseAccess = apiUser.databaseAccess;
    } else if (typeof apiUser.databaseAccess === 'string') {
      try {
        const parsed = JSON.parse(apiUser.databaseAccess);
        if (Array.isArray(parsed)) {
          databaseAccess = parsed;
        }
      } catch (e) {
        console.warn('解析 databaseAccess 失败:', e);
      }
    }
  } 
  // 然后检查 database_access 字段（数据库列名）
  else if (apiUser.database_access) {
    console.log('🔍 解析 database_access 字段:', apiUser.database_access);
    
    if (Array.isArray(apiUser.database_access)) {
      databaseAccess = apiUser.database_access;
    } else if (typeof apiUser.database_access === 'string') {
      try {
        if (apiUser.database_access.trim() === '') {
          databaseAccess = [];
        } else {
          const parsed = JSON.parse(apiUser.database_access);
          console.log('✅ 解析后的 database_access:', parsed);
          if (Array.isArray(parsed)) {
            databaseAccess = parsed;
          }
        }
      } catch (e) {
        console.warn('解析 database_access 失败:', e, '原始数据:', apiUser.database_access);
        // 尝试清理数据
        try {
          // 可能是双重编码的 JSON
          const cleaned = apiUser.database_access.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            databaseAccess = parsed;
          }
        } catch (e2) {
          console.warn('清理后仍然解析失败:', e2);
        }
      }
    }
  }
  
  // 打印调试信息
  console.log('📊 最终数据库权限:', {
    username: apiUser.username,
    hasDatabaseAccess: databaseAccess.length > 0,
    count: databaseAccess.length,
    databases: databaseAccess.map(da => da.databaseName)
  });
  
  return {
    id: apiUser.id,
    username: apiUser.username || '',
    password: apiUser.password || '',
    firstName: apiUser.firstName || apiUser.first_name || '',
    lastName: apiUser.lastName || apiUser.last_name || '',
    role: (apiUser.role as UserRole) || UserRole.USER,
    permissions: permissions,
    databaseAccess: databaseAccess,
    isApproved: Boolean(apiUser.isApproved || apiUser.is_approved),
    isActive: apiUser.isActive !== false,
    avatarUrl: apiUser.avatarUrl || apiUser.avatar_url || '',
    createdAt: apiUser.createdAt || apiUser.created_at || new Date().toISOString(),
    updatedAt: apiUser.updatedAt || apiUser.updated_at || new Date().toISOString(),
    lastLogin: apiUser.lastLogin || apiUser.last_login || null
  };
};

export const mapUserToApi = (user: User): any => {
  return {
    id: user.id,
    username: user.username,
    password: user.password,
    first_name: user.firstName,
    last_name: user.lastName || '',
    role: user.role,
    permissions: JSON.stringify(user.permissions || []),
    is_approved: user.isApproved,
    avatar_url: user.avatarUrl || '',
    is_active: user.isActive !== undefined ? user.isActive : true,
    database_access: JSON.stringify(user.databaseAccess || [])
  };
};

// ==================== 预订数据映射 ====================
export const mapBookingFromApi = (apiBooking: any): Booking => {
  console.log('📥 映射API预订数据:', { 
    id: apiBooking?.id,
    etd: apiBooking?.etd,
    hasData: !!apiBooking?.data
  });
  
  // 解析data字段
  let data = apiBooking?.data || {};
  
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
      console.log('✅ 成功解析 data 字符串:', {
        etd: data?.etd,
        client: data?.client,
        carrier: data?.carrier,
        contact: data?.contact  // 添加contact字段的日志
      });
    } catch (e) {
      console.warn('解析 data 字段失败:', e);
      data = {};
    }
  }
  
  // 关键修复：确保 ETD 字段正确获取
  // 优先级：1. apiBooking.etd（直接字段） 2. data.etd 3. 空字符串
  let etdValue = '';
  if (apiBooking?.etd) {
    etdValue = apiBooking.etd;
    console.log('✅ 从 apiBooking.etd 获取:', etdValue);
  } else if (data?.etd) {
    etdValue = data.etd;
    console.log('✅ 从 data.etd 获取:', etdValue);
  }
  
  // 使用新的时区处理方案：后端已经将日期转换为前端本地时间
  // 我们只需要确保它是 YYYY-MM-DD 格式
  if (etdValue && etdValue.includes('T')) {
    etdValue = etdValue.split('T')[0];
    console.log('🧹 清理 ETD 格式:', etdValue);
  }
  
  // 处理其他日期字段
  const dateFields = ['gateIn', 'eta', 'etb'];
  const processedDateFields: Record<string, string> = {};
  
  dateFields.forEach(field => {
    let dateValue = data?.[field] || apiBooking?.[field] || '';
    if (dateValue && dateValue.includes('T')) {
      dateValue = dateValue.split('T')[0];
    }
    processedDateFields[field] = dateValue;
  });
  
  // 构建预订对象
  const booking: Booking = {
    id: apiBooking?.id || `booking_${Date.now()}`,
    
    // 系统字段（直接存储在bookings表）
    week: apiBooking?.week || '',
    bookingRef: apiBooking?.bookingref || apiBooking?.bookingRef || '',
    etd: etdValue, // 使用清理后的 ETD 值
    state: apiBooking?.status || apiBooking?.state || 'PENDING',
    isLocked: apiBooking?.is_locked || apiBooking?.isLocked || false,
    finance: apiBooking?.finance || {},
    
    // 业务字段 - 优先从解析的 data 中获取，其次从直接字段获取
    client: data?.client || apiBooking?.client || '',
    carrier: data?.carrier || apiBooking?.carrier || '',
    service: data?.service || apiBooking?.service || '',
    pol: data?.pol || apiBooking?.pol || '',
    pod: data?.pod || apiBooking?.pod || '',
    vessel: data?.vessel || apiBooking?.vessel || '',
    type: data?.type || apiBooking?.type || '',
    qty: Number(data?.qty || apiBooking?.qty || 0),
    
    // 日期字段使用处理后的值
    gateIn: processedDateFields.gateIn || '',
    eta: processedDateFields.eta || '',
    etb: processedDateFields.etb || '',
    
    job: data?.job || apiBooking?.job || '',
    contact: data?.contact || apiBooking?.contact || '', // 新增：contact字段
    allocation: data?.allocation || apiBooking?.allocation || '',
    remark: data?.remark || apiBooking?.remark || '',
    
    // 时间戳
    createdAt: apiBooking?.created_at || apiBooking?.createdAt || new Date().toISOString(),
    updatedAt: apiBooking?.updated_at || apiBooking?.updatedAt || new Date().toISOString()
  };
  
  // 保存完整的 data 对象，以防需要访问其他字段
  if (Object.keys(data).length > 0) {
    (booking as any).data = data;
  }
  
  console.log('✅ 映射后的预订对象:', {
    id: booking.id,
    bookingRef: booking.bookingRef,
    etd: booking.etd,
    client: booking.client,
    carrier: booking.carrier,
    contact: booking.contact, // 添加contact字段的日志
    gateIn: booking.gateIn
  });
  
  return booking;
};

export const mapBookingToApi = (booking: Booking, databaseId: string): any => {
  console.log('📤 映射预订数据到API:', { 
    id: booking.id, 
    bookingRef: booking.bookingRef,
    databaseId,
    isCreate: !booking.id || booking.id === '',
    contact: booking.contact // 添加contact字段的日志
  });
  
  // 构建data JSON对象 - 包含所有业务字段
  const data: Record<string, any> = {};
  
  // 业务字段列表（存储在data JSON中）
  const businessFields = [
    'client', 'carrier', 'service', 'pol', 'pod', 'vessel',
    'type', 'qty', 'gateIn', 'job', 'contact', 'allocation', 'remark',
    'eta', 'etb'
  ];
  
  // 添加业务字段到data
  businessFields.forEach(field => {
    const value = booking[field as keyof Booking];
    if (value !== undefined && value !== null && value !== '') {
      // 对于日期字段，确保是 YYYY-MM-DD 格式
      if (isDateField(field) && typeof value === 'string') {
        data[field] = formatDateForInput(value); // 确保正确的格式
      } else {
        data[field] = value;
      }
    } else {
      data[field] = '';
    }
  });
  
  // 确保finance对象存在
  data.finance = booking.finance || {};
  
  // 创建返回对象
  const result = {
    dbId: databaseId,
    booking: {
      // 只在ID存在且不为空时包含id字段
      ...(booking.id && booking.id.trim() !== '' && { id: booking.id }),
      week: booking.week || '',
      bookingref: booking.bookingRef || '',
      etd: formatDateForInput(booking.etd || ''), // 确保 ETD 格式正确
      statuse: booking.state || 'PENDING',
      is_locked: booking.isLocked || false,
      finance: booking.finance || {},
      data: data
    }
  };
  
  console.log('✅ 映射结果:', {
    hasId: !!result.booking.id,
    bookingRef: result.booking.bookingref,
    etd: result.booking.etd,
    gateIn: data.gateIn,
    contact: data.contact // 添加contact字段的日志
  });
  
  return result;
};

// ==================== 数据库映射 ====================
export const mapDatabaseFromApi = (apiDatabase: any): DatabaseType => {
  console.log('📥 映射数据库数据:', apiDatabase?.name);
  
  // 映射预订数据
  const bookings = (apiDatabase.bookings || []).map(mapBookingFromApi);
  
  // 处理字段定义
  const defaultFields: FieldDefinition[] = [
    { key: 'state', label: 'Status', type: 'SELECT', width: 'w-28', isSystem: true, required: true, defaultValue: 'PENDING' },
    { key: 'week', label: 'Week', type: 'WEEK', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'bookingRef', label: 'Booking Ref', type: 'TEXT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'carrier', label: 'Carrier', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'client', label: 'Client', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'service', label: 'Service', type: 'SELECT', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'pol', label: 'POL', type: 'SELECT', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'pod', label: 'POD', type: 'SELECT', width: 'w-24', isSystem: true, required: true, defaultValue: '' },
    { key: 'etd', label: 'ETD', type: 'DATE', width: 'w-32', isSystem: true, required: true, defaultValue: '' },
    { key: 'vessel', label: 'Vessel', type: 'TEXT', width: 'w-40', isSystem: true, required: false, defaultValue: '' },
    { key: 'type', label: 'Type', type: 'SELECT', width: 'w-24', isSystem: true, required: false, defaultValue: '' },
    { key: 'qty', label: 'QTY', type: 'NUMBER', width: 'w-20', isSystem: true, required: false, defaultValue: '' },
    { key: 'gateIn', label: 'Gate In', type: 'DATE', width: 'w-32', isSystem: true, required: false, defaultValue: '' },
    { key: 'job', label: 'Job', type: 'SELECT', width: 'w-24', isSystem: true, required: false, defaultValue: '' },
    { key: 'allocation', label: 'Allocation', type: 'SELECT', width: 'w-28', isSystem: true, required: false, defaultValue: '' },
    { key: 'remark', label: 'Remark', type: 'TEXT', width: 'w-48', isSystem: true, required: false, defaultValue: '' },
  ];
  
  // 合并数据库中的字段
  let fields = [...defaultFields];
  if (apiDatabase.fields && Array.isArray(apiDatabase.fields)) {
    apiDatabase.fields.forEach((apiField: any) => {
      // 检查是否已存在
      const exists = fields.some(f => f.key === apiField.key);
      if (!exists) {
        fields.push({
          key: apiField.key,
          label: apiField.label || apiField.key,
          type: (apiField.type || 'TEXT') as FieldType,
          width: apiField.width || 'w-32',
          isSystem: false,
          options: apiField.options || []
        });
      }
    });
  }
  
  return {
    id: apiDatabase.id || `db_${Date.now()}`,
    name: apiDatabase.name || 'Unnamed Database',
    description: apiDatabase.description || '',
    fields: fields,
    bookings: bookings,
    createdAt: apiDatabase.created_at || apiDatabase.createdAt || new Date().toISOString(),
    updatedAt: apiDatabase.updated_at || apiDatabase.updatedAt || new Date().toISOString(),
    bookingsCount: apiDatabase.bookingsCount || bookings.length
  };
};

// ==================== 报价数据映射 ====================
export const mapQuotationFromApi = (apiQuotation: any): Quotation => {
  console.log('📥 映射报价数据:', apiQuotation?.carrier);
  
  // 解析data字段
  let data = apiQuotation.data || {};
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.warn('解析报价data字段失败:', e);
      data = {};
    }
  }
  
  // 处理日期字段
  let etdValue = apiQuotation.etd || '';
  if (etdValue && etdValue.includes('T')) {
    etdValue = etdValue.split('T')[0];
  }
  
  let validityValue = data.validity || '';
  if (validityValue && validityValue.includes('T')) {
    validityValue = validityValue.split('T')[0];
  }
  
  let cutSiValue = data.cutSi || '';
  if (cutSiValue && cutSiValue.includes('T')) {
    cutSiValue = cutSiValue.split('T')[0];
  }
  
  return {
    id: apiQuotation.id || `quote_${Date.now()}`,
    region: apiQuotation.region || '',
    carrier: apiQuotation.carrier || '',
    pol: apiQuotation.pol || '',
    pod: apiQuotation.pod || '',
    vessel: apiQuotation.vessel || '',
    etd: etdValue,
    
    // 价格字段
    price20: data.price20 || '',
    price40: data.price40 || '',
    price40hq: data.price40hq || '',
    price40nor: data.price40nor || '',
    price45: data.price45 || '',
    
    // 其他业务字段
    transitTime: data.transitTime || '',
    validity: validityValue,
    cutSi: cutSiValue,
    remarks: data.remarks || '',
    freetime: data.freetime || '',
    availableFfe: data.availableFfe || '',
    
    // 时间戳
    createdAt: apiQuotation.created_at || apiQuotation.createdAt || new Date().toISOString(),
    updatedAt: apiQuotation.updated_at || apiQuotation.updatedAt || new Date().toISOString()
  };
};

export const mapQuotationToApi = (quotation: Quotation): any => {
  console.log('📤 映射报价数据到API:', quotation.carrier);
  
  // 处理日期字段
  const etdValue = formatDateForInput(quotation.etd || '');
  const validityValue = formatDateForInput(quotation.validity || '');
  const cutSiValue = formatDateForInput(quotation.cutSi || '');
  
  // 构建data JSON对象
  const data = {
    price20: quotation.price20 || '',
    price40: quotation.price40 || '',
    price40hq: quotation.price40hq || '',
    price40nor: quotation.price40nor || '',
    price45: quotation.price45 || '',
    transitTime: quotation.transitTime || '',
    validity: validityValue,
    cutSi: cutSiValue,
    remarks: quotation.remarks || '',
    freetime: quotation.freetime || '',
    availableFfe: quotation.availableFfe || ''
  };
  
  return {
    // id: quotation.id,
    // region: quotation.region || '',
    // carrier: quotation.carrier || '',
    // pol: quotation.pol || '',
    // pod: quotation.pod || '',
    // vessel: quotation.vessel || '',
    // etd: etdValue,
    // data: data
    id: quotation.id,
    carrier: quotation.carrier || '',
    region: quotation.region || '',
    pol: quotation.pol || '',
    pod: quotation.pod || '',
    service: quotation.service || '',
    containerType: quotation.containerType || '',
    rate: quotation.rate || 0,  // 确保有默认值 0
    validity: quotation.validity || '',
    remark: quotation.remark || '',
    vessel: quotation.vessel || '',
    etd: quotation.etd || ''
  };
};

// ==================== 系统设置映射 ====================
export const mapSettingsFromApi = (apiSettings: any): SystemSettings => {
  console.log('📥 映射系统设置数据');
  
  // 处理 allocations - 使用新的转换函数
  const allocations = convertToAllocationArray(apiSettings.allocations);
  
  console.log('✅ 转换后的 allocations:', {
    raw: apiSettings.allocations,
    converted: allocations,
    count: allocations.length
  });
  
  // 处理 gateInRates - 使用更新后的解析函数
  const gateInRates = safeParseGateInRates(apiSettings.gateinrates || apiSettings.gateInRates);
  
  console.log('✅ 转换后的 gateInRates:', {
    raw: apiSettings.gateinrates || apiSettings.gateInRates,
    converted: gateInRates,
    count: gateInRates.length,
    totalItems: gateInRates.reduce((total, rate) => total + rate.items.length, 0)
  });
  
  return {
    carriers: safeParseArray(apiSettings.carriers),
    clients: safeParseArray(apiSettings.clients),
    services: safeParseArray(apiSettings.services),
    pols: safeParseArray(apiSettings.pols),
    pods: safeParseArray(apiSettings.pods),
    containerTypes: safeParseArray(apiSettings.types || apiSettings.containerTypes),
    statuses: safeParseArray(apiSettings.status || apiSettings.statuses),
    jobs: safeParseArray(apiSettings.jobs),
    allocations: allocations, // 使用转换后的 Allocation 数组
    remarks: safeParseArray(apiSettings.remarks),
    gateInRates: gateInRates
  };
};

// ==================== 反向映射：设置数据到API ====================
export const mapSettingsToApi = (settings: SystemSettings): any => {
  console.log('📤 映射设置数据到API');
  
  // 将 Allocation 数组转换为后端期望的格式
  const allocationsForApi = settings.allocations.map(allocation => allocation.value);
  
  return {
    carriers: JSON.stringify(settings.carriers),
    clients: JSON.stringify(settings.clients),
    services: JSON.stringify(settings.services),
    pols: JSON.stringify(settings.pols),
    pods: JSON.stringify(settings.pods),
    containerTypes: JSON.stringify(settings.containerTypes),
    statuses: JSON.stringify(settings.statuses),
    jobs: JSON.stringify(settings.jobs),
    allocations: JSON.stringify(allocationsForApi), // 发送字符串数组
    remarks: JSON.stringify(settings.remarks),
    gateInRates: JSON.stringify(settings.gateInRates) // 发送新的数据结构
  };
};
