import React, { useState } from 'react';
import { Database as DatabaseType, SystemSettings, GateInRate, GateInRateItem, Allocation } from '../types'; // 导入 Allocation 类型
import { Button } from './Button';
import { 
  Save, Trash2, Plus, X, Upload, Download, Database, 
  Building, Ship, MapPin, Calendar, Tag, Users, Briefcase, 
  ClipboardList, FileText, DollarSign, Filter, RefreshCw,
  ChevronDown, ChevronUp, ChevronRight, Settings as SettingsIcon,
  AlertTriangle, Check, Eye, EyeOff, StickyNote, Info
} from 'lucide-react';

interface SettingsPanelProps {
  carriers: string[];
  setCarriers: (v: string[]) => void;
  clients: string[];
  setClients: (v: string[]) => void;
  services: string[];
  setServices: (v: string[]) => void;
  pols: string[];
  setPols: (v: string[]) => void;
  pods: string[];
  setPods: (v: string[]) => void;
  containerTypes: string[];
  setContainerTypes: (v: string[]) => void;
  statuses: string[];
  setStatuses: (v: string[]) => void;
  jobs: string[];
  setJobs: (v: string[]) => void;
  allocations: Allocation[]; // 修改为 Allocation[] 类型
  setAllocations: (v: Allocation[]) => void; // 修改为 Allocation[] 类型
  remarks: string[];
  setRemarks: (v: string[]) => void;
  databases: DatabaseType[];
  addDatabase: (name: string) => void;
  renameDatabase: (id: string, newName: string) => void;
  deleteDatabase: (id: string) => void;
  onImportSettings?: (settings: SystemSettings) => void;
  systemSettings: SystemSettings;
  updateSetting: (key: keyof SystemSettings, value: any) => Promise<void>;
  onRefreshDatabases?: () => void;
}

// 可折叠面板组件 - 优化版
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
  children: React.ReactNode;
  description?: string;
  danger?: boolean;
}> = ({ title, icon: Icon, isOpen, onToggle, badge, children, description, danger = false }) => {
  return (
    <div className={`rounded-lg border overflow-hidden transition-all duration-200 ${
      danger ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
    }`}>
      {/* 可点击的标题栏 - 优化版 */}
      <button
        onClick={onToggle}
        className={`w-full p-4 flex items-center justify-between transition-colors focus:outline-none focus:ring-2 ${
          danger ? 'focus:ring-red-500 hover:bg-red-100' : 'focus:ring-blue-500 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${
            danger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-lg ${
                danger ? 'text-red-800' : 'text-gray-800'
              }`}>
                {title}
              </h3>
              {badge !== undefined && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  danger ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className={`text-sm mt-0.5 ${
                danger ? 'text-red-600' : 'text-gray-500'
              }`}>
                {description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            danger ? 'bg-red-200 text-red-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {isOpen ? '已展开' : '已折叠'}
          </span>
          {isOpen ? (
            <ChevronUp className={`w-5 h-5 ${
              danger ? 'text-red-500' : 'text-gray-400'
            }`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${
              danger ? 'text-red-500' : 'text-gray-400'
            }`} />
          )}
        </div>
      </button>
      
      {/* 内容区域 */}
      {isOpen && (
        <div className={`p-4 border-t transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
          danger ? 'border-red-100' : 'border-gray-100'
        }`}>
          {children}
        </div>
      )}
    </div>
  );
};

// 优化 StringArrayInput 组件
const StringArrayInput: React.FC<{
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  label?: string;
  description?: string;
}> = ({ values, onAdd, onRemove, placeholder, label, description }) => {
  const [inputValue, setInputValue] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  
  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      onAdd(trimmed);
      setInputValue('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };
  
  return (
    <div className="space-y-3">
      {(label || description) && (
        <div className="mb-2">
          {label && <h4 className="font-medium text-gray-700 text-sm mb-1">{label}</h4>}
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      )}
      
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "输入值后按回车添加"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {inputValue && (
            <button
              onClick={handleAdd}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-blue-600 hover:text-blue-800"
              title="添加"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button onClick={handleAdd} size="sm" variant="primary" disabled={!inputValue.trim()}>
          添加
        </Button>
      </div>
      
      {values.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              共 {values.length} 个选项
            </span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? '隐藏预览' : '显示预览'}
            </button>
          </div>
          
          {showPreview && (
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
              {values.map((item, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-full text-sm border border-gray-300 shadow-sm"
                >
                  <span className="font-medium">{item}</span>
                  <button
                    onClick={() => onRemove(idx)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="删除此选项"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {values.length === 0 && (
        <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-400 text-sm italic">暂无数据</div>
        </div>
      )}
    </div>
  );
};

// Allocation 数组输入组件 - 优化版，支持备注提示
const AllocationArrayInput: React.FC<{
  allocations: Allocation[];
  onAdd: (allocation: Allocation) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, allocation: Allocation) => void;
}> = ({ allocations, onAdd, onRemove, onUpdate }) => {
  const [newValue, setNewValue] = useState('');
  const [newNote, setNewNote] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingNote, setEditingNote] = useState('');
  
  const handleAdd = () => {
    const trimmedValue = newValue.trim();
    if (trimmedValue) {
      const newAllocation: Allocation = {
        id: `alloc_${Date.now()}`,
        name: trimmedValue,
        value: trimmedValue,
        note: newNote.trim()
      };
      onAdd(newAllocation);
      setNewValue('');
      setNewNote('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newValue.trim()) {
      e.preventDefault();
      handleAdd();
    }
  };
  
  const startEditing = (index: number, allocation: Allocation) => {
    setEditingIndex(index);
    setEditingValue(allocation.value);
    setEditingNote(allocation.note);
  };
  
  const saveEditing = (index: number) => {
    if (editingValue.trim()) {
      onUpdate(index, {
        id: allocations[index].id,
        name: editingValue.trim(),
        value: editingValue.trim(),
        note: editingNote.trim()
      });
      setEditingIndex(null);
    }
  };
  
  const cancelEditing = () => {
    setEditingIndex(null);
  };
  
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700 text-sm">添加新分配项</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              分配值 <span className="text-red-500">*</span>
              <span className="text-gray-400 ml-1">（将显示在表单中）</span>
            </label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入分配代码，如：SAF-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              备注/说明 <span className="text-gray-400">（鼠标悬停时显示）</span>
            </label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入备注信息，将在鼠标悬停时显示"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={handleAdd} 
            size="sm" 
            variant="primary" 
            disabled={!newValue.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加分配项
          </Button>
        </div>
      </div>
      
      {allocations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700 text-sm">
              分配项列表（共 {allocations.length} 项）
              <span className="text-gray-400 font-normal ml-2 text-xs">
                ✓ 备注信息将在全网站鼠标悬停时显示
              </span>
            </h4>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 text-xs font-medium text-gray-600 grid grid-cols-12 gap-2 border-b">
              <div className="col-span-1">序号</div>
              <div className="col-span-3">分配值</div>
              <div className="col-span-6">备注/说明</div>
              <div className="col-span-2">操作</div>
            </div>
            <div className="divide-y">
              {allocations.map((allocation, index) => (
                <div key={index} className="p-3 hover:bg-gray-50 grid grid-cols-12 gap-2 items-center text-sm">
                  {editingIndex === index ? (
                    <>
                      <div className="col-span-1 text-gray-500">{index + 1}</div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          placeholder="备注将在鼠标悬停时显示"
                        />
                      </div>
                      <div className="col-span-2 flex gap-1">
                        <button
                          onClick={() => saveEditing(index)}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="保存"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-gray-600 hover:text-gray-800 p-1"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="col-span-1 text-gray-500">{index + 1}</div>
                      <div className="col-span-3 font-medium text-gray-900 group relative">
                        <span className="inline-flex items-center">
                          {allocation.value}
                          {allocation.note && (
                            <Info className="w-3 h-3 ml-1 text-gray-400" />
                          )}
                        </span>
                        {allocation.note && (
                          <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              {allocation.note}
                              <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="col-span-6 text-gray-700 truncate" title={allocation.note}>
                        {allocation.note || <span className="text-gray-400 italic">无备注，鼠标悬停不会显示提示</span>}
                      </div>
                      <div className="col-span-2 flex gap-1">
                        <button
                          onClick={() => startEditing(index, allocation)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="编辑"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => onRemove(index)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {allocations.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <StickyNote className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="font-medium text-gray-600 mb-1">暂无分配项</h4>
          <p className="text-sm text-gray-500">请在上方添加新的分配项，备注信息将在鼠标悬停时显示</p>
        </div>
      )}
    </div>
  );
};

// 多选组件 - 新增
const MultiSelect: React.FC<{
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}> = ({ options, selectedValues, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };
  
  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };
  
  return (
    <div className="relative">
      <div
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[42px] cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1">
          {selectedValues.length > 0 ? (
            selectedValues.map((value) => {
              const option = options.find(o => o.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                >
                  {option?.label || value}
                  <button
                    type="button"
                    onClick={(e) => removeOption(value, e)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })
          ) : (
            <span className="text-gray-400">{placeholder || "选择选项..."}</span>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* 搜索框 */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索..."
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* 选项列表 */}
          <div className="p-1">
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 rounded flex items-center gap-2 ${
                  selectedValues.includes(option.value) ? 'bg-blue-50 text-blue-700' : ''
                }`}
                onClick={() => toggleOption(option.value)}
              >
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                  selectedValues.includes(option.value)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedValues.includes(option.value) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span>{option.label}</span>
              </div>
            ))}
            
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                没有找到匹配的选项
              </div>
            )}
          </div>
          
          {/* 底部操作 */}
          <div className="p-2 border-t flex justify-between">
            <button
              type="button"
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => onChange(options.map(o => o.value))}
            >
              全选
            </button>
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-800"
              onClick={() => onChange([])}
            >
              清除
            </button>
          </div>
        </div>
      )}
      
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// 进港费率项目组件 - 新增
const GateInRateItemComponent: React.FC<{
  item: GateInRateItem;
  index: number;
  onUpdate: (index: number, item: GateInRateItem) => void;
  onRemove: (index: number) => void;
  availablePols: string[];
  availablePods: string[];
  availableContainerTypes: string[];
}> = ({ item, index, onUpdate, onRemove, availablePols, availablePods, availableContainerTypes }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // 处理多选变化
  const handlePolsChange = (selectedPols: string[]) => {
    onUpdate(index, { ...item, pols: selectedPols });
  };
  
  const handlePodsChange = (selectedPods: string[]) => {
    onUpdate(index, { ...item, pods: selectedPods });
  };
  
  const handleContainerTypesChange = (selectedTypes: string[]) => {
    onUpdate(index, { ...item, containerTypes: selectedTypes });
  };
  
  const handlePriceChange = (price: number) => {
    onUpdate(index, { ...item, price });
  };
  
  return (
    <div className="border rounded-lg p-4 mb-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <h5 className="font-medium text-gray-800">价格组合 {index + 1}</h5>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-green-600">
            ${item.price.toFixed(2)}
          </span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800 p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
          {/* 起运港多选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              起运港 (POLs) *
              <span className="text-gray-400 ml-1">（从系统选项导入）</span>
            </label>
            <MultiSelect
              options={availablePols.map(pol => ({ value: pol, label: pol }))}
              selectedValues={item.pols}
              onChange={handlePolsChange}
              placeholder="选择起运港"
            />
            <div className="mt-1 text-xs text-gray-500">
              已选择 {item.pols.length} 个起运港
            </div>
          </div>
          
          {/* 目的港多选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目的港 (PODs) *
              <span className="text-gray-400 ml-1">（从系统选项导入）</span>
            </label>
            <MultiSelect
              options={availablePods.map(pod => ({ value: pod, label: pod }))}
              selectedValues={item.pods}
              onChange={handlePodsChange}
              placeholder="选择目的港"
            />
            <div className="mt-1 text-xs text-gray-500">
              已选择 {item.pods.length} 个目的港
            </div>
          </div>
          
          {/* 箱型多选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              箱型 (Container Types) *
              <span className="text-gray-400 ml-1">（从系统选项导入）</span>
            </label>
            <MultiSelect
              options={availableContainerTypes.map(type => ({ value: type, label: type }))}
              selectedValues={item.containerTypes}
              onChange={handleContainerTypesChange}
              placeholder="选择箱型"
            />
            <div className="mt-1 text-xs text-gray-500">
              已选择 {item.containerTypes.length} 种箱型
            </div>
          </div>
          
          {/* 价格 */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              价格 (Price) *
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={item.price}
                onChange={(e) => handlePriceChange(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
              />
            </div>
          </div>
          
          {/* 预览 */}
          <div className="md:col-span-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">起运港:</span>
              {item.pols.length > 0 ? (
                item.pols.map((pol, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    {pol}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs">未选择</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">目的港:</span>
              {item.pods.length > 0 ? (
                item.pods.map((pod, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    {pod}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs">未选择</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">箱型:</span>
              {item.containerTypes.length > 0 ? (
                item.containerTypes.map((type, idx) => (
                  <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    {type}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-xs">未选择</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">价格:</span>
              <span className="font-semibold text-green-600">${item.price.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  carriers, setCarriers,
  clients, setClients,
  services, setServices,
  pols, setPols,
  pods, setPods,
  containerTypes, setContainerTypes,
  statuses, setStatuses,
  jobs, setJobs,
  allocations, setAllocations,
  remarks, setRemarks,
  databases, addDatabase, renameDatabase, deleteDatabase,
  onImportSettings,
  systemSettings,
  updateSetting,
  onRefreshDatabases
}) => {
  const [newDbName, setNewDbName] = useState('');
  const [editingDbId, setEditingDbId] = useState<string | null>(null);
  const [editingDbName, setEditingDbName] = useState('');
  
  // 进港费率状态 - 修改为新的数据结构
  const [gateInRates, setGateInRates] = useState<GateInRate[]>(systemSettings.gateInRates || []);
  const [newGateInRate, setNewGateInRate] = useState<Omit<GateInRate, 'id'>>({
    startDate: '',
    endDate: '',
    service: '',
    contact: '',
    items: [] // 初始为空数组
  });
  const [showGateInRateForm, setShowGateInRateForm] = useState(false);
  
  // 可折叠面板状态 - 修改：默认全部折叠
  const [openSections, setOpenSections] = useState({
    systemOptions: false,
    allocationOptions: false, // 新增：分配项配置
    databaseManagement: false,
    gateInRates: false
  });

  // 切换面板展开状态
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 展开所有面板
  const expandAllSections = () => {
    setOpenSections({
      systemOptions: true,
      allocationOptions: true,
      databaseManagement: true,
      gateInRates: true
    });
  };

  // 折叠所有面板
  const collapseAllSections = () => {
    setOpenSections({
      systemOptions: false,
      allocationOptions: false,
      databaseManagement: false,
      gateInRates: false
    });
  };

  // 系统设置字段配置
  const systemSettingsFields = [
    {
      key: 'carriers' as keyof SystemSettings,
      label: '承运人 (Carriers)',
      icon: Ship,
      color: 'bg-blue-100 text-blue-600',
      values: carriers,
      setValues: setCarriers,
      placeholder: '输入承运人名称，按回车添加'
    },
    {
      key: 'clients' as keyof SystemSettings,
      label: '客户 (Clients)',
      icon: Building,
      color: 'bg-green-100 text-green-600',
      values: clients,
      setValues: setClients,
      placeholder: '输入客户名称，按回车添加'
    },
    {
      key: 'services' as keyof SystemSettings,
      label: '服务航线 (Services)',
      icon: Ship,
      color: 'bg-purple-100 text-purple-600',
      values: services,
      setValues: setServices,
      placeholder: '输入服务航线代码，按回车添加'
    },
    {
      key: 'pols' as keyof SystemSettings,
      label: '起运港 (POLs)',
      icon: MapPin,
      color: 'bg-orange-100 text-orange-600',
      values: pols,
      setValues: setPols,
      placeholder: '输入起运港名称，按回车添加'
    },
    {
      key: 'pods' as keyof SystemSettings,
      label: '目的港 (PODs)',
      icon: MapPin,
      color: 'bg-red-100 text-red-600',
      values: pods,
      setValues: setPods,
      placeholder: '输入目的港名称，按回车添加'
    },
    {
      key: 'containerTypes' as keyof SystemSettings,
      label: '箱型 (Container Types)',
      icon: Briefcase,
      color: 'bg-cyan-100 text-cyan-600',
      values: containerTypes,
      setValues: setContainerTypes,
      placeholder: '输入箱型，如 20GP, 40HQ'
    },
    {
      key: 'statuses' as keyof SystemSettings,
      label: '状态 (Statuses)',
      icon: Tag,
      color: 'bg-yellow-100 text-yellow-600',
      values: statuses,
      setValues: setStatuses,
      placeholder: '输入状态，如 PENDING, CONFIRMED'
    },
    {
      key: 'jobs' as keyof SystemSettings,
      label: '工作号 (Jobs)',
      icon: Briefcase,
      color: 'bg-indigo-100 text-indigo-600',
      values: jobs,
      setValues: setJobs,
      placeholder: '输入工作号，按回车添加'
    },
    {
      key: 'remarks' as keyof SystemSettings,
      label: '备注选项 (Remarks)',
      icon: FileText,
      color: 'bg-gray-100 text-gray-600',
      values: remarks,
      setValues: setRemarks,
      placeholder: '输入常用备注，按回车添加'
    }
  ];

  // 处理保存设置
  const handleSaveSetting = async (key: keyof SystemSettings, values: any) => {
    try {
      await updateSetting(key, values);
    } catch (error: any) {
      console.error(`保存${key}失败:`, error);
      alert(`保存失败: ${error.message}`);
    }
  };

  // 处理分配项操作
  const handleAddAllocation = (allocation: Allocation) => {
    const newAllocations = [...allocations, allocation];
    setAllocations(newAllocations);
    handleSaveSetting('allocations', newAllocations);
  };

  const handleRemoveAllocation = (index: number) => {
    const newAllocations = allocations.filter((_, i) => i !== index);
    setAllocations(newAllocations);
    handleSaveSetting('allocations', newAllocations);
  };

  const handleUpdateAllocation = (index: number, allocation: Allocation) => {
    const newAllocations = [...allocations];
    newAllocations[index] = allocation;
    setAllocations(newAllocations);
    handleSaveSetting('allocations', newAllocations);
  };

  // 添加新的价格组合项
  const handleAddRateItem = () => {
    const newItem: GateInRateItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pols: [],
      pods: [],
      containerTypes: [],
      price: 0
    };
    
    setNewGateInRate({
      ...newGateInRate,
      items: [...newGateInRate.items, newItem]
    });
  };

  // 更新价格组合项
  const handleUpdateRateItem = (itemIndex: number, updatedItem: GateInRateItem) => {
    const updatedItems = [...newGateInRate.items];
    updatedItems[itemIndex] = updatedItem;
    setNewGateInRate({ ...newGateInRate, items: updatedItems });
  };

  // 删除价格组合项
  const handleRemoveRateItem = (itemIndex: number) => {
    const updatedItems = newGateInRate.items.filter((_, index) => index !== itemIndex);
    setNewGateInRate({ ...newGateInRate, items: updatedItems });
  };

  // 处理进港费率 - 修改为新的数据结构
  const handleAddGateInRate = () => {
    if (!newGateInRate.startDate || !newGateInRate.endDate || newGateInRate.items.length === 0) {
      alert('请填写必填字段并至少添加一个价格组合');
      return;
    }
    
    // 检查所有项目是否都填写完整
    for (const item of newGateInRate.items) {
      if (item.pols.length === 0 || item.pods.length === 0 || item.containerTypes.length === 0 || item.price <= 0) {
        alert('请确保所有价格组合都已完整填写（起运港、目的港、箱型和价格）');
        return;
      }
    }
    
    const rate: GateInRate = {
      id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...newGateInRate,
      items: newGateInRate.items.map(item => ({
        ...item,
        id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }))
    };
    
    const newRates = [...gateInRates, rate];
    setGateInRates(newRates);
    updateSetting('gateInRates', newRates);
    
    // 重置表单
    setNewGateInRate({
      startDate: '',
      endDate: '',
      service: '',
      contact: '',
      items: []
    });
    setShowGateInRateForm(false);
  };

  const handleDeleteGateInRate = (index: number) => {
    if (window.confirm('确定删除此进港费率吗？')) {
      const newRates = gateInRates.filter((_, i) => i !== index);
      setGateInRates(newRates);
      updateSetting('gateInRates', newRates);
    }
  };

  // 处理数据库操作
  const handleAddDatabase = () => {
    if (!newDbName.trim()) {
      alert('请输入数据库名称');
      return;
    }
    const dbName = newDbName.trim();
    addDatabase(dbName);
    setNewDbName('');
  };

  const handleStartRename = (db: DatabaseType) => {
    setEditingDbId(db.id);
    setEditingDbName(db.name);
  };

  const handleSaveRename = (id: string) => {
    if (!editingDbName.trim()) {
      alert('数据库名称不能为空');
      return;
    }
    renameDatabase(id, editingDbName.trim());
    setEditingDbId(null);
    setEditingDbName('');
  };

  const handleCancelRename = () => {
    setEditingDbId(null);
    setEditingDbName('');
  };

  // 处理清空数据库数据
  const handleClearDatabaseData = async (dbId: string, dbName: string, bookingsCount: number = 0) => {
    const confirmMessage = `
      ⚠️  危险操作确认

      您即将清空数据库 "${dbName}" 中的所有数据：

      📊 当前数据统计：
      • 数据库名称：${dbName}
      • 预订记录数：${bookingsCount} 条
      • 操作类型：永久清空所有数据

      🚨 此操作不可恢复！
      所有数据将被永久删除，无法撤销。

      确认要执行此操作吗？

      如果您确定要继续，请在下方输入框中输入数据库名称 "${dbName}" 进行确认：
    `;
    
    const userInput = window.prompt(confirmMessage, '');
    
    if (userInput === null) {
      return;
    }
    
    if (userInput !== dbName) {
      alert('❌ 数据库名称输入错误，操作已取消。');
      return;
    }
    
    const finalConfirm = window.confirm(`
      ⚠️  最终确认

      您已确认要清空数据库 "${dbName}" 中的所有 ${bookingsCount} 条记录。

      此操作将：
      1. 永久删除所有预订记录
      2. 无法恢复
      3. 需要重新导入或创建数据

      最后确认：确定要执行清空操作吗？
    `);
    
    if (!finalConfirm) {
      return;
    }
    
    try {
      const response = await fetch(`/api/databases/${dbId}/clear-data`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ 数据库 "${dbName}" 数据已成功清空！\n\n已删除 ${result.deletedCount || bookingsCount} 条预订记录。`);
        
        if (onRefreshDatabases) {
          onRefreshDatabases();
        }
      } else {
        alert(`❌ 清空数据失败: ${result.error || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('清空数据失败:', error);
      alert(`❌ 清空数据失败: ${error.message || '请检查网络连接'}`);
    }
  };

  // 导出设置
  const handleExportSettings = () => {
    const settingsToExport = {
      carriers,
      clients,
      services,
      pols,
      pods,
      containerTypes,
      statuses,
      jobs,
      allocations, // 现在是 Allocation[] 类型
      remarks,
      gateInRates,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `oceanflow_settings_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 导入设置
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedSettings = JSON.parse(content);
        
        if (!importedSettings.carriers || !Array.isArray(importedSettings.carriers)) {
          throw new Error('无效的设置文件格式');
        }
        
        if (window.confirm(`导入设置将覆盖现有配置，确定继续吗？`)) {
          onImportSettings?.(importedSettings);
          alert('设置导入成功！');
        }
      } catch (error: any) {
        console.error('导入设置失败:', error);
        alert(`导入失败: ${error.message}`);
      }
      
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 p-4">
      {/* 头部 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">系统设置</h1>
            <p className="text-sm text-gray-600">管理系统选项和数据库配置</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 border-r border-gray-200 pr-3">
              <Button 
                onClick={expandAllSections} 
                variant="ghost"
                size="sm"
                title="展开所有"
                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              >
                全部展开
              </Button>
              <Button 
                onClick={collapseAllSections} 
                variant="ghost"
                size="sm"
                title="折叠所有"
                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
              >
                全部折叠
              </Button>
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="file"
                  id="import-settings"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                />
                <Button 
                  onClick={() => document.getElementById('import-settings')?.click()}
                  variant="secondary"
                  size="sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  导入设置
                </Button>
              </div>
              <Button 
                onClick={handleExportSettings} 
                variant="primary"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                导出设置
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-blue-800">系统选项配置</h3>
            </div>
            <p className="text-sm text-blue-600 mb-3">配置下拉选项列表，这些选项将在预订和报价表单中使用</p>
            <div className="text-xs text-blue-500">
              共 {systemSettingsFields.reduce((total, field) => total + field.values.length, 0)} 个选项
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-green-800">分配项配置</h3>
            </div>
            <p className="text-sm text-green-600 mb-3">配置分配项，支持值和备注信息（鼠标悬停显示备注）</p>
            <div className="text-xs text-green-500">
              共 {allocations.length} 个分配项
            </div>
          </div>
          
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-purple-800">进港费率管理</h3>
            </div>
            <p className="text-sm text-purple-600 mb-3">配置不同时间段的进港费率信息</p>
            <div className="text-xs text-purple-500">
              共 {gateInRates.length} 条费率记录
            </div>
          </div>
        </div>
      </div>

      {/* 主要设置区域 */}
      <div className="space-y-4">
        {/* 系统选项配置 */}
        <CollapsibleSection
          title="系统选项配置"
          icon={Filter}
          isOpen={openSections.systemOptions}
          onToggle={() => toggleSection('systemOptions')}
          badge={systemSettingsFields.reduce((total, field) => total + field.values.length, 0)}
          description="配置预订和报价表单中的下拉选项"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemSettingsFields.map((field) => (
              <div key={field.key} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${field.color}`}>
                      <field.icon className="w-4 h-4" />
                    </div>
                    <h4 className="font-medium text-gray-700">{field.label}</h4>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-white text-gray-600 rounded-full border border-gray-300">
                    {field.values.length} 项
                  </span>
                </div>
                
                <StringArrayInput
                  values={field.values}
                  onAdd={(value) => {
                    const newValues = [...field.values, value];
                    field.setValues(newValues);
                    handleSaveSetting(field.key, newValues);
                  }}
                  onRemove={(index) => {
                    const newValues = field.values.filter((_, i) => i !== index);
                    field.setValues(newValues);
                    handleSaveSetting(field.key, newValues);
                  }}
                  placeholder={field.placeholder}
                  label=""
                  description=""
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* 分配项配置 */}
        <CollapsibleSection
          title="分配项配置"
          icon={Users}
          isOpen={openSections.allocationOptions}
          onToggle={() => toggleSection('allocationOptions')}
          badge={allocations.length}
          description="配置分配项，每个分配项包含值和可选的备注信息（鼠标悬停时显示备注）"
        >
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <AllocationArrayInput
              allocations={allocations}
              onAdd={handleAddAllocation}
              onRemove={handleRemoveAllocation}
              onUpdate={handleUpdateAllocation}
            />
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">分配项备注功能说明：</p>
                  <ul className="space-y-1">
                    <li>• 为分配项添加备注后，在全网站的分配项选择中都会显示提示</li>
                    <li>• 鼠标悬停在分配项上时会显示备注信息</li>
                    <li>• 备注信息适用于：预订表单、报价表单、筛选器等所有使用分配项的地方</li>
                    <li>• 如果没有备注，鼠标悬停时不会显示任何提示</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 数据库管理 */}
        <CollapsibleSection
          title="数据库管理"
          icon={Database}
          isOpen={openSections.databaseManagement}
          onToggle={() => toggleSection('databaseManagement')}
          badge={databases.length}
          description="管理系统的数据库，包括创建、重命名和删除操作"
        >
          <div className="space-y-6">
            {/* 添加新数据库 */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-3">创建新数据库</h4>
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newDbName}
                    onChange={(e) => setNewDbName(e.target.value)}
                    placeholder="输入新数据库名称，例如：COSCO-US"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDatabase()}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    建议使用简洁明了的名称，如：COSCO-US, MAERSK-EUR 等
                  </p>
                </div>
                <Button onClick={handleAddDatabase} className="h-full px-6">
                  <Plus className="w-4 h-4 mr-2" />
                  创建数据库
                </Button>
              </div>
            </div>
            
            {/* 数据库列表 */}
            <div>
              <h4 className="font-medium text-gray-800 mb-3">数据库列表</h4>
              <div className="border rounded-lg divide-y">
                {databases.map((db) => (
                  <div key={db.id} className="p-4 hover:bg-gray-50 transition-colors">
                    {editingDbId === db.id ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Database className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editingDbName}
                              onChange={(e) => setEditingDbName(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(db.id);
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleSaveRename(db.id)} 
                            variant="primary"
                            size="sm"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            保存
                          </Button>
                          <Button 
                            onClick={handleCancelRename} 
                            variant="secondary"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-1" />
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Database className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h5 className="font-semibold text-gray-900 text-lg">{db.name}</h5>
                              <div className="text-sm text-gray-600 mt-1">
                                <div className="flex items-center gap-4">
                                  <span className="inline-flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                                    创建于 {new Date(db.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="inline-flex items-center">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                                    更新于 {new Date(db.updatedAt).toLocaleDateString()}
                                  </span>
                                  <span className="inline-flex items-center">
                                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
                                    预订数：{db.bookingsCount || 0} 条
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2">
                                <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                                  数据库 ID: {db.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleStartRename(db)}
                              variant="secondary"
                              size="sm"
                            >
                              重命名
                            </Button>
                            
                            {/* 清空数据按钮 */}
                            {(db.bookingsCount || 0) > 0 && (
                              <Button
                                onClick={() => handleClearDatabaseData(db.id, db.name, db.bookingsCount || 0)}
                                variant="secondary"
                                size="sm"
                                title={`清空数据库 "${db.name}" 中的所有 ${db.bookingsCount || 0} 条数据`}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                清空数据
                              </Button>
                            )}
                            
                            {/* 删除数据库按钮 */}
                            {databases.length > 1 && (
                              <Button
                                onClick={() => deleteDatabase(db.id)}
                                variant="danger"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          {(db.bookingsCount || 0) > 0 && (
                            <div className="text-xs text-red-600 text-right">
                              ⚠️ 清空数据将永久删除 {db.bookingsCount || 0} 条记录
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {databases.length === 0 && (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Database className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-gray-600 mb-2">暂无数据库</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      请在上方创建一个数据库来开始管理预订数据
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 进港费率管理 - 修改为新的数据结构 */}
        <CollapsibleSection
          title="进港费率管理"
          icon={DollarSign}
          isOpen={openSections.gateInRates}
          onToggle={() => toggleSection('gateInRates')}
          badge={gateInRates.length}
          description="配置不同时间段的进港费率信息，支持多个价格组合"
        >
          <div className="space-y-6">
            {/* 添加进港费率按钮 */}
            {!showGateInRateForm && (
              <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setShowGateInRateForm(true)}>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Plus className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-700 mb-1">添加入港费率</h4>
                <p className="text-sm text-gray-500">点击此处添加新的进港费率记录</p>
              </div>
            )}
            
            {/* 进港费率表单 - 修改为新的数据结构 */}
            {showGateInRateForm && (
              <div className="bg-white p-6 rounded-lg border border-gray-300 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">添加入港费率</h4>
                  <Button
                    onClick={() => setShowGateInRateForm(false)}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      开始日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newGateInRate.startDate}
                      onChange={(e) => setNewGateInRate({ ...newGateInRate, startDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      结束日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newGateInRate.endDate}
                      onChange={(e) => setNewGateInRate({ ...newGateInRate, endDate: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      航线
                    </label>
                    <input
                      type="text"
                      value={newGateInRate.service}
                      onChange={(e) => setNewGateInRate({ ...newGateInRate, service: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="例如：US-EUR"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      合约
                    </label>
                    <input
                      type="text"
                      value={newGateInRate.contact}
                      onChange={(e) => setNewGateInRate({ ...newGateInRate, contact: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="例如：2024-001"
                    />
                  </div>
                </div>
                
                {/* 价格组合列表 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-medium text-gray-800">价格组合</h5>
                    <Button
                      onClick={handleAddRateItem}
                      variant="primary"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      添加价格组合
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {newGateInRate.items.length > 0 ? (
                      newGateInRate.items.map((item, index) => (
                        <GateInRateItemComponent
                          key={item.id || index}
                          item={item}
                          index={index}
                          onUpdate={handleUpdateRateItem}
                          onRemove={handleRemoveRateItem}
                          availablePols={pols}
                          availablePods={pods}
                          availableContainerTypes={containerTypes}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">点击"添加价格组合"按钮创建第一个组合</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={handleAddGateInRate} className="flex-1 py-3" disabled={newGateInRate.items.length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    保存费率
                  </Button>
                  <Button 
                    onClick={() => setShowGateInRateForm(false)} 
                    variant="secondary"
                    className="flex-1 py-3"
                  >
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                </div>
              </div>
            )}
            
            {/* 进港费率列表 - 修改为新的数据结构 */}
            {gateInRates.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-3">进港费率列表</h4>
                <div className="space-y-4">
                  {gateInRates.map((rate, index) => (
                    <div key={rate.id} className="border rounded-lg overflow-hidden bg-white">
                      <div className="p-4 bg-gray-50 border-b">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <h5 className="font-semibold text-gray-900">
                              {rate.service || '通用航线'} - {rate.contact || '通用合约'}
                            </h5>
                            <p className="text-sm text-gray-600">
                              {rate.startDate} 至 {rate.endDate}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              {rate.items.length} 个价格组合
                            </span>
                            <button
                              onClick={() => handleDeleteGateInRate(index)}
                              className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors"
                              title="删除此费率"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="space-y-3">
                          {rate.items.map((item, itemIndex) => (
                            <div key={item.id || itemIndex} className="p-3 border rounded bg-gray-50">
                              <div className="grid grid-cols-4 gap-3 mb-2">
                                <div>
                                  <span className="text-xs font-medium text-gray-500">起运港:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.pols.map((pol, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                        {pol}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">目的港:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.pods.map((pod, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                        {pod}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-500">箱型:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.containerTypes.map((type, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                        {type}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-medium text-gray-500">价格:</span>
                                  <div className="mt-1 font-semibold text-green-600">
                                    ${item.price.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {gateInRates.length === 0 && !showGateInRateForm && (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="font-medium text-gray-600 mb-2">暂无进港费率记录</h4>
                <p className="text-sm text-gray-500 mb-4">
                  点击上方按钮添加入港费率记录
                </p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
      
      {/* 底部说明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
            <SettingsIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-blue-800 mb-2 text-lg">设置说明</h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span><strong>系统选项配置：</strong>配置下拉选项列表，这些选项将在预订和报价表单中使用，添加常用值可提高录入效率</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span><strong>分配项配置：</strong>分配项现在支持值和备注信息，备注信息将在全网站鼠标悬停时显示，可用于更详细的分配说明和管理</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span><strong>数据库管理：</strong>每个数据库独立存储预订数据，可创建多个数据库用于不同项目或团队，清空数据操作会永久删除所有记录</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span><strong>进港费率管理：</strong>支持同一时间段内多个价格组合，每个组合可配置不同的起运港、目的港、箱型和价格，提供更大的灵活性</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <span><strong>设置保存：</strong>所有设置会自动保存到服务器，也可以通过导入/导出功能备份或迁移设置</span>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-white/50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">提示：</span>
                <span>点击每个面板的标题栏可以展开或折叠内容，使用"全部展开/折叠"按钮可快速管理所有面板</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};