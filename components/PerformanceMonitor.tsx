import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor, useMemoryMonitor } from '../hooks/usePerformance';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  errorCount: number;
  apiCalls: number;
  cacheHits: number;
}

export const PerformanceMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    errorCount: 0,
    apiCalls: 0,
    cacheHits: 0
  });

  const memoryInfo = useMemoryMonitor();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // 监听性能指标
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            setMetrics(prev => ({
              ...prev,
              loadTime: entry.duration
            }));
          }
        }
      });

      observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });

      // 监听内存使用
      const updateMemory = () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          setMetrics(prev => ({
            ...prev,
            memoryUsage: memory.usedJSHeapSize / 1024 / 1024 // MB
          }));
        }
      };

      const interval = setInterval(updateMemory, 1000);

      return () => {
        observer.disconnect();
        clearInterval(interval);
      };
    }
  }, []);

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatTime = (ms: number) => {
    return ms.toFixed(2) + ' ms';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 z-50"
        title="显示性能监控"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">性能监控</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">加载时间:</span>
          <span className="font-mono">{formatTime(metrics.loadTime)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">内存使用:</span>
          <span className="font-mono">{formatBytes(metrics.memoryUsage * 1024 * 1024)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">API调用:</span>
          <span className="font-mono">{metrics.apiCalls}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">缓存命中:</span>
          <span className="font-mono">{metrics.cacheHits}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">错误数:</span>
          <span className="font-mono text-red-600">{metrics.errorCount}</span>
        </div>

        {memoryInfo.used > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-1">内存详情:</div>
            <div className="flex justify-between text-xs">
              <span>已用: {formatBytes(memoryInfo.used)}</span>
              <span>总计: {formatBytes(memoryInfo.total)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
              <div 
                className="bg-blue-600 h-1 rounded-full" 
                style={{ width: `${(memoryInfo.used / memoryInfo.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={() => {
            // 清除缓存
            localStorage.clear();
            location.reload();
          }}
          className="w-full text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
        >
          清除缓存并重载
        </button>
      </div>
    </div>
  );
};

// 性能警告组件
export const PerformanceWarning: React.FC = () => {
  const [warnings, setWarnings] = useState<string[]>([]);
  const memoryInfo = useMemoryMonitor();

  useEffect(() => {
    const newWarnings: string[] = [];

    // 内存警告
    if (memoryInfo.used > 0 && memoryInfo.used / memoryInfo.total > 0.8) {
      newWarnings.push('内存使用过高');
    }

    // 检查长任务
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            newWarnings.push(`长任务警告: ${entry.duration.toFixed(2)}ms`);
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });

      return () => observer.disconnect();
    }

    setWarnings(newWarnings);
  }, [memoryInfo]);

  if (warnings.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-xs z-50">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="text-sm font-medium text-yellow-800">性能警告</span>
      </div>
      <ul className="mt-2 text-xs text-yellow-700 space-y-1">
        {warnings.map((warning, index) => (
          <li key={index}>{warning}</li>
        ))}
      </ul>
    </div>
  );
};

// 加载性能分析器
export const LoadPerformanceAnalyzer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metrics, setMetrics] = useState({
    firstPaint: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.name) {
            case 'first-paint':
              setMetrics(prev => ({ ...prev, firstPaint: entry.startTime }));
              break;
            case 'first-contentful-paint':
              setMetrics(prev => ({ ...prev, firstContentfulPaint: entry.startTime }));
              break;
            case 'largest-contentful-paint':
              setMetrics(prev => ({ ...prev, largestContentfulPaint: entry.startTime }));
              break;
          }
        }
      });

      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });

      return () => observer.disconnect();
    }
  }, []);

  // 记录到控制台
  useEffect(() => {
    console.table(metrics);
  }, [metrics]);

  return <>{children}</>;
};