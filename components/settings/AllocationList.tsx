import React, { useState } from 'react';
import { Button } from '../Button';
import { Plus, Trash2, Edit3, X, Check } from 'lucide-react';
import { Allocation as AllocationType } from '../../types';

interface AllocationListProps {
  allocations: AllocationType[];
  onUpdate: (allocations: AllocationType[]) => void;
  placeholder?: string;
}

export const AllocationList: React.FC<AllocationListProps> = ({
  allocations,
  onUpdate,
  placeholder = "输入分配名称"
}) => {
  const [newAllocation, setNewAllocation] = useState<Partial<AllocationType>>({
    name: '',
    type: 'default'
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<Partial<AllocationType>>({});

  const handleAdd = () => {
    if (newAllocation.name?.trim()) {
      const allocation: AllocationType = {
        id: Date.now().toString(),
        name: newAllocation.name.trim(),
        type: newAllocation.type || 'default'
      };
      onUpdate([...allocations, allocation]);
      setNewAllocation({ name: '', type: 'default' });
    }
  };

  const handleUpdate = (id: string, updates: Partial<AllocationType>) => {
    onUpdate(allocations.map(allocation => 
      allocation.id === id ? { ...allocation, ...updates } : allocation
    ));
  };

  const handleDelete = (id: string) => {
    onUpdate(allocations.filter(allocation => allocation.id !== id));
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">分配列表</h4>
      
      {/* 添加新分配 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newAllocation.name || ''}
          onChange={(e) => setNewAllocation({ ...newAllocation, name: e.target.value })}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <select
          value={newAllocation.type || 'default'}
          onChange={(e) => setNewAllocation({ ...newAllocation, type: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="default">默认</option>
          <option value="special">特殊</option>
          <option value="vip">VIP</option>
        </select>
        <Button
          onClick={handleAdd}
          size="sm"
          variant="primary"
          icon={Plus}
        >
          添加
        </Button>
      </div>

      {/* 分配列表 */}
      <div className="space-y-2">
        {allocations.map((allocation) => (
          <div
            key={allocation.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            {editingId === allocation.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editingAllocation.name || ''}
                  onChange={(e) => setEditingAllocation({ ...editingAllocation, name: e.target.value })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdate(allocation.id, editingAllocation);
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                />
                <select
                  value={editingAllocation.type || allocation.type}
                  onChange={(e) => setEditingAllocation({ ...editingAllocation, type: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  <option value="default">默认</option>
                  <option value="special">特殊</option>
                  <option value="vip">VIP</option>
                </select>
                <Button
                  onClick={() => {
                    handleUpdate(allocation.id, editingAllocation);
                    setEditingId(null);
                  }}
                  size="sm"
                  variant="primary"
                  icon={Check}
                />
                <Button
                  onClick={() => setEditingId(null)}
                  size="sm"
                  variant="secondary"
                  icon={X}
                />
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium">{allocation.name}</span>
                  <span className="ml-2 text-xs text-gray-500">({allocation.type})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => {
                      setEditingId(allocation.id);
                      setEditingAllocation({ name: allocation.name, type: allocation.type });
                    }}
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                  />
                  <Button
                    onClick={() => handleDelete(allocation.id)}
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="text-red-600"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {allocations.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          暂无数据，请添加新项
        </p>
      )}
    </div>
  );
};