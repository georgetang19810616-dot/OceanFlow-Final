import React, { useState, useCallback, useMemo } from 'react';
import { useVirtualScroll } from '../hooks/usePerformance';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  className?: string;
}

export const VirtualizedList = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  onEndReached,
  onEndReachedThreshold = 0.8,
  loading = false,
  loadingComponent,
  emptyComponent,
  className = ''
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);

  const { visibleItems, offsetY, startIndex, endIndex } = useVirtualScroll(
    items,
    itemHeight,
    containerHeight
  );

  // 检查是否到达底部
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setScrollTop(scrollTop);

    if (onEndReached) {
      const threshold = scrollHeight * onEndReachedThreshold;
      if (scrollTop + clientHeight >= threshold) {
        onEndReached();
      }
    }
  }, [onEndReached, onEndReachedThreshold]);

  // 渲染内容
  const content = useMemo(() => {
    if (loading && items.length === 0) {
      return loadingComponent || (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!loading && items.length === 0) {
      return emptyComponent || (
        <div className="flex items-center justify-center h-full text-gray-500">
          暂无数据
        </div>
      );
    }

    return (
      <div style={{ height: items.length * itemHeight }} className="relative">
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={keyExtractor(item, startIndex + index)}
              style={{ height: itemHeight }}
              className="absolute w-full"
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    );
  }, [items, visibleItems, offsetY, startIndex, loading, loadingComponent, emptyComponent, renderItem, keyExtractor, itemHeight]);

  return (
    <div
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {content}
    </div>
  );
};

// 分页虚拟列表
interface PaginatedVirtualListProps<T> extends Omit<VirtualizedListProps<T>, 'items'> {
  items: T[];
  pageSize: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
}

export const PaginatedVirtualList = <T,>({
  items,
  pageSize,
  onPageChange,
  currentPage = 1,
  ...props
}: PaginatedVirtualListProps<T>) => {
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, items.length);
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, pageSize]);

  const totalPages = Math.ceil(items.length / pageSize);

  return (
    <div className="flex flex-col h-full">
      <VirtualizedList
        {...props}
        items={paginatedItems}
      />
      
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 py-4">
          <button
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            上一页
          </button>
          
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          
          <button
            onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
};

// 无限滚动虚拟列表
interface InfiniteVirtualListProps<T> extends Omit<VirtualizedListProps<T>, 'items' | 'onEndReached'> {
  items: T[];
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
  loadingMoreComponent?: React.ReactNode;
}

export const InfiniteVirtualList = <T,>({
  items,
  hasMore,
  onLoadMore,
  isLoadingMore = false,
  loadingMoreComponent,
  ...props
}: InfiniteVirtualListProps<T>) => {
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="flex flex-col h-full">
      <VirtualizedList
        {...props}
        items={items}
        onEndReached={handleEndReached}
      />
      
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          {loadingMoreComponent || (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          )}
        </div>
      )}
    </div>
  );
};

// 使用示例
export const BookingVirtualList: React.FC<{
  bookings: any[];
  onBookingClick: (booking: any) => void;
}> = ({ bookings, onBookingClick }) => {
  return (
    <VirtualizedList
      items={bookings}
      itemHeight={80}
      containerHeight={600}
      renderItem={(booking) => (
        <div
          className="p-4 border-b hover:bg-gray-50 cursor-pointer"
          onClick={() => onBookingClick(booking)}
        >
          <div className="font-medium">{booking.bookingRef}</div>
          <div className="text-sm text-gray-600">{booking.client}</div>
          <div className="text-sm text-gray-500">{booking.carrier}</div>
        </div>
      )}
      keyExtractor={(booking) => booking.id}
      className="border rounded"
    />
  );
};