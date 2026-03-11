import { 
  User, Database, Quotation, Booking, 
  Permission, UserRole, BookingState, 
  FinanceData, FieldDefinition, GateInRate,
  SystemSettings
} from '../types';

// 导入数据映射函数
import {
  mapBookingFromApi,
  mapBookingToApi,
  mapQuotationFromApi,
  mapQuotationToApi,
  mapUserFromApi,
  mapDatabaseFromApi
} from './dataMapper';

// ==================== API配置 ====================
// 自动检测环境并设置API基础URL
const getApiBase = () => {
  const { protocol, hostname, port } = window.location;
  
  // 开发环境 - localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  // 生产环境 - 使用当前域名
  return '/api';
};

const API_BASE = getApiBase();
console.log('🌐 API Base URL:', API_BASE);

// 默认请求头
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// ==================== 认证辅助函数 ====================
// 获取包含认证信息的请求头
const getAuthHeaders = (): HeadersInit => {
  // 从localStorage或sessionStorage获取token
  const token = localStorage.getItem('auth_token') || 
                 sessionStorage.getItem('auth_token');
  
  console.log('🔐 获取认证令牌:', token ? '已找到' : '未找到');
  
  const headers: HeadersInit = {
    ...defaultHeaders
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// ==================== 错误处理函数 ====================
const handleApiError = async (response: Response): Promise<any> => {
  // 检查响应是否为JSON
  const contentType = response.headers.get('content-type');
  let errorData;
  
  if (contentType && contentType.includes('application/json')) {
    errorData = await response.json();
  } else {
    const text = await response.text();
    console.error('❌ 服务器返回非JSON响应:', { 
      status: response.status, 
      statusText: response.statusText,
      preview: text.substring(0, 200) 
    });
    throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
  }
  
  if (!response.ok) {
    const errorMessage = errorData.error || errorData.message || `API错误: ${response.status} ${response.statusText}`;
    console.error('❌ API请求失败:', {
      status: response.status,
      message: errorMessage,
      data: errorData
    });
    throw new Error(errorMessage);
  }
  
  return errorData;
};

// 重试机制
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 2): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    
    // 仅对服务器错误重试
    if (!response.ok && retries > 0 && response.status >= 500) {
      console.log(`🔄 重试请求: ${url}, 剩余尝试: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`🌐 网络错误，重试请求: ${url}, 剩余尝试: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
};

// ==================== API 服务 ====================
export const apiService = {
  // --- 健康检查 ---
  checkHealth: async (): Promise<{ 
    status: string; 
    timestamp: string; 
    version: string; 
    database: string;
    uptime: number;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await handleApiError(res);
    } catch (error) {
      console.error('❌ 健康检查失败:', error);
      throw error;
    }
  },

  // --- 初始化数据 ---
  loadAllData: async (): Promise<{
    users: any[];
    databases: any[];
    settings: SystemSettings;
    stats: any;
    message: string;
    timestamp: string;
  }> => {
    try {
      console.log('📥 加载初始化数据...');
      
      const res = await fetch(`${API_BASE}/init`, {
        method: 'GET',
        headers: defaultHeaders,
        // 添加超时
        signal: AbortSignal.timeout(10000)
      });
      
      // 检查响应状态
      if (!res.ok) {
        console.error(`❌ API响应状态: ${res.status} ${res.statusText}`);
        
        // 如果是500错误，尝试修复数据库
        if (res.status === 500) {
          console.log('🔄 检测到500错误，尝试修复数据库...');
          try {
            const fixRes = await fetch(`${API_BASE}/fix-db`, {
              method: 'POST',
              headers: defaultHeaders
            });
            
            if (fixRes.ok) {
              console.log('✅ 数据库修复成功，重新加载数据...');
              // 重新尝试
              return apiService.loadAllData();
            }
          } catch (fixError) {
            console.error('❌ 数据库修复失败:', fixError);
          }
        }
        
        // 尝试获取更详细的错误信息
        let errorText = '未知错误';
        try {
          errorText = await res.text();
          console.error('❌ 响应内容:', errorText.substring(0, 200));
        } catch (e) {
          console.error('❌ 无法读取响应文本');
        }
        
        throw new Error(`API错误 ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // 确保数据结构完整
      if (!data.success) {
        console.warn('⚠️ API返回 success: false', data.error);
      }
      
      console.log('✅ 初始化数据加载完成:', {
        users: data.users?.length || 0,
        // 确保返回所有用户，不进行过滤
        allUsers: true,
        databases: data.databases?.length || 0,
        hasSettings: !!data.settings,
        statusesCount: data.settings?.statuses?.length || 0
      });
      
      // 返回确保有完整结构的数据
      return {
        users: data.users || [],
        databases: data.databases || [],
        settings: {
          carriers: data.settings?.carriers || [],
          clients: data.settings?.clients || [],
          services: data.settings?.services || [],
          pols: data.settings?.pols || [],
          pods: data.settings?.pods || [],
          containerTypes: data.settings?.containerTypes || [],
          statuses: data.settings?.statuses || ['PENDING', 'CONFIRMED', 'ROLLED'], // 关键默认值
          jobs: data.settings?.jobs || [],
          allocations: data.settings?.allocations || [],
          remarks: data.settings?.remarks || [],
          gateInRates: data.settings?.gateInRates || []
        },
        stats: data.stats || {
          bookings: 0,
          quotations: 0,
          users: data.users?.length || 0, // 更新用户统计
          databases: 0
        },
        message: data.message || '数据加载完成',
        timestamp: data.timestamp || new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 加载初始化数据失败:', error);
      
      // 返回安全的模拟数据，确保前端可以运行
      return {
        users: [],
        databases: [{
          id: 'default-db',
          name: '默认数据库',
          description: '系统自动创建',
          color: '#3B82F6',
          icon: 'database',
          isActive: true,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          bookingsCount: 0
        }],
        settings: {
          carriers: ['MAERSK', 'MSC'],
          clients: ['客户A', '客户B'],
          services: ['FCL', 'LCL'],
          pols: ['SHANGHAI', 'NINGBO'],
          pods: ['LOS ANGELES', 'LONG BEACH'],
          containerTypes: ['20GP', '40GP', '40HQ'],
          statuses: ['PENDING', 'CONFIRMED', 'ROLLED'], // 确保有这个字段
          jobs: [],
          allocations: [],
          remarks: [],
          gateInRates: []
        },
        stats: {
          bookings: 0,
          quotations: 0,
          users: 0,
          databases: 1
        },
        message: '使用模拟数据',
        timestamp: new Date().toISOString()
      };
    }
  },

  // --- 用户认证 ---
  login: async (username: string, password: string): Promise<{ 
    success: boolean; 
    user: User;
    token?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await handleApiError(res);
      
      if (data.success && data.user) {
        // 映射用户数据
        const user = mapUserFromApi(data.user);
        
        // 存储 token 到 localStorage
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          console.log('✅ Token 已存储到 localStorage');
        }
        
        return { success: true, user, token: data.token };
      } else {
        throw new Error(data.error || '登录失败');
      }
    } catch (error) {
      console.error('❌ 登录失败:', error);
      throw error;
    }
  },

  // 添加退出登录函数
  logout: async (): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      // 清除本地存储的 token
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      
      return { 
        success: true, 
        message: '已退出登录' 
      };
    } catch (error) {
      console.error('❌ 退出登录失败:', error);
      throw error;
    }
  },

  // --- 用户注册 ---
  registerUser: async (user: Partial<User> & { password?: string }): Promise<{ 
    success: boolean; 
    user: User;
    message?: string;
  }> => {
    try {
      // 准备请求数据 - 包含更多字段
      const requestBody = {
        username: user.username || '',
        password: user.password || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role || 'USER',
        permissions: user.permissions || [],
        isApproved: user.isApproved || false,
        // 添加数据库权限字段
        databaseAccess: user.databaseAccess || [],
        isActive: user.isActive !== false, // 默认激活
        avatarUrl: user.avatarUrl || ''
      };
      
      console.log('📝 注册用户请求:', requestBody.username);
      console.log('📝 数据库权限:', requestBody.databaseAccess);
      
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(requestBody)
      });
      
      const data = await handleApiError(res);
      
      if (data.success && data.user) {
        const newUser = mapUserFromApi(data.user);
        return { success: true, user: newUser };
      } else {
        throw new Error(data.error || '注册失败');
      }
    } catch (error) {
      console.error('❌ 注册用户失败:', error);
      throw error;
    }
  },

  // --- 用户管理 ---
  getUsers: async (): Promise<{
    success: boolean;
    users: User[];
    message?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      if (data.success && data.users) {
        const users = data.users.map(mapUserFromApi);
        return { success: true, users };
      } else {
        throw new Error(data.error || '获取用户列表失败');
      }
    } catch (error) {
      console.error('❌ 获取用户列表失败:', error);
      throw error;
    }
  },

  updateUser: async (userId: string, updates: any): Promise<{
    success: boolean;
    user?: User;
    message?: string;
  }> => {
    try {
      console.log('📝 更新用户请求:', userId, updates);
      
      // 直接使用前端字段名，后端会自动处理转换
      // 不需要将字段名从驼峰式转换为蛇形式
      const requestBody = { ...updates };
      
      console.log('📤 发送的请求体:', requestBody);
      
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      const data = await handleApiError(res);
      
      if (data.success && data.user) {
        const updatedUser = mapUserFromApi(data.user);
        return { success: true, user: updatedUser };
      } else {
        throw new Error(data.error || '更新用户失败');
      }
    } catch (error) {
      console.error('❌ 更新用户失败:', error);
      throw error;
    }
  },

  updateUserPermissions: async (id: string, permissions: Permission[]): Promise<{ 
    success: boolean; 
    user: User;
  }> => {
    try {
      console.log('🔧 更新用户权限:', { id, permissions });
      
      // 确保权限是字符串数组
      const permissionsArray = Array.isArray(permissions) 
        ? permissions.map(p => String(p)) 
        : [];
      
      const res = await fetch(`${API_BASE}/users/${id}/permissions`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ permissions: permissionsArray })
      });
      
      const data = await handleApiError(res);
      
      const user = mapUserFromApi(data.user);
      return { success: true, user };
    } catch (error) {
      console.error('❌ 更新用户权限失败:', error);
      throw error;
    }
  },

  // --- 用户修改密码 ---
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🔐 用户修改密码请求...');
      
      const res = await fetch(`${API_BASE}/users/me/password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 修改密码失败:', error);
      throw error;
    }
  },

  // --- 管理员重置用户密码 ---
  resetUserPassword: async (userId: string, newPassword: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🔐 管理员重置用户密码:', userId);
      
      const res = await fetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          newPassword,
          confirmByAdmin: true 
        })
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 重置用户密码失败:', error);
      throw error;
    }
  },

  // 修复2: 批准用户 - 改为使用更新用户接口
  approveUser: async (id: string): Promise<{ 
    success: boolean; 
    user: User;
  }> => {
    try {
      console.log('✅ 批准用户:', id);
      
      // 使用更新用户接口来批准用户
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isApproved: true })
      });
      
      const data = await handleApiError(res);
      
      const user = mapUserFromApi(data.user);
      return { success: true, user };
    } catch (error) {
      console.error('❌ 批准用户失败:', error);
      throw error;
    }
  },

  deleteUser: async (id: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🗑️ 删除用户:', id);
      
      const res = await fetch(`${API_BASE}/users/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 删除用户失败:', error);
      throw error;
    }
  },

  // --- 数据库管理 ---
  getDatabases: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ 
    success: boolean; 
    databases: Database[] 
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const url = `${API_BASE}/databases${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log('📋 获取数据库列表...');
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      // 映射数据库数据
      const databases = (data.databases || []).map(mapDatabaseFromApi);
      
      console.log(`✅ 获取数据库成功: ${databases.length} 个`);
      return { 
        success: true, 
        databases,
        pagination: data.pagination || {
          page: params?.page || 1,
          limit: params?.limit || 50,
          total: databases.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      console.error('❌ 获取数据库列表失败:', error);
      throw error;
    }
  },

  createDatabase: async (name: string): Promise<{ 
    success: boolean; 
    database: Database;
  }> => {
    try {
      console.log('📝 创建数据库:', name);
      
      if (!name || name.trim() === '') {
        throw new Error('数据库名称不能为空');
      }
      
      // 修改：发送description字段，如果为空则让后端处理
      const requestBody = {
        name: name.trim(),
        description: name.trim()  // 前端也发送description，使用name
      };
      
      console.log('📤 发送的数据库创建数据:', requestBody);
      
      const res = await fetch(`${API_BASE}/databases`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });
      
      const data = await handleApiError(res);
      
      const database = mapDatabaseFromApi(data.database);
      return { success: true, database };
    } catch (error) {
      console.error('❌ 创建数据库失败:', error);
      throw error;
    }
  },

  renameDatabase: async (id: string, name: string): Promise<{ 
    success: boolean; 
    database: Database;
  }> => {
    try {
      console.log('✏️ 重命名数据库:', { id, name });
      
      if (!name || name.trim() === '') {
        throw new Error('数据库名称不能为空');
      }
      
      const res = await fetch(`${API_BASE}/databases/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: name.trim() })
      });
      
      const data = await handleApiError(res);
      
      const database = mapDatabaseFromApi(data.database);
      return { success: true, database };
    } catch (error) {
      console.error('❌ 重命名数据库失败:', error);
      throw error;
    }
  },

  deleteDatabase: async (id: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🗑️ 删除数据库:', id);
      
      const res = await fetch(`${API_BASE}/databases/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 删除数据库失败:', error);
      throw error;
    }
  },

  // --- 预订管理 ---
  getBookings: async (params?: {
    database_id?: string;
    state?: string;
    week?: string;
    carrier?: string;
    page?: number;
    limit?: number;
  }): Promise<{ 
    success: boolean; 
    bookings: Booking[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  }> => {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.database_id) queryParams.append('database_id', params.database_id);
      if (params?.state) queryParams.append('state', params.state);
      if (params?.week) queryParams.append('week', params.week);
      if (params?.carrier) queryParams.append('carrier', params.carrier);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const url = `${API_BASE}/bookings${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log('📋 获取预订列表:', url);
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      // 映射预订数据
      const bookings = (data.bookings || []).map(mapBookingFromApi);
      
      return {
        success: true,
        bookings,
        pagination: data.pagination || {
          page: params?.page || 1,
          limit: params?.limit || 100,
          total: bookings.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      console.error('❌ 获取预订列表失败:', error);
      throw error;
    }
  },

  getBookingsByDatabase: async (dbId: string, params?: {
    state?: string;
    week?: string;
    page?: number;
    limit?: number;
  }): Promise<{ 
    success: boolean; 
    bookings: Booking[];
    database: {
      id: string;
      name: string;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
      offset: number;
    };
    metadata: {
      count: number;
      timestamp: string;
    }
  }> => {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.state) queryParams.append('state', params.state);
      if (params?.week) queryParams.append('week', params.week);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const url = `${API_BASE}/databases/${dbId}/bookings${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log(`📋 获取数据库 ${dbId} 的预订...`);
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      // 映射预订数据
      const bookings = (data.bookings || []).map(mapBookingFromApi);
      
      return {
        success: true,
        bookings,
        database: data.database || { id: dbId, name: '未知数据库' },
        pagination: data.pagination || {
          page: params?.page || 1,
          limit: params?.limit || 500,
          total: bookings.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
          offset: 0
        },
        metadata: data.metadata || {
          count: bookings.length,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ 获取数据库预订失败:', error);
      throw error;
    }
  },

  getBooking: async (id: string): Promise<{ 
    success: boolean; 
    booking: Booking 
  }> => {
    try {
      console.log(`📋 获取单个预订: ${id}`);
      
      const res = await fetch(`${API_BASE}/bookings/${id}`, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      const booking = mapBookingFromApi(data.booking);
      return { success: true, booking };
    } catch (error) {
      console.error('❌ 获取预订失败:', error);
      throw error;
    }
  },

  saveBooking: async (dbId: string, booking: Booking): Promise<{ 
    success: boolean; 
    booking: Booking;
  }> => {
    try {
      console.log('💾 保存预订 - 开始:', { 
        dbId, 
        bookingId: booking.id, 
        bookingRef: booking.bookingRef,
        hasId: !!booking.id,
        idStartsWithBooking: booking.id?.startsWith?.('booking_') || false
      });
      
      // 判断是创建还是更新
      const isUpdate = booking.id && booking.id.startsWith('booking_');
      
      if (isUpdate) {
        console.log('🔄 检测到更新操作，使用 PUT 方法');
        // 更新现有预订 - 使用 PUT 请求
        const url = `${API_BASE}/bookings/${booking.id}`;
        
        // 构建更新数据 - 确保字段名匹配后端期望
        const updateData = {
          week: booking.week || '',
          bookingRef: booking.bookingRef || '',
          etd: booking.etd || '',
          state: booking.state || 'PENDING',  // 前端用 state，后端会处理
          isLocked: booking.isLocked || false,
          finance: booking.finance || {},
          // 业务字段
          client: booking.client || '',
          carrier: booking.carrier || '',
          service: booking.service || '',
          pol: booking.pol || '',
          pod: booking.pod || '',
          vessel: booking.vessel || '',
          type: booking.type || '',
          qty: Number(booking.qty || 0),
          eta: booking.eta || '',
          etb: booking.etb || '',
          gateIn: booking.gateIn || '',
          job: booking.job || '',
          contact: booking.contact || '', // 添加这一行
          allocation: booking.allocation || '',
          remark: booking.remark || ''
        };
        
        console.log('🔄 发送更新请求:', { url, data: updateData });
        
        const res = await fetch(url, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(updateData)
        });
        
        const data = await handleApiError(res);
        
        // 映射返回的预订数据
        const savedBooking = mapBookingFromApi(data.booking || data);
        
        console.log('✅ 预订更新成功:', savedBooking.id);
        return { success: true, booking: savedBooking };
      } else {
        console.log('🆕 检测到创建操作，使用 POST 方法');
        // 创建新预订 - 使用 POST 请求
        const url = `${API_BASE}/bookings`;
        
        // 注意：创建时不需要传递 id，后端会自动生成
        // 如果前端传递了临时ID，我们应该移除它
        const bookingForCreate = { ...booking };
        if (bookingForCreate.id) {
          console.log('⚠️ 移除创建请求中的ID，让后端生成');
          delete bookingForCreate.id;
        }
        
        // 使用数据映射函数
        const apiData = mapBookingToApi(bookingForCreate, dbId);
        
        console.log('🆕 发送创建请求:', { url, data: apiData });
        
        const res = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(apiData)
        });
        
        const data = await handleApiError(res);
        
        // 映射返回的预订数据
        const savedBooking = mapBookingFromApi(data.booking || data);
        
        console.log('✅ 预订创建成功:', savedBooking.id);
        return { success: true, booking: savedBooking };
      }
      
    } catch (error) {
      console.error('❌ 保存预订失败:', error);
      
      let errorMessage = error.message;
      if (errorMessage.includes('预订ID冲突')) {
        errorMessage = '预订ID冲突。这通常是因为尝试创建已存在的预订，请重试或联系管理员。';
      } else if (errorMessage.includes('预订不存在')) {
        errorMessage = '预订记录不存在。如果是修改操作，可能是该记录已被删除。';
      }
      
      throw new Error(errorMessage);
    }
  },

  deleteBooking: async (id: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🗑️ 删除预订:', id);
      
      const res = await fetch(`${API_BASE}/bookings/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 删除预订失败:', error);
      throw error;
    }
  },

  // --- 报价管理 ---
  getQuotations: async (params?: {
    carrier?: string;
    region?: string;
    pol?: string;
    pod?: string;
    page?: number;
    limit?: number;
  }): Promise<{ 
    success: boolean; 
    quotations: Quotation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }
  }> => {
    try {
      // 构建查询参数
      const queryParams = new URLSearchParams();
      if (params?.carrier) queryParams.append('carrier', params.carrier);
      if (params?.region) queryParams.append('region', params.region);
      if (params?.pol) queryParams.append('pol', params.pol);
      if (params?.pod) queryParams.append('pod', params.pod);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      
      const url = `${API_BASE}/quotations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log('📋 获取报价列表:', url);
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      // 映射报价数据
      const quotations = (data.quotations || []).map(mapQuotationFromApi);
      
      console.log(`✅ 获取报价成功: ${quotations.length} 条`);
      return { 
        success: true, 
        quotations,
        pagination: data.pagination || {
          page: params?.page || 1,
          limit: params?.limit || 100,
          total: quotations.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      console.error('❌ 获取报价失败:', error);
      throw error;
    }
  },

  saveQuotation: async (quotation: Quotation): Promise<{ 
    success: boolean; 
    quotation: Quotation;
  }> => {
    try {
      console.log('💾 保存报价:', { 
        id: quotation.id,
        carrier: quotation.carrier,
        pol: quotation.pol,
        pod: quotation.pod
      });
      
      // 将前端数据转换为后端格式
      const apiData = mapQuotationToApi(quotation);
      
      const res = await fetch(`${API_BASE}/quotations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(apiData)
      });
      
      const data = await handleApiError(res);
      
      // 映射返回的报价数据
      const savedQuotation = mapQuotationFromApi(data.quotation || data);
      
      console.log('✅ 报价保存成功:', savedQuotation.id);
      return { success: true, quotation: savedQuotation };
    } catch (error) {
      console.error('❌ 保存报价失败:', error);
      throw error;
    }
  },

  updateQuotation: async (id: string, updates: Partial<Quotation>): Promise<{ 
    success: boolean; 
    quotation: Quotation 
  }> => {
    try {
      console.log('✏️ 更新报价:', id);
      
      const res = await fetch(`${API_BASE}/quotations/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      
      const data = await handleApiError(res);
      
      const quotation = mapQuotationFromApi(data.quotation);
      return { success: true, quotation };
    } catch (error) {
      console.error('❌ 更新报价失败:', error);
      throw error;
    }
  },

  deleteQuotation: async (id: string): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🗑️ 删除报价:', id);
      
      const res = await fetch(`${API_BASE}/quotations/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 删除报价失败:', error);
      throw error;
    }
  },

  // 修复3: 批量删除报价 - 改为循环删除单个报价
  deleteQuotations: async (ids: string[]): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('🗑️ 批量删除报价:', ids.length);
      
      // 如果没有批量删除接口，改为循环删除单个报价
      const results = [];
      for (const id of ids) {
        try {
          const res = await fetch(`${API_BASE}/quotations/${id}`, { 
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          const data = await res.json();
          if (data.success) {
            results.push({ id, success: true });
          } else {
            results.push({ id, success: false, error: data.error });
          }
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      return { 
        success: successCount > 0, 
        message: `删除完成: ${successCount} 成功, ${failCount} 失败`
      };
    } catch (error) {
      console.error('❌ 批量删除报价失败:', error);
      throw error;
    }
  },

  // --- 系统设置 ---
  getSettings: async (): Promise<{ 
    success: boolean; 
    settings: SystemSettings 
  }> => {
    try {
      console.log('⚙️ 获取系统设置...');
      const res = await fetch(`${API_BASE}/settings`, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      
      // 确保设置数据格式正确
      const settings: SystemSettings = {
        carriers: Array.isArray(data.settings?.carriers) ? data.settings.carriers : [],
        clients: Array.isArray(data.settings?.clients) ? data.settings.clients : [],
        services: Array.isArray(data.settings?.services) ? data.settings.services : [],
        pols: Array.isArray(data.settings?.pols) ? data.settings.pols : [],
        pods: Array.isArray(data.settings?.pods) ? data.settings.pods : [],
        containerTypes: Array.isArray(data.settings?.containerTypes) ? data.settings.containerTypes : [],
        statuses: Array.isArray(data.settings?.statuses) ? data.settings.statuses : [],
        jobs: Array.isArray(data.settings?.jobs) ? data.settings.jobs : [],
        allocations: Array.isArray(data.settings?.allocations) ? data.settings.allocations : [],
        remarks: Array.isArray(data.settings?.remarks) ? data.settings.remarks : [],
        gateInRates: Array.isArray(data.settings?.gateInRates) ? data.settings.gateInRates : []
      };
      
      console.log('✅ 获取系统设置成功');
      return { success: true, settings };
    } catch (error) {
      console.error('❌ 获取系统设置失败:', error);
      throw error;
    }
  },

  saveSettings: async (settings: SystemSettings): Promise<{ 
    success: boolean; 
    message: string;
  }> => {
    try {
      console.log('⚙️ 保存系统设置:', {
        carriers: settings.carriers?.length,
        clients: settings.clients?.length,
        containerTypes: settings.containerTypes?.length
      });
      
      // 清理数据，确保所有字段都是数组格式
      const settingsToSend = {
        carriers: Array.isArray(settings.carriers) ? settings.carriers : [],
        clients: Array.isArray(settings.clients) ? settings.clients : [],
        services: Array.isArray(settings.services) ? settings.services : [],
        pols: Array.isArray(settings.pols) ? settings.pols : [],
        pods: Array.isArray(settings.pods) ? settings.pods : [],
        containerTypes: Array.isArray(settings.containerTypes) ? settings.containerTypes : [],
        statuses: Array.isArray(settings.statuses) ? settings.statuses : [],
        jobs: Array.isArray(settings.jobs) ? settings.jobs : [],
        allocations: Array.isArray(settings.allocations) ? settings.allocations : [],
        remarks: Array.isArray(settings.remarks) ? settings.remarks : [],
        gateInRates: Array.isArray(settings.gateInRates) ? settings.gateInRates : []
      };
      
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settingsToSend)
      });
      
      const data = await handleApiError(res);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 保存系统设置失败:', error);
      throw error;
    }
  },

  // --- Dashboard 统计 ---
  getDashboardStats: async (databaseId?: string): Promise<{ 
    success: boolean; 
    stats: any;
    databaseStats: any[];
    weeklyStats: any[];
    statusStats: any[];
    currentDatabase: string | null;
    timestamp: string;
  }> => {
    try {
      console.log('📊 获取Dashboard统计...', databaseId ? `数据库: ${databaseId}` : '全部数据库');
      
      // 构建查询URL
      let url = `${API_BASE}/dashboard/stats`;
      if (databaseId) {
        url += `?databaseId=${encodeURIComponent(databaseId)}`;
      }
      
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      const data = await handleApiError(res);
      return data;
    } catch (error) {
      console.error('❌ 获取Dashboard统计失败:', error);
      throw error;
    }
  },

  // --- 测试连接 ---
  testConnection: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ 后端连接正常:', data.status);
        return data.status === 'OK';
      }
      return false;
    } catch (error) {
      console.error('❌ 后端连接测试失败:', error);
      return false;
    }
  },

  // 修复4: 调试预订 - 改为使用预订详情接口
  debugBooking: async (id: string): Promise<any> => {
    try {
      // 使用现有的预订详情接口
      const res = await fetch(`${API_BASE}/bookings/${id}`, {
        headers: getAuthHeaders()
      });
      return await handleApiError(res);
    } catch (error) {
      console.error('❌ 调试预订失败:', error);
      throw error;
    }
  },

  // 修复5: 调试报价 - 添加后备实现
  debugQuotation: async (id: string): Promise<any> => {
    try {
      console.log('⚠️ debugQuotation 接口未实现，返回空数据');
      return { 
        success: true, 
        id, 
        note: '调试接口未实现，如需使用请在后端添加 /api/debug/quotation/:id 端点',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 调试报价失败:', error);
      throw error;
    }
  },

  // 修复6: 获取API端点 - 返回静态端点列表
  getEndpoints: async (): Promise<any> => {
    try {
      // 如果没有专门的端点接口，返回已知的端点列表
      const endpoints = [
        '/api/health',
        '/api/init',
        '/api/login',
        '/api/register',
        '/api/users',
        '/api/users/:id',
        '/api/users/:id/permissions',
        '/api/databases',
        '/api/databases/:id',
        '/api/databases/:dbId/bookings',
        '/api/bookings',
        '/api/bookings/:id',
        '/api/quotations',
        '/api/quotations/:id',
        '/api/settings',
        '/api/dashboard/stats'
      ];
      
      return {
        success: true,
        endpoints,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('❌ 获取API端点失败:', error);
      throw error;
    }
  },

  // 添加检查令牌是否有效的函数
  checkAuth: async (): Promise<{
    success: boolean;
    valid: boolean;
    user?: User;
    message?: string;
  }> => {
    try {
      // 获取当前存储的令牌
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return { success: false, valid: false, message: '未找到认证令牌' };
      }
      
      // 你可以添加一个API端点来验证令牌，或者解析JWT令牌
      // 这里简单检查令牌是否存在
      return { success: true, valid: true };
    } catch (error) {
      console.error('❌ 检查认证失败:', error);
      return { success: false, valid: false, message: error.message };
    }
  },

  // 添加清除认证数据的函数
  clearAuth: (): void => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  },

  // ==================== 新增：变更记录相关API ====================
  
  // 获取当日变更记录
  getBookingChangeRecords: async (date: string): Promise<{
    success: boolean;
    records: any[];
    message?: string;
  }> => {
    try {
      console.log('📋 获取变更记录:', date);
      
      const res = await fetch(`${API_BASE}/booking-change-records?date=${date}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        records: data.records || [],
        message: data.message
      };
    } catch (error) {
      console.error('❌ 获取变更记录失败:', error);
      throw error;
    }
  },

  // 获取特定Booking当日变更记录
  getBookingChangeRecordForToday: async (bookingRef: string, date?: string): Promise<{
    success: boolean;
    record?: any;
    message?: string;
  }> => {
    try {
      console.log('🔍 获取当日变更记录:', { bookingRef, date });
      
      // 关键修复：确保日期不为 undefined
      let queryDate = date;
      
      // 如果日期无效，使用当前日期
      if (!queryDate || queryDate === 'undefined' || queryDate === 'null') {
        console.log('⚠️ 日期无效或未提供，使用当前日期');
        
        // 使用上海时区日期
        const now = new Date();
        const shanghaiOffset = 8 * 60 * 60 * 1000;
        const shanghaiTime = new Date(now.getTime() + shanghaiOffset);
        
        const year = shanghaiTime.getUTCFullYear();
        const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
        queryDate = `${year}-${month}-${day}`;
        
        console.log('📅 使用上海时区当前日期:', queryDate);
      }
      
      console.log('📅 最终查询日期:', queryDate);
      
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
        console.error('❌ 日期格式无效:', queryDate);
        throw new Error(`日期格式无效: ${queryDate}，应使用 YYYY-MM-DD 格式`);
      }
      
      // 使用现有接口获取当日所有记录，然后过滤
      const url = `${API_BASE}/booking-change-records?date=${encodeURIComponent(queryDate)}`;
      console.log('🔗 请求URL:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      if (data.success && data.records) {
        // 查找匹配的booking记录
        const matchingRecord = data.records.find(
          (record: any) => record.booking_ref === bookingRef
        );
        
        console.log('🔍 查询结果:', {
          查询日期: queryDate,
          总记录数: data.records.length,
          找到匹配记录: !!matchingRecord,
          匹配记录ID: matchingRecord?.id
        });
        
        return {
          success: true,
          record: matchingRecord,
          message: matchingRecord ? '找到记录' : '未找到记录'
        };
      }
      
      return {
        success: true,
        message: '未找到记录'
      };
    } catch (error) {
      console.error('❌ 获取当日变更记录失败:', error);
      
      // 返回错误，但不抛出异常
      return {
        success: false,
        message: '获取当日变更记录失败: ' + (error as Error).message
      };
    }
  },

  // 更新变更记录
  updateBookingChangeRecord: async (recordId: string, updates: any): Promise<{
    success: boolean;
    record?: any;
    message?: string;
  }> => {
    try {
      console.log('✏️ 更新变更记录:', recordId, updates);
      
      // 确保包含 change_timestamp（用于更新时间）
      const shanghaiDateTime = () => {
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
      
      const updatesWithTimestamp = {
        ...updates,
        change_timestamp: shanghaiDateTime()
      };
      
      console.log('📤 发送更新请求:', updatesWithTimestamp);
      
      const res = await fetch(`${API_BASE}/booking-change-records/${recordId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatesWithTimestamp)
      });
      
      const data = await handleApiError(res);
      
      console.log('✅ 更新成功:', {
        id: data.record?.id,
        change_date: data.record?.change_date,
        change_timestamp: data.record?.change_timestamp
      });
      
      return {
        success: true,
        record: data.record,
        message: data.message || '记录更新成功'
      };
    } catch (error) {
      console.error('❌ 更新变更记录失败:', error);
      
      // 返回错误，但不抛出异常
      return {
        success: false,
        message: '更新变更记录失败: ' + (error as Error).message
      };
    }
  },

  // 在 apiService.ts 的 saveBookingChangeRecord 函数中，修改创建新记录的部分
  saveBookingChangeRecord: async (record: any): Promise<{
    success: boolean;
    record?: any;
    message?: string;
  }> => {
    try {
      console.log('💾 保存变更记录:', record);
      
      // 移除 change_date 和 change_timestamp 字段，我们将重新计算
      const { change_date, change_timestamp, ...recordWithoutTime } = record;
      
      console.log('📅 移除时间字段:', { 
        hadChangeDate: !!change_date, 
        hadChangeTimestamp: !!change_timestamp 
      });
      
      // 先检查当日是否已有相同booking_ref的记录
      const bookingRef = recordWithoutTime.booking_ref;
      
      if (!bookingRef) {
        console.error('❌ booking_ref 不能为空');
        throw new Error('booking_ref 不能为空');
      }
      
      console.log('🔍 查询当日记录，Booking Ref:', bookingRef);
      
      // 获取当前日期（上海时区）
      const getShanghaiDateForRecord = (): string => {
        const now = new Date();
        // 上海时区：UTC+8
        const shanghaiOffset = 8 * 60 * 60 * 1000; // 8小时毫秒数
        const shanghaiTime = new Date(now.getTime() + shanghaiOffset);
        
        const year = shanghaiTime.getUTCFullYear();
        const month = String(shanghaiTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(shanghaiTime.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
      };
      
      const getShanghaiDateTimeForRecord = (): string => {
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
      
      const today = getShanghaiDateForRecord();
      console.log('📅 查询当日记录的日期:', today);
      
      // 使用新增的方法检查当日记录
      const checkRes = await apiService.getBookingChangeRecordForToday(bookingRef, today);
      
      console.log('📋 查询结果:', {
        success: checkRes.success,
        foundRecord: !!checkRes.record,
        recordId: checkRes.record?.id
      });
      
      if (checkRes.success && checkRes.record) {
        // 更新现有记录
        console.log('🔄 更新现有变更记录:', checkRes.record.id);
        
        // 合并变更：对于已存在的字段，保留原来的值；对于新变更的字段，更新为新值
        const existingRecord = checkRes.record;
        const updatedRecord = {
          // 保留现有记录的所有字段
          ...existingRecord,
          // 更新变更类型
          change_type: recordWithoutTime.change_type,
          // 状态变更
          previous_status: recordWithoutTime.previous_status || existingRecord.previous_status,
          new_status: recordWithoutTime.new_status || existingRecord.new_status,
          // POL变更
          previous_pol: recordWithoutTime.previous_pol || existingRecord.previous_pol,
          new_pol: recordWithoutTime.new_pol || existingRecord.new_pol,
          // POD变更
          previous_pod: recordWithoutTime.previous_pod || existingRecord.previous_pod,
          new_pod: recordWithoutTime.new_pod || existingRecord.new_pod,
          // CLIENT变更
          previous_client: recordWithoutTime.previous_client || existingRecord.previous_client,
          new_client: recordWithoutTime.new_client || existingRecord.new_client,
          // QTY变更
          previous_qty: recordWithoutTime.previous_qty !== undefined ? recordWithoutTime.previous_qty : existingRecord.previous_qty,
          new_qty: recordWithoutTime.new_qty !== undefined ? recordWithoutTime.new_qty : existingRecord.new_qty,
          // TYPE变更
          previous_type: recordWithoutTime.previous_type || existingRecord.previous_type,
          new_type: recordWithoutTime.new_type || existingRecord.new_type,
          // ALLOCATION变更
          previous_allocation: recordWithoutTime.previous_allocation || existingRecord.previous_allocation,
          new_allocation: recordWithoutTime.new_allocation || existingRecord.new_allocation,
          // 更新编辑者
          bookinger: recordWithoutTime.bookinger || existingRecord.bookinger,
          // 更新其他可能变更的字段
          ...(recordWithoutTime.qty !== undefined && { qty: recordWithoutTime.qty }),
          ...(recordWithoutTime.type && { type: recordWithoutTime.type }),
          ...(recordWithoutTime.allocation && { allocation: recordWithoutTime.allocation }),
          ...(recordWithoutTime.carrier && { carrier: recordWithoutTime.carrier }),
          ...(recordWithoutTime.etd && { etd: recordWithoutTime.etd }),
          ...(recordWithoutTime.week && { week: recordWithoutTime.week }),
          ...(recordWithoutTime.service && { service: recordWithoutTime.service }),
          ...(recordWithoutTime.vessel && { vessel: recordWithoutTime.vessel }),
          // 更新时间戳
          change_timestamp: getShanghaiDateTimeForRecord(),
        };
        
        console.log('🔄 准备更新的记录:', updatedRecord);
        
        // 调用更新接口
        const updateRes = await apiService.updateBookingChangeRecord(existingRecord.id, updatedRecord);
        return updateRes;
      } else {
        // 创建新记录
        console.log('🆕 创建新变更记录');
        
        // 生成上海时区的时间
        const changeDate = getShanghaiDateForRecord();
        const changeTimestamp = getShanghaiDateTimeForRecord();
        
        // 创建包含时间字段的记录
        const recordToCreate = {
          ...recordWithoutTime,
          change_date: changeDate,
          change_timestamp: changeTimestamp
        };
        
        console.log('📤 创建新记录（包含时间戳）:', recordToCreate);
        
        const res = await fetch(`${API_BASE}/booking-change-records`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(recordToCreate)
        });
        
        const data = await handleApiError(res);
        
        console.log('✅ 新记录创建成功:', {
          id: data.record?.id,
          change_date: data.record?.change_date,
          change_timestamp: data.record?.change_timestamp
        });
        
        return {
          success: true,
          record: data.record,
          message: data.message || '变更记录已保存'
        };
      }
    } catch (error) {
      console.error('❌ 保存变更记录失败:', error);
      
      // 返回错误信息，但不抛出异常
      return {
        success: false,
        message: '保存变更记录失败: ' + (error as Error).message
      };
    }
  },

  // 获取变更统计
  getBookingChangeStats: async (date: string): Promise<{
    success: boolean;
    stats: {
      total: number;
      rollback: number;
      confirmed: number;
      polChanges: number;
      podChanges: number;
      clientChanges: number;
      multipleChanges: number;
    };
    message?: string;
  }> => {
    try {
      console.log('📊 获取变更统计:', date);
      
      const res = await fetch(`${API_BASE}/booking-change-records/stats?date=${date}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        stats: data.stats || {
          total: 0,
          rollback: 0,
          confirmed: 0,
          polChanges: 0,
          podChanges: 0,
          clientChanges: 0,
          multipleChanges: 0
        },
        message: data.message
      };
    } catch (error) {
      console.error('❌ 获取变更统计失败:', error);
      throw error;
    }
  },

  // 批量保存变更记录
  saveBookingChangeRecords: async (records: any[]): Promise<{
    success: boolean;
    savedCount: number;
    message?: string;
  }> => {
    try {
      console.log('💾 批量保存变更记录:', records.length);
      
      const res = await fetch(`${API_BASE}/booking-change-records/batch`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ records })
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        savedCount: data.savedCount || 0,
        message: data.message
      };
    } catch (error) {
      console.error('❌ 批量保存变更记录失败:', error);
      throw error;
    }
  },

  // 根据预订ID获取变更历史
  getBookingChangeHistory: async (bookingRef: string): Promise<{
    success: boolean;
    records: any[];
    message?: string;
  }> => {
    try {
      console.log('📜 获取预订变更历史:', bookingRef);
      
      const res = await fetch(`${API_BASE}/booking-change-records/booking/${bookingRef}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        records: data.records || [],
        message: data.message
      };
    } catch (error) {
      console.error('❌ 获取预订变更历史失败:', error);
      throw error;
    }
  },

  // 按日期范围获取变更记录
  getBookingChangeRecordsByDateRange: async (startDate: string, endDate: string): Promise<{
    success: boolean;
    records: any[];
    message?: string;
  }> => {
    try {
      console.log('📅 按日期范围获取变更记录:', startDate, '至', endDate);
      
      const res = await fetch(`${API_BASE}/booking-change-records/range?start=${startDate}&end=${endDate}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        records: data.records || [],
        message: data.message
      };
    } catch (error) {
      console.error('❌ 按日期范围获取变更记录失败:', error);
      throw error;
    }
  },

  // 按数据库获取变更记录
  getBookingChangeRecordsByDatabase: async (databaseId: string, date?: string): Promise<{
    success: boolean;
    records: any[];
    message?: string;
  }> => {
    try {
      console.log('🏢 按数据库获取变更记录:', databaseId, '日期:', date);
      
      let url = `${API_BASE}/booking-change-records/database/${databaseId}`;
      if (date) {
        url += `?date=${date}`;
      }
      
      const res = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        records: data.records || [],
        message: data.message
      };
    } catch (error) {
      console.error('❌ 按数据库获取变更记录失败:', error);
      throw error;
    }
  },

  // 获取特定客户的变更记录
  getBookingChangeRecordsByClient: async (clientName: string): Promise<any> => {
    try {
      const response = await fetch(`/api/bookings/changes/client/${encodeURIComponent(clientName)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('获取客户变更记录失败:', error);
      return { success: false, error: error.message, records: [] };
    }
  },

  // 在apiService中添加
  getClientChangeRecords: async (clientName: string, startDate?: string, endDate?: string) => {
    try {
      const response = await fetch(`/api/bookings/changes/client/${encodeURIComponent(clientName)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || '2024-01-01',
          endDate: endDate || new Date().toISOString().split('T')[0]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch client change records: ${response.statusText}`);
      }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching client change records:', error);
    return { success: false, error: error.message, records: [] };
  }
},

  // ==================== 新增：邮件功能API ====================
  
  // --- 邮件功能 ---
  searchEmailByBookingRef: async (bookingRef: string): Promise<{
    success: boolean;
    found: boolean;
    emails: any[];
    error?: string;
    message?: string;
    timestamp?: string;
  }> => {
    try {
      console.log('📧 搜索邮件:', bookingRef);
      
      const res = await fetch(`${API_BASE}/mail/search/${encodeURIComponent(bookingRef)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        found: data.found || false,
        emails: data.emails || [],
        error: data.error,
        message: data.message,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('❌ 搜索邮件失败:', error);
      return {
        success: false,
        found: false,
        emails: [],
        error: (error as Error).message
      };
    }
  },

  downloadEmailAttachments: async (bookingRef: string, emailUid: string): Promise<{
    success: boolean;
    bookingRef: string;
    message?: string;
    attachments?: any[];
    downloadUrl?: string;
    error?: string; // 添加 error 属性到返回类型
  }> => {
    try {
      console.log('📎 下载邮件附件:', { bookingRef, emailUid });
      
      const res = await fetch(`${API_BASE}/mail/download/${encodeURIComponent(bookingRef)}/${encodeURIComponent(emailUid)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      // 检查是否为文件下载
      const contentType = res.headers.get('content-type');
      
      if (contentType?.includes('application/zip') || contentType?.includes('application/octet-stream')) {
        // 这是文件下载，创建下载链接
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        
        // 获取文件名
        const contentDisposition = res.headers.get('content-disposition');
        let fileName = 'attachments.zip';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+?)"?$/);
          if (match) {
            fileName = match[1];
          }
        }
        
        // 创建下载链接并自动点击
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        
        return {
          success: true,
          bookingRef,
          message: '附件下载开始'
        };
      } else {
        // 这是JSON响应，包含附件列表
        const data = await res.json();
        return {
          success: true,
          bookingRef,
          message: data.message,
          attachments: data.attachments || [],
          downloadUrl: data.attachments?.length === 1 ? 
            `${API_BASE}/mail/attachment/${encodeURIComponent(bookingRef)}/${encodeURIComponent(emailUid)}/${encodeURIComponent(data.attachments[0].fileName)}` : null
        };
      }
    } catch (error) {
      console.error('❌ 下载邮件附件失败:', error);
      return {
        success: false,
        bookingRef,
        error: (error as Error).message
      };
    }
  },

  downloadSingleAttachment: async (bookingRef: string, emailUid: string, fileName: string): Promise<{
    success: boolean;
    message?: string;
  }> => {
    try {
      console.log('📄 下载单个附件:', { bookingRef, emailUid, fileName });
      
      const res = await fetch(`${API_BASE}/mail/attachment/${encodeURIComponent(bookingRef)}/${encodeURIComponent(emailUid)}/${encodeURIComponent(fileName)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      // 获取文件内容
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      
      // 获取文件名
      const contentDisposition = res.headers.get('content-disposition');
      let downloadFileName = fileName;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) {
          downloadFileName = decodeURIComponent(match[1]);
        }
      }
      
      // 创建下载链接并自动点击
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 清理URL
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      return {
        success: true,
        message: '附件下载开始'
      };
    } catch (error) {
      console.error('❌ 下载单个附件失败:', error);
      return {
        success: false,
        message: (error as Error).message
      };
    }
  },

  getRecentEmails: async (limit: number = 10): Promise<{
    success: boolean;
    emails: any[];
    count: number;
    timestamp?: string;
    error?: string;
  }> => {
    try {
      console.log('📧 获取最近邮件:', { limit });
      
      const res = await fetch(`${API_BASE}/mail/recent?limit=${limit}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await handleApiError(res);
      
      return {
        success: true,
        emails: data.emails || [],
        count: data.count || 0,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('❌ 获取最近邮件失败:', error);
      return {
        success: false,
        emails: [],
        count: 0,
        error: (error as Error).message
      };
    }
  },

  testMailConnection: async (): Promise<{
    success: boolean;
    message: string;
    config?: {
      user: string;
      host: string;
    };
    timestamp?: string;
    error?: string;
  }> => {
    try {
      console.log('🔌 测试邮箱连接...');
      
      const res = await fetch(`${API_BASE}/mail/test`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      const data = await res.json();
      
      return {
        success: data.success || false,
        message: data.message || '',
        config: data.config,
        timestamp: data.timestamp,
        error: data.error
      };
    } catch (error) {
      console.error('❌ 测试邮箱连接失败:', error);
      return {
        success: false,
        message: '测试邮箱连接失败',
        error: (error as Error).message
      };
    }
  },

  // 邮件相关类型定义（如果需要，可以在types.ts中添加）
  // 这里我们定义一个简单的邮件类型
  mailSearch: async (bookingRef: string): Promise<any> => {
    return apiService.searchEmailByBookingRef(bookingRef);
  },

  mailDownloadAttachments: async (bookingRef: string, emailUid: string): Promise<any> => {
    return apiService.downloadEmailAttachments(bookingRef, emailUid);
  },

  mailGetRecent: async (limit?: number): Promise<any> => {
    return apiService.getRecentEmails(limit);
  },

  mailTestConnection: async (): Promise<any> => {
    return apiService.testMailConnection();
  }
};

export {
  mapBookingFromApi,
  mapBookingToApi,
  mapQuotationFromApi,
  mapQuotationToApi,
  mapUserFromApi,
  mapDatabaseFromApi
};

// 为调试目的暴露全局变量
if (typeof window !== 'undefined') {
  (window as any).apiService = apiService;
  (window as any).mapBookingFromApi = mapBookingFromApi;
  (window as any).mapBookingToApi = mapBookingToApi;
  (window as any).API_BASE = API_BASE;
}