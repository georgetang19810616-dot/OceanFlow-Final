import React, { useState, useMemo } from 'react';
import { FieldDefinition, FilterCondition } from '../types';
import { Button } from './Button';
import { 
  X, Filter, Search, Trash2, Calendar, 
  Type, List, Hash, GripVertical, ArrowRight, Check,
  Minimize2, Maximize2, Smartphone, Monitor, ChevronLeft
} from 'lucide-react';

interface AdvancedFilterProps {
  isOpen: boolean;
  fields: FieldDefinition[];
  optionsMap: Record<string, string[]>;
  filters: FilterCondition[];
  onAddFilter: (filter: FilterCondition) => void;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  onClose?: () => void;
}

type PanelSize = 'mobile' | 'tablet' | 'desktop' | 'fullscreen';

export const AdvancedFilter: React.FC<AdvancedFilterProps> = ({
  isOpen, fields, optionsMap, filters, onAddFilter, onRemoveFilter, onClearAll, onClose
}) => {
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>(fields[0]?.key || '');
  const [valueSearch, setValueSearch] = useState('');
  const [panelSize, setPanelSize] = useState<PanelSize>('desktop');
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'values' | 'selected'>('fields');
  
  // 辅助函数：获取字段类型文本
  const getFieldTypeText = (type: string) => {
    if (type === 'select') return '选项';
    if (type === 'date') return '日期';
    if (type === 'number') return '数字';
    return '文本';
  };

  // 检测移动设备
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobileLayout(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeField = fields.find(f => f.key === selectedFieldKey);
  
  // Get unique values for the selected field from optionsMap
  const fieldValues = useMemo(() => {
      if (!activeField) return [];
      const rawOptions = optionsMap[activeField.key] || [];
      return rawOptions.filter(opt => 
          opt.toLowerCase().includes(valueSearch.toLowerCase())
      );
  }, [activeField, optionsMap, valueSearch]);

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'date': return <Calendar className="w-2.5 h-2.5 text-purple-500" />;
      case 'select': return <List className="w-2.5 h-2.5 text-orange-500" />;
      case 'number': return <Hash className="w-2.5 h-2.5 text-green-500" />;
      default: return <Type className="w-2.5 h-2.5 text-blue-500" />;
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, value: string) => {
      e.dataTransfer.setData("filter_value", value);
      e.dataTransfer.setData("field_key", selectedFieldKey);
      e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
  };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const value = e.dataTransfer.getData("filter_value");
        const key = e.dataTransfer.getData("field_key");
        
        if (value && key) {
            // Check if already exists
            const exists = filters.some(f => f.fieldKey === key && f.value === value);
            if (!exists) {
                onAddFilter({
                    id: Date.now().toString() + Math.random(),
                    fieldKey: key,
                    operator: 'equals',
                    value: value
                });
            }
        }
    };

  // Direct click handler as alternative
    const handleValueClick = (value: string) => {
        const exists = filters.some(f => f.fieldKey === selectedFieldKey && f.value === value);
        if (!exists) {
            onAddFilter({
                id: Date.now().toString() + Math.random(),
                fieldKey: selectedFieldKey,
                operator: 'equals',
                value: value
            });
        }
    };

  // 获取面板尺寸样式 - 进一步缩小移动端尺寸
  const getPanelSizeClass = () => {
    if (isMobileLayout) {
      return 'top-18 left-1/2 transform -translate-x-1/2 w-[60vw] max-h-[60vh] rounded-lg';
    }
    
    switch (panelSize) {
      case 'mobile':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[80vh] max-w-[400px] rounded-xl';
      case 'tablet':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[85vh] max-w-[700px] rounded-xl';
      case 'desktop':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-xl';
      case 'fullscreen':
        return 'top-4 left-4 right-4 bottom-4 w-auto h-auto rounded-xl';
      default:
        return 'top-32 left-1/2 transform -translate-x-1/2 w-[900px] h-[500px] rounded-xl';
    }
  };

  // 移动端标签页导航 - 更紧凑
  const renderMobileTabs = () => (
    <div className="flex border-b border-gray-200 bg-gray-50 px-1">
      <button
        onClick={() => setActiveTab('fields')}
        className={`flex-1 py-2 text-[10px] font-medium flex items-center justify-center gap-1 ${
          activeTab === 'fields' 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <List className="w-3 h-3" />
        字段
      </button>
      <button
        onClick={() => setActiveTab('values')}
        className={`flex-1 py-2 text-[10px] font-medium flex items-center justify-center gap-1 ${
          activeTab === 'values' 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Search className="w-3 h-3" />
        值
      </button>
      <button
        onClick={() => setActiveTab('selected')}
        className={`flex-1 py-2 text-[10px] font-medium flex items-center justify-center gap-1 relative ${
          activeTab === 'selected' 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Filter className="w-3 h-3" />
        已选
        {filters.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {filters.length}
          </span>
        )}
      </button>
    </div>
  );

  // 移动端内容区域 - 更紧凑
  const renderMobileContent = () => {
    switch (activeTab) {
      case 'fields':
        return (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-2 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1.5 text-gray-400" />
                <input 
                  placeholder="搜索字段..."
                  className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {fields.map(field => (
                <button
                  key={field.key}
                  onClick={() => {
                    setSelectedFieldKey(field.key);
                    setValueSearch('');
                    setActiveTab('values');
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all mb-0.5 ${
                    selectedFieldKey === field.key 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getFieldIcon(field.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{field.label}</div>
                    <div className="text-[10px] text-gray-400">
                      {getFieldTypeText(field.type)}
                    </div>
                  </div>
                  {selectedFieldKey === field.key && (
                    <Check className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
        
      case 'values':
        return (
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-2 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setActiveTab('fields')}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span className="text-[10px]">返回</span>
                </button>
                <div className="text-[10px] font-medium text-gray-600 truncate max-w-[50%]">
                  {activeField?.label || '选择值'}
                </div>
                <div className="w-10"></div>
              </div>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1.5 text-gray-400" />
                <input 
                  value={valueSearch}
                  onChange={e => setValueSearch(e.target.value)}
                  placeholder={`搜索 ${activeField?.label}...`}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {fieldValues.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  {valueSearch ? '未找到匹配的值' : '暂无数据'}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {fieldValues.map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        handleValueClick(val);
                        setActiveTab('selected');
                      }}
                      className="w-full text-left px-2 py-1.5 bg-white hover:bg-blue-50 transition-colors rounded"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-800 truncate">{val}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'selected':
        return (
          <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
            <div className="p-2 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  已选过滤器 ({filters.length})
                </div>
                {filters.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    清空
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filters.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4">
                  <div className="text-center">
                    <Filter className="w-8 h-8 opacity-20 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 mb-1">暂无过滤器</p>
                    <p className="text-[10px] text-gray-400">
                      选择字段和值来添加过滤器
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filters.map(filter => {
                    const field = fields.find(f => f.key === filter.fieldKey);
                    return (
                      <div key={filter.id} className="bg-white border border-gray-200 rounded p-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-6 h-6 bg-gray-50 rounded border border-gray-100 flex items-center justify-center mt-0.5">
                              {getFieldIcon(field?.type || 'text')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">
                                {field?.label}
                              </div>
                              <div className="text-xs font-semibold text-gray-900 truncate">
                                {filter.value}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => onRemoveFilter(filter.id)}
                            className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {filters.length > 0 && (
              <div className="p-2 border-t border-gray-200 bg-white">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    共 <span className="font-bold text-blue-600">{filters.length}</span> 个过滤器
                  </span>
                  <button
                    onClick={onClearAll}
                    className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium transition-colors"
                  >
                    清除全部
                  </button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  // 桌面端布局
  const getLayoutClass = () => {
    if (isMobileLayout) {
      return 'flex-col';
    }
    return 'flex-row divide-x divide-gray-100';
  };

  const getColumnWidthClass = (column: 'fields' | 'values' | 'selected') => {
    if (isMobileLayout) {
      return 'w-full';
    }
    
    switch (column) {
      case 'fields': return 'w-1/4 md:w-1/4';
      case 'values': return 'w-1/3 md:w-1/3';
      case 'selected': return 'flex-1';
      default: return '';
    }
  };

  // --- Render 1: Inline Chips Summary ---
  const renderInlineSummary = () => {
    if (filters.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1 mb-3 px-1 animate-in fade-in slide-in-from-top-1">
        {filters.map(filter => {
          const field = fields.find(f => f.key === filter.fieldKey);
          return (
            <div key={filter.id} className="inline-flex items-center bg-white border border-gray-200 rounded-full shadow-sm py-0.5 px-2 text-xs">
              <span className="font-bold text-gray-500 mr-1 uppercase text-[10px]">{field?.label || filter.fieldKey}:</span>
              <span className="font-medium text-gray-900 mr-1.5">{filter.value}</span>
              <button onClick={() => onRemoveFilter(filter.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
        <button onClick={onClearAll} className="text-[10px] text-gray-400 hover:text-red-500 hover:underline transition-colors">
          清空
        </button>
      </div>
    );
  };

  // 尺寸控制按钮
  const renderSizeControls = () => {
    if (isMobileLayout) return null;
    
    return (
      <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1 bg-white">
        <button
          onClick={() => setPanelSize('mobile')}
          className={`p-1.5 rounded ${panelSize === 'mobile' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Mobile Size"
        >
          <Smartphone className="w-3 h-3" />
        </button>
        <button
          onClick={() => setPanelSize('tablet')}
          className={`p-1.5 rounded ${panelSize === 'tablet' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Tablet Size"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="2" width="16" height="20" rx="2" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          onClick={() => setPanelSize('desktop')}
          className={`p-1.5 rounded ${panelSize === 'desktop' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Desktop Size"
        >
          <Monitor className="w-3 h-3" />
        </button>
        <button
          onClick={() => setPanelSize('fullscreen')}
          className={`p-1.5 rounded ${panelSize === 'fullscreen' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Fullscreen"
        >
          {panelSize === 'fullscreen' ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
        </button>
      </div>
    );
  };

  // 桌面端三列布局
  const renderDesktopPanel = () => (
    <div className={`flex-1 flex min-h-0 ${getLayoutClass()}`}>
      {/* Col 1: Fields */}
      <div className={`${getColumnWidthClass('fields')} bg-gray-50/30 flex flex-col`}>
        <div className="p-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
          1. 选择字段
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {fields.map(field => (
            <button
              key={field.key}
              onClick={() => { setSelectedFieldKey(field.key); setValueSearch(''); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs font-medium ${
                selectedFieldKey === field.key 
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' 
                : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {getFieldIcon(field.type)}
              {field.label}
              {selectedFieldKey === field.key && <ArrowRight className="w-3 h-3 ml-auto text-blue-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Col 2: Values (Source) */}
      <div className={`${getColumnWidthClass('values')} flex flex-col bg-white`}>
        <div className="p-2 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            2. 拖拽值
          </div>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-gray-400" />
            <input 
              value={valueSearch}
              onChange={e => setValueSearch(e.target.value)}
              placeholder={`搜索 ${activeField?.label}...`}
              className="w-full bg-white border border-gray-200 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {fieldValues.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs italic">
              未找到值
            </div>
          ) : (
            <div className="space-y-1">
              {fieldValues.map(val => (
                <div
                  key={val}
                  draggable
                  onDragStart={(e) => handleDragStart(e, val)}
                  onClick={() => handleValueClick(val)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-100 rounded bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group"
                >
                  <GripVertical className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                  <span className="text-xs text-gray-700 font-medium flex-1">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Col 3: Selected (Target) */}
      <div 
        className={`${getColumnWidthClass('selected')} flex flex-col bg-slate-50/50`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="p-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50">
          3. 已选过滤器 (拖放到这里)
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {filters.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <Filter className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-xs">拖拽项目到这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filters.map(filter => {
                const field = fields.find(f => f.key === filter.fieldKey);
                return (
                  <div key={filter.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-8 h-8 bg-gray-50 rounded border border-gray-100 text-gray-400">
                        {getFieldIcon(field?.type || 'text')}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase block leading-none mb-1">{field?.label}</span>
                        <span className="text-sm font-semibold text-gray-800 block leading-none">{filter.value}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemoveFilter(filter.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {filters.length > 0 && (
          <div className="p-2 border-t border-gray-100 bg-white flex justify-center">
            <button onClick={onClearAll} className="text-xs text-red-500 hover:underline">清除全部</button>
          </div>
        )}
      </div>
    </div>
  );

  // --- Render 2: Panel ---
  const renderPanel = () => {
    if (!isOpen) return null;

    return (
      <>
        <div className="fixed inset-0 z-[140] bg-black/20" onClick={onClose} />
        
        <div className={`fixed z-[150] bg-white shadow-lg border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans ${getPanelSizeClass()}`}>
            
          {/* Header - 更紧凑 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
            <h3 className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>过滤器</span>
              {isMobileLayout && filters.length > 0 && (
                <span className="text-xs font-normal text-gray-500">({filters.length})</span>
              )}
            </h3>
            <div className="flex items-center gap-1.5">
              {renderSizeControls()}
              <Button 
                size="sm" 
                onClick={onClose} 
                className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                完成
              </Button>
            </div>
          </div>

          {/* Mobile Tabs */}
          {isMobileLayout && renderMobileTabs()}

          {/* Content */}
          <div className="flex-1 flex min-h-0">
            {isMobileLayout ? renderMobileContent() : renderDesktopPanel()}
          </div>
        </div>
      </>
    );
  };

  return (
    <>
      {renderInlineSummary()}
      {renderPanel()}
    </>
  );
};