import React, { useState } from 'react';
import { FieldDefinition, FieldType } from '../types';
import { Button } from './Button';
import { X, Plus, Trash2, Settings, GripVertical, Key, AlertCircle } from 'lucide-react';

interface ColumnManagerProps {
  isOpen: boolean;
  onClose: () => void;
  fields: FieldDefinition[];
  onUpdateFields: (fields: FieldDefinition[]) => void;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({ isOpen, onClose, fields, onUpdateFields }) => {
  const [newField, setNewField] = useState<{ 
    label: string; 
    type: FieldType; 
    key?: string;
  }>({ label: '', type: 'TEXT' });
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // 系统字段列表 - 不能删除或重命名
  const SYSTEM_FIELDS = ['state', 'week', 'bookingRef', 'carrier', 'client', 'service', 
    'pol', 'pod', 'etd', 'vessel', 'type', 'qty', 'gateIn', 'job', 'allocation', 'remark'];

  // 预定义字段映射 - 确保与后端数据库字段一致
  const PREDEFINED_FIELD_MAP: Record<string, string> = {
    'Status': 'state',
    '状态': 'state',
    'Week': 'week',
    '周': 'week',
    'Booking Ref': 'bookingRef',
    '订舱号': 'bookingRef',
    'Carrier': 'carrier',
    '承运人': 'carrier',
    'Client': 'client',
    '客户': 'client',
    'Service': 'service',
    '服务': 'service',
    'POL': 'pol',
    '起运港': 'pol',
    'POD': 'pod',
    '目的港': 'pod',
    'ETD': 'etd',
    '预计开航日': 'etd',
    'Vessel': 'vessel',
    '船名': 'vessel',
    'Type': 'type',
    '箱型': 'type',
    'Qty': 'qty',
    '数量': 'qty',
    'Gate In': 'gateIn',
    '进港日期': 'gateIn',
    'Job': 'job',
    '工作号': 'job',
    'Allocation': 'allocation',
    '分配': 'allocation',
    'Remark': 'remark',
    '备注': 'remark'
  };

  // 自动生成字段key
  const generateFieldKey = (label: string): string => {
    const labelLower = label.toLowerCase().trim();
    
    // 检查是否有预定义的映射
    for (const [preLabel, preKey] of Object.entries(PREDEFINED_FIELD_MAP)) {
      if (preLabel.toLowerCase() === labelLower) {
        return preKey;
      }
    }
    
    // 默认生成规则
    let key = labelLower
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // 如果是中文，翻译成英文
    const chineseMap: Record<string, string> = {
      '状态': 'state',
      '周': 'week',
      '订舱号': 'bookingRef',
      '承运人': 'carrier',
      '客户': 'client',
      '服务': 'service',
      '起运港': 'pol',
      '目的港': 'pod',
      '预计开航日': 'etd',
      '船名': 'vessel',
      '箱型': 'type',
      '数量': 'qty',
      '进港日期': 'gateIn',
      '工作号': 'job',
      '分配': 'allocation',
      '备注': 'remark'
    };
    
    if (chineseMap[label]) {
      return chineseMap[label];
    }
    
    // 确保key不为空
    if (!key) {
      key = 'field_' + Date.now().toString().slice(-6);
    }
    
    return key;
  };

  const handleAddField = () => {
    if (!newField.label.trim()) {
      setError('字段名称不能为空');
      return;
    }
    
    // 生成或使用自定义的key
    let key = newField.key?.trim() || generateFieldKey(newField.label);
    
    // 检查key是否已存在
    if (fields.some(f => f.key === key)) {
      setError(`字段标识 "${key}" 已存在，请使用不同的名称`);
      return;
    }
    
    // 检查是否是系统字段
    if (SYSTEM_FIELDS.includes(key)) {
      setError(`"${key}" 是系统字段，请使用其他名称`);
      return;
    }
    
    // 确定字段宽度
    let width = 'w-32';
    if (newField.type === 'TEXT' || newField.type === 'SELECT') {
      width = 'w-40';
    } else if (newField.type === 'DATE') {
      width = 'w-36';
    } else if (newField.type === 'NUMBER') {
      width = 'w-24';
    }
    
    const fieldToAdd: FieldDefinition = {
      key,
      label: newField.label.trim(),
      type: newField.type,
      width,
      isSystem: false,
      sortable: true,
      editable: true
    };

    onUpdateFields([...fields, fieldToAdd]);
    setNewField({ label: '', type: 'TEXT', key: '' });
    setError('');
    setShowAdvanced(false);
  };

  const handleDelete = (fieldKey: string, fieldLabel: string) => {
    // 检查是否是系统字段
    if (SYSTEM_FIELDS.includes(fieldKey)) {
      alert(`"${fieldLabel}" 是系统字段，不能删除`);
      return;
    }
    
    if (window.confirm(`删除列 "${fieldLabel}"？这只会隐藏显示，不会删除数据。`)) {
      onUpdateFields(fields.filter((f) => f.key !== fieldKey));
    }
  };

  const handleUpdateLabel = (index: number, newLabel: string) => {
    const field = fields[index];
    
    // 检查是否是系统字段
    if (SYSTEM_FIELDS.includes(field.key)) {
      alert(`"${field.label}" 是系统字段，不能重命名`);
      return;
    }
    
    const updated = [...fields];
    updated[index] = { ...updated[index], label: newLabel };
    onUpdateFields(updated);
  };

  const handleUpdateKey = (index: number, newKey: string) => {
    const field = fields[index];
    
    // 检查是否是系统字段
    if (SYSTEM_FIELDS.includes(field.key)) {
      alert(`"${field.label}" 是系统字段，不能修改标识符`);
      return;
    }
    
    const cleanKey = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    // 检查key是否已存在
    if (fields.some((f, i) => i !== index && f.key === cleanKey)) {
      alert(`标识符 "${cleanKey}" 已存在`);
      return;
    }
    
    // 检查是否是系统字段名
    if (SYSTEM_FIELDS.includes(cleanKey)) {
      alert(`"${cleanKey}" 是系统字段标识符，请使用其他名称`);
      return;
    }
    
    const updated = [...fields];
    updated[index] = { ...updated[index], key: cleanKey };
    onUpdateFields(updated);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    if (draggedIndex === dropIndex) return;

    const updatedFields = [...fields];
    const [draggedItem] = updatedFields.splice(draggedIndex, 1);
    updatedFields.splice(dropIndex, 0, draggedItem);
    
    onUpdateFields(updatedFields);
    setDraggedIndex(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddField();
    }
  };

  const handleLabelChange = (value: string) => {
    setNewField(prev => ({
      ...prev,
      label: value,
      key: prev.key || generateFieldKey(value)
    }));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-800">列管理</h3>
              <p className="text-xs text-gray-500">拖拽行重新排序，点击文本重命名</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-0 overflow-y-auto flex-1">
          <div className="p-4 bg-blue-50/50 border-b border-blue-100 mb-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <GripVertical className="w-3 h-3" /> 
                系统字段（灰色）不能删除或重命名
              </p>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                {showAdvanced ? '隐藏字段标识' : '显示字段标识'}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="w-10 py-3 text-center bg-gray-50 border-b"></th>
                  <th className="px-3 py-3 bg-gray-50 border-b font-semibold">显示名称</th>
                  {showAdvanced && (
                    <th className="px-3 py-3 bg-gray-50 border-b font-semibold">字段标识</th>
                  )}
                  <th className="px-3 py-3 bg-gray-50 border-b font-semibold">类型</th>
                  <th className="px-3 py-3 bg-gray-50 border-b font-semibold">宽度</th>
                  <th className="px-3 py-3 text-right bg-gray-50 border-b font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, idx) => {
                  const isSystem = SYSTEM_FIELDS.includes(field.key);
                  return (
                    <tr 
                      key={field.key} 
                      className={`
                        transition-all duration-200 group
                        ${draggedIndex === idx ? 'opacity-40 bg-gray-100' : 'hover:bg-blue-50/30'}
                        ${isSystem ? 'bg-gray-50' : 'bg-white'}
                      `}
                      draggable={!isSystem}
                      onDragStart={isSystem ? undefined : (e) => handleDragStart(e, idx)}
                      onDragOver={isSystem ? undefined : (e) => handleDragOver(e, idx)}
                      onDrop={isSystem ? undefined : (e) => handleDrop(e, idx)}
                    >
                      <td className="py-2 text-center">
                        {!isSystem ? (
                          <div className="cursor-move text-gray-300 hover:text-gray-500 active:text-blue-500">
                            <GripVertical className="w-4 h-4 mx-auto" />
                          </div>
                        ) : (
                          <div className="text-blue-400">
                            <AlertCircle className="w-4 h-4 mx-auto" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          value={field.label}
                          onChange={(e) => handleUpdateLabel(idx, e.target.value)}
                          disabled={isSystem}
                          className={`
                            border rounded px-2 py-1.5 w-full outline-none transition-all
                            ${isSystem 
                              ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' 
                              : 'border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent'
                            }
                          `}
                        />
                      </td>
                      {showAdvanced && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                              {field.key}
                            </code>
                            {!isSystem && (
                              <input 
                                value={field.key}
                                onChange={(e) => handleUpdateKey(idx, e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-32 outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="字段标识"
                              />
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span className={`
                          px-2 py-1 rounded text-xs font-mono
                          ${field.type === 'SELECT' ? 'bg-purple-100 text-purple-600' :
                            field.type === 'DATE' ? 'bg-green-100 text-green-600' :
                            field.type === 'NUMBER' ? 'bg-blue-100 text-blue-600' :
                            'bg-gray-100 text-gray-600'}
                        `}>
                          {field.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-500">{field.width || 'auto'}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!isSystem ? (
                          <button 
                            onClick={() => handleDelete(field.key, field.label)} 
                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic px-2">系统字段</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex-shrink-0 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">添加新列</label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input 
                    placeholder="列显示名称 (如: 特殊备注)" 
                    value={newField.label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1 ml-1">提示: 输入中文会自动生成对应英文标识</p>
                </div>
                <select 
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 shadow-sm w-32"
                >
                  <option value="TEXT">文本</option>
                  <option value="SELECT">下拉选项</option>
                  <option value="DATE">日期</option>
                  <option value="NUMBER">数字</option>
                </select>
                <Button onClick={handleAddField} size="md" className="shadow-sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {showAdvanced && (
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <input 
                    placeholder="字段标识 (数据库字段名)" 
                    value={newField.key || ''}
                    onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-mono"
                  />
                  <p className="text-xs text-gray-400">建议使用英文小写字母和下划线</p>
                </div>
              )}
              
              {error && (
                <div className="p-2 rounded bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
          
          <div className="pt-2 flex gap-2">
            <Button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              variant="secondary"
              className="flex-1"
            >
              <Key className="w-4 h-4 mr-2" />
              {showAdvanced ? '隐藏高级选项' : '显示高级选项'}
            </Button>
            <Button onClick={onClose} className="flex-1 justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-sm py-2.5">
              完成
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
