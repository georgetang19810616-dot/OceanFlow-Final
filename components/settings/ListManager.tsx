import React from 'react';
import { Button } from '../Button';
import { Plus, Trash2, Edit3, X, Check } from 'lucide-react';

interface ListManagerProps<T = string> {
  title: string;
  items: T[];
  onUpdate: (items: T[]) => void;
  placeholder?: string;
  itemRenderer?: (item: T, index: number) => React.ReactNode;
  itemKey?: (item: T) => string;
  validateItem?: (item: T) => boolean;
  transformInput?: (input: string) => T;
}

export const ListManager: React.FC<ListManagerProps> = ({
  title,
  items,
  onUpdate,
  placeholder = "输入新项",
  itemRenderer,
  itemKey = (item) => String(item),
  validateItem = (item) => String(item).trim().length > 0,
  transformInput = (input) => input.trim()
}) => {
  const [newItem, setNewItem] = React.useState('');
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editingValue, setEditingValue] = React.useState('');

  const handleAdd = () => {
    const transformed = transformInput(newItem);
    if (validateItem(transformed) && !items.some(item => itemKey(item) === itemKey(transformed))) {
      onUpdate([...items, transformed]);
      setNewItem('');
    }
  };

  const handleDelete = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(String(items[index]));
  };

  const handleSaveEdit = () => {
    const transformed = transformInput(editingValue);
    if (validateItem(transformed)) {
      const newItems = [...items];
      newItems[editingIndex!] = transformed;
      onUpdate(newItems);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700">{title}</h4>
      
      {/* 添加新项 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <Button
          onClick={handleAdd}
          size="sm"
          variant="primary"
          icon={Plus}
        />
      </div>

      {/* 项目列表 */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={`${itemKey(item)}-${index}`}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            {editingIndex === index ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                  variant="ghost"
                  icon={Check}
                  className="text-green-600"
                />
                <Button
                  onClick={handleCancelEdit}
                  size="sm"
                  variant="ghost"
                  icon={X}
                  className="text-gray-600"
                />
              </div>
            ) : (
              <>
                <div className="flex-1 text-sm">
                  {itemRenderer ? itemRenderer(item, index) : String(item)}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => handleEdit(index)}
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    className="text-blue-600"
                  />
                  <Button
                    onClick={() => handleDelete(index)}
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

      {items.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          暂无数据，请添加新项
        </p>
      )}
    </div>
  );
};