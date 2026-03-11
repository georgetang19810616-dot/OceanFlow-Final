import { useState, useEffect, useCallback, useRef } from 'react';

// 性能监控Hook
export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    errorCount: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('Performance:', entry);
        }
      });

      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });

      return () => observer.disconnect();
    }
  }, []);

  return metrics;
};

// 防抖Hook
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 节流Hook
export const useThrottle = <T,>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExec = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastExec.current >= delay) {
      setThrottledValue(value);
      lastExec.current = now;
    }
  }, [value, delay]);

  return throttledValue;
};

// 虚拟滚动Hook
export const useVirtualScroll = <T,>(items: T[], itemHeight: number, containerHeight: number) => {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    offsetY,
    startIndex,
    endIndex,
    setScrollTop
  };
};

// 缓存Hook
export const useCache = <T,>(key: string, fetcher: () => Promise<T>, ttl = 300000) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchData = useCallback(async () => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      cacheRef.current.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  const invalidate = useCallback(() => {
    cacheRef.current.delete(key);
    fetchData();
  }, [key, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, invalidate };
};

// 内存监控Hook
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState({
    used: 0,
    total: 0,
    percentage: 0
  });

  useEffect(() => {
    if ('memory' in performance) {
      const updateMemory = () => {
        const memory = (performance as any).memory;
        if (memory) {
          setMemoryInfo({
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
          });
        }
      };

      updateMemory();
      const interval = setInterval(updateMemory, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  return memoryInfo;
};

// 懒加载Hook
export const useLazyLoad = <T,>(loadFn: () => Promise<T>, threshold = 100) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (data || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await loadFn();
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [loadFn, data, loading]);

  useEffect(() => {
    if (!elementRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          load();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [load, threshold]);

  return { data, loading, error, elementRef };
};

// 分页Hook
export const usePagination = <T,>(items: T[], pageSize: number) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizeState] = useState(pageSize);

  const totalPages = Math.ceil(items.length / pageSizeState);
  const startIndex = (currentPage - 1) * pageSizeState;
  const endIndex = Math.min(startIndex + pageSizeState, items.length);
  const paginatedItems = items.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems: items.length,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};

// 错误边界Hook
export const useErrorBoundary = () => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    setHasError(true);
    setError(error);
    console.error('Error caught by boundary:', error);
  }, []);

  return { hasError, error, resetError, handleError };
};