import React, { useState } from 'react';
import { Allocation } from '../types';
import { Info } from 'lucide-react';

interface AllocationWithTooltipProps {
  allocation: Allocation;
  showIcon?: boolean;
  className?: string;
}

export const AllocationWithTooltip: React.FC<AllocationWithTooltipProps> = ({
  allocation,
  showIcon = true,
  className = ''
}) => {
  // 使用状态控制工具提示的显示，不依赖 CSS group
  const [showTooltip, setShowTooltip] = useState(false);

  if (!allocation.note) {
    return <span className={className}>{allocation.value}</span>;
  }

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span>{allocation.value}</span>
      {showIcon && (
        <Info className="w-3 h-3 ml-1 text-gray-400 flex-shrink-0" />
      )}
      
      {/* 使用 state 控制显示，而不是 CSS group */}
      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-[9999] min-w-max">
          <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 shadow-lg max-w-xs border border-gray-700">
            {/* 修改这里：只显示注释，不显示值 */}
            <div className="text-gray-300 whitespace-pre-wrap">{allocation.note}</div>
            <div className="absolute -top-1 left-3 w-2 h-2 bg-gray-800 transform rotate-45 border-l border-t border-gray-700"></div>
          </div>
        </div>
      )}
    </div>
  );
};