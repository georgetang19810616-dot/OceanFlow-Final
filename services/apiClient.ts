import { Booking, Quotation, User, Database, SystemSettings } from '../types';

// API错误类
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// 请求配置接口
interface RequestConfig extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
  retry?: number;
}

// API响应包装
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// 缓存管理器
class CacheManager {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear() {
    this.cache.clear();
  }

  invalidate(pattern?: string) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.clear();
    }
  }
}

// 统一的API客户端
class ApiClient {
  private baseURL: string;
  private cache: CacheManager;
  private requestInterceptors: Array<(config: RequestConfig) => RequestConfig> = [];
  private responseInterceptors: Array<(response: Response) => Promise<Response>> = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.cache = new CacheManager();
  }

  // 添加请求拦截器
  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig) {
    this.requestInterceptors.push(interceptor);
  }

  // 添加响应拦截器
  addResponseInterceptor(interceptor: (response: Response) => Promise<Response>) {
    this.responseInterceptors.push(interceptor);
  }

  // 构建URL
  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, String(params[key]));
        }
      });
    }
    return url.toString();
  }

  // 处理超时
  private withTimeout(promise: Promise<Response>, timeout: number): Promise<Response> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new ApiError(408, 'Request timeout')), timeout);
      })
    ]);
  }

  // 重试机制
  private async withRetry(
    requestFn: () => Promise<Response>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<Response> {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0 && error instanceof ApiError && error.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(requestFn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // 基础请求方法
  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    let requestConfig = { ...config };
    
    // 应用请求拦截器
    for (const interceptor of this.requestInterceptors) {
      requestConfig = interceptor(requestConfig);
    }

    const url = this.buildURL(endpoint, requestConfig.params);
    
    const fetchConfig: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...requestConfig.headers,
      },
      ...requestConfig,
    };

    try {
      const response = await this.withRetry(
        () => this.withTimeout(fetch(url, fetchConfig), requestConfig.timeout || 10000),
        requestConfig.retry || 3
      );

      // 应用响应拦截器
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      if (!processedResponse.ok) {
        const errorData = await processedResponse.json().catch(() => ({}));
        throw new ApiError(
          processedResponse.status,
          errorData.message || processedResponse.statusText,
          errorData
        );
      }

      const data = await processedResponse.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'Network error', error);
    }
  }

  // 带缓存的请求
  private async cachedRequest<T>(
    key: string,
    endpoint: string,
    config: RequestConfig = {},
    ttl: number = 300000
  ): Promise<ApiResponse<T>> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const response = await this.request<T>(endpoint, config);
    this.cache.set(key, response, ttl);
    return response;
  }

  // GET请求
  async get<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  // POST请求
  async post<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT请求
  async put<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE请求
  async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // 缓存的GET请求
  async cachedGet<T>(key: string, endpoint: string, config: RequestConfig = {}, ttl?: number): Promise<ApiResponse<T>> {
    return this.cachedRequest<T>(key, endpoint, { ...config, method: 'GET' }, ttl);
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
  }

  invalidateCache(pattern?: string) {
    this.cache.invalidate(pattern);
  }
}

// 自动检测环境的API配置
const getApiBase = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';
  }
  
  const { protocol, hostname, port } = window.location;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
};

// 创建API实例
export const apiClient = new ApiClient(getApiBase());

// 添加认证拦截器
apiClient.addRequestInterceptor((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

// 添加错误处理拦截器
apiClient.addResponseInterceptor(async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  }
  return response;
});

// 具体的API方法
export const api = {
  // 健康检查
  health: () => apiClient.get('/health'),

  // 初始化数据
  init: () => apiClient.get('/init'),

  // 预订相关
  bookings: {
    list: (params?: any) => apiClient.cachedGet('bookings', '/bookings', { params }, 60000),
    get: (id: string) => apiClient.get(`/bookings/${id}`),
    create: (data: Partial<Booking>) => apiClient.post('/bookings', data),
    update: (id: string, data: Partial<Booking>) => apiClient.put(`/bookings/${id}`, data),
    delete: (id: string) => apiClient.delete(`/bookings/${id}`),
    search: (query: string) => apiClient.get('/bookings/search', { params: { q: query } }),
  },

  // 报价相关
  quotations: {
    list: (params?: any) => apiClient.cachedGet('quotations', '/quotations', { params }, 60000),
    get: (id: string) => apiClient.get(`/quotations/${id}`),
    create: (data: Partial<Quotation>) => apiClient.post('/quotations', data),
    update: (id: string, data: Partial<Quotation>) => apiClient.put(`/quotations/${id}`, data),
    delete: (id: string) => apiClient.delete(`/quotations/${id}`),
  },

  // 用户相关
  users: {
    list: () => apiClient.cachedGet('users', '/users', {}, 300000),
    get: (id: string) => apiClient.get(`/users/${id}`),
    create: (data: Partial<User>) => apiClient.post('/users', data),
    update: (id: string, data: Partial<User>) => apiClient.put(`/users/${id}`, data),
    delete: (id: string) => apiClient.delete(`/users/${id}`),
  },

  // 数据库相关
  databases: {
    list: () => apiClient.cachedGet('databases', '/databases', {}, 300000),
    create: (name: string) => apiClient.post('/databases', { name }),
    update: (id: string, name: string) => apiClient.put(`/databases/${id}`, { name }),
    delete: (id: string) => apiClient.delete(`/databases/${id}`),
  },

  // 系统设置
  settings: {
    get: () => apiClient.cachedGet('settings', '/settings', {}, 300000),
    update: (settings: Partial<SystemSettings>) => apiClient.put('/settings', settings),
    export: () => apiClient.get('/settings/export'),
    import: (settings: SystemSettings) => apiClient.post('/settings/import', settings),
  },

  // 认证相关
  auth: {
    login: (credentials: { username: string; password: string }) => 
      apiClient.post('/auth/login', credentials),
    logout: () => apiClient.post('/auth/logout'),
    refresh: () => apiClient.post('/auth/refresh'),
  },

  // 文件上传
  upload: {
    file: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.post('/upload', formData, {
        headers: { 'Content-Type': undefined }, // 让浏览器设置
      });
    },
  },

  // 实时数据
  realtime: {
    subscribe: (channel: string) => {
      // WebSocket连接将在需要时实现
      console.log(`Subscribing to ${channel}`);
    },
  },
};

// 导出类型
type ApiClientType = typeof apiClient;
type ApiType = typeof api;

export type { ApiClientType, ApiType };