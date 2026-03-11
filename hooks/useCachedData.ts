import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/apiClient';

// 缓存数据Hook
export const useCachedData = <T,>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
    staleTime?: number;
  } = {}
) => {
  const { ttl = 300000, enabled = true, staleTime = 0 } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const isStale = useCallback(() => {
    return Date.now() - lastUpdated > staleTime;
  }, [lastUpdated, staleTime]);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // 尝试从缓存获取
      const cached = localStorage.getItem(`cache_${key}`);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached) as { data: T; timestamp: number };
        if (Date.now() - timestamp < ttl) {
          setData(cachedData);
          setLastUpdated(timestamp);
          
          // 如果数据不陈旧，直接返回
          if (!isStale()) {
            setLoading(false);
            return;
          }
        }
      }

      // 获取新数据
      const newData = await fetcher();
      setData(newData);
      setLastUpdated(Date.now());

      // 缓存数据
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data: newData,
        timestamp: Date.now()
      }));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl, enabled, isStale]);

  const invalidate = useCallback(() => {
    localStorage.removeItem(`cache_${key}`);
    setData(null);
    setLastUpdated(0);
    fetchData();
  }, [key, fetchData]);

  const update = useCallback((newData: T) => {
    setData(newData);
    setLastUpdated(Date.now());
    localStorage.setItem(`cache_${key}`, JSON.stringify({
      data: newData,
      timestamp: Date.now()
    }));
  }, [key]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidate,
    update,
    lastUpdated
  };
};

// 预订数据Hook
export const useBookings = (databaseId?: string) => {
  return useCachedData(
    `bookings_${databaseId || 'all'}`,
    () => apiClient.get(`/bookings${databaseId ? `?databaseId=${databaseId}` : ''}`),
    { ttl: 60000, staleTime: 10000 }
  );
};

// 用户数据Hook
export const useUsers = () => {
  return useCachedData(
    'users',
    () => apiClient.get('/users'),
    { ttl: 300000, staleTime: 60000 }
  );
};

// 数据库数据Hook
export const useDatabases = () => {
  return useCachedData(
    'databases',
    () => apiClient.get('/databases'),
    { ttl: 300000, staleTime: 300000 }
  );
};

// 设置数据Hook
export const useSettings = () => {
  return useCachedData(
    'settings',
    () => apiClient.get('/settings'),
    { ttl: 300000, staleTime: 300000 }
  );
};

// 实时数据Hook
export const useRealtimeData = <T,>(
  key: string,
  initialData: T,
  options: {
    pollingInterval?: number;
    enabled?: boolean;
  } = {}
) => {
  const { pollingInterval = 30000, enabled = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const response = await apiClient.get(key);
      setData(response.data as T);
    } catch (error) {
      console.error('实时数据获取失败:', error);
    } finally {
      setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    fetchData();
    
    if (enabled && pollingInterval > 0) {
      const interval = setInterval(fetchData, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, pollingInterval, enabled]);

  return { data, loading, refetch: fetchData };
};

// 分页数据Hook
export const usePaginatedData = <T,>(
  key: string,
  fetcher: (page: number, pageSize: number) => Promise<{ data: T[]; total: number }>,
  options: {
    pageSize?: number;
    ttl?: number;
  } = {}
) => {
  const { pageSize = 20, ttl = 60000 } = options;
  const [page, setPage] = useState(1);
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetcher(page, pageSize);
      setData(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, fetcher]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    loading,
    error,
    page,
    totalPages,
    total,
    setPage,
    refetch: fetchData
  };
};

// 使用示例
export const useOptimizedBookings = (databaseId?: string) => {
  return usePaginatedData(
    'bookings',
    async (page, pageSize) => {
      const response = await apiClient.get(`/bookings?page=${page}&pageSize=${pageSize}${databaseId ? `&databaseId=${databaseId}` : ''}`);
      return response.data as { data: any[]; total: number };
    },
    { pageSize: 50, ttl: 60000 }
  );
};