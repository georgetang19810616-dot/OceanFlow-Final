import React, { useState, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Quotation } from '../types';
import { Button } from './Button';
// 导入正确的日期工具函数
import { getWeekLabel, formatDateForInput, parseDateWithoutTimezone } from '../utils/dateUtils';
import { parseCSV, processImportedQuotations } from '../utils/importUtils';
import html2canvas from 'html2canvas';
import { 
  Plus, Search, Edit2, Trash2, X, Check, Save,
  DollarSign, FolderPlus, CalendarDays, Pencil, Camera, Loader2,
  ChevronDown, ChevronRight, Eye, EyeOff, GripHorizontal,
  Upload, Download
} from 'lucide-react';

interface QuotationPanelProps {
  quotations: Quotation[];
  onAdd: (q: Quotation) => void;
  onUpdate: (q: Quotation) => void;
  onDelete: (id: string | string[]) => void;
  carriers: string[];
  pols: string[];
  pods: string[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  
  // 从 App.tsx 传递的 props
  searchTerm: string;
  onSearchChange: (term: string) => void;
  visibleColumns: {
    price20: boolean;
    price40: boolean;
    price40hq: boolean;
    price45: boolean;
    price40nor: boolean;
    remarks: boolean;
  };
  onToggleColumn: (key: 'price20' | 'price40' | 'price40hq' | 'price45' | 'price40nor' | 'remarks') => void;
}

export interface QuotationPanelRef {
  handleScreenshot: () => Promise<void>;
  handleCreateRegion: () => void;
  handleQuickAdd: () => void;
  handleImport: () => void;
  handleExport: () => void;
}

interface RegionGroupData {
  data: Quotation[];
  spans: Record<string, number[]>;
}

// 使用 dateUtils 中的函数替代重复定义的 getDateFromWeek
const getDateFromWeek = (weekLabel: string): string => {
  if (!weekLabel || !weekLabel.includes('WK')) {
    // 使用当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  try {
    // 解析年份和周数
    const weekParts = weekLabel.split(' WK');
    let year: number, weekNum: number;
    
    if (weekParts.length === 2) {
      // 格式: '2025 WK49'
      year = parseInt(weekParts[0], 10);
      weekNum = parseInt(weekParts[1], 10);
    } else {
      // 格式: 'WK49'
      year = new Date().getFullYear();
      weekNum = parseInt(weekLabel.replace('WK', ''), 10);
    }
    
    if (isNaN(weekNum)) {
      // 返回当前日期
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // 计算该年第一天的日期
    const firstDayOfYear = new Date(year, 0, 1);
    // 计算第一周的周四
    const firstThursday = new Date(year, 0, 4);
    // 调整到第一周的周一
    const firstMonday = new Date(firstThursday);
    firstMonday.setDate(firstThursday.getDate() - 3);
    
    // 计算目标周的周一
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    
    // 计算目标周的周五
    const targetFriday = new Date(targetMonday);
    targetFriday.setDate(targetMonday.getDate() + 4);
    
    // 使用 formatDateForInput 统一格式化
    return formatDateForInput(targetFriday.toISOString());
  } catch (error) {
    console.warn('从周标签解析日期错误:', error);
    // 返回当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

// 修复 safeDate 函数，使用 dateUtils 中的函数
const safeDate = (dateStr?: string) => {
    if(!dateStr) return '';
    const str = String(dateStr);
    
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    
    // 使用 parseDateWithoutTimezone 解析日期，避免时区问题
    const date = parseDateWithoutTimezone(str);
    if (!date) return str;
    
    // 格式化为 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

const MultiValueCell = ({ value, align = 'left' }: { value: string, align?: 'left'|'center' }) => {
  if (!value) return null;
  if (!value.match(/[\/,]/)) return <span className={`font-medium text-text-200 block whitespace-normal leading-tight text-${align}`}>{value}</span>;

  const parts = value.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
  return (
    <div className={`flex flex-wrap gap-1 my-0.5 ${align === 'center' ? 'justify-center' : ''}`}>
      {parts.map((part, i) => (
        <span key={i} className="inline-block px-1.5 py-0.5 bg-bg-200 border border-bg-300 rounded text-[10px] text-text-200 font-medium whitespace-nowrap leading-tight">
          {part}
        </span>
      ))}
    </div>
  );
};

interface MultiSelectEditorProps {
  value: string;
  onChange: (val: string) => void;
  options?: string[];
  placeholder?: string;
  transformLabel?: (val: string) => string;
}

const MultiSelectEditor: React.FC<MultiSelectEditorProps> = ({ 
  value, onChange, options = [], placeholder, transformLabel 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top?: number, bottom?: number, left: number, width: number }>({ left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo(() => value ? value.split('/').map(s => s.trim()).filter(Boolean) : [], [value]);

  const filteredOptions = useMemo(() => {
    if (!options.length) return [];
    return options.filter(opt => 
      !selectedItems.includes(opt) && 
      opt.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [options, selectedItems, inputValue]);

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      
      if (spaceBelow < 220) {
          setDropdownPos({
              bottom: windowHeight - rect.top + 4,
              left: rect.left,
              width: Math.max(rect.width, 150)
          });
      } else {
          setDropdownPos({
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 150)
          });
      }
    }
  };

  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true); 
    }
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [showDropdown]);

  const addItem = (item: string) => {
    const finalItem = transformLabel ? transformLabel(item) : item;
    const newItems = [...selectedItems, finalItem];
    onChange(newItems.join('/'));
    setInputValue('');
    setShowDropdown(false); 
    setTimeout(() => containerRef.current?.querySelector('input')?.focus(), 10);
  };

  const removeItem = (index: number) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    onChange(newItems.join('/'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addItem(inputValue.trim());
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedItems.length > 0) {
      removeItem(selectedItems.length - 1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="w-full min-h-[24px] bg-bg-100 border-b border-accent-200 flex flex-wrap items-center gap-1 p-0.5 cursor-text text-xs"
        onClick={() => {
            containerRef.current?.querySelector('input')?.focus();
            setShowDropdown(true);
        }}
      >
        {selectedItems.map((item, idx) => (
          <span key={idx} className="bg-accent-100 text-accent-200 border border-bg-300 px-1 rounded text-[10px] flex items-center gap-0.5 whitespace-nowrap leading-relaxed">
            {item}
            <button 
                type="button"
                className="hover:bg-accent-100 rounded-full p-0.5 text-accent-200 hover:text-text-100"
                onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
            >
                <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input 
          value={inputValue}
          onChange={e => {
              setInputValue(e.target.value);
              setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)} 
          placeholder={selectedItems.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[30px] outline-none text-xs bg-transparent leading-relaxed py-0"
        />
      </div>

      {showDropdown && (filteredOptions.length > 0 || (options.length === 0 && inputValue)) && (
        <div 
            className="fixed z-[9999] bg-bg-100 border border-bg-300 rounded-lg shadow-xl max-h-48 overflow-y-auto text-[11px] animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                top: dropdownPos.top,
                bottom: dropdownPos.bottom, 
                left: dropdownPos.left, 
                width: dropdownPos.width
            }}
        >
            {filteredOptions.map(opt => (
                <div 
                    key={opt}
                    onMouseDown={(e) => { e.preventDefault(); addItem(opt); }} 
                    className="px-3 py-1.5 hover:bg-accent-100 cursor-pointer text-text-200 border-b border-bg-300 last:border-0"
                >
                    {opt}
                </div>
            ))}
            {options.length === 0 && inputValue && (
                 <div 
                    onMouseDown={(e) => { e.preventDefault(); addItem(inputValue); }}
                    className="px-3 py-1.5 hover:bg-accent-100 cursor-pointer text-accent-200 font-medium border-t border-bg-300"
                 >
                    Add "{inputValue}"
                 </div>
            )}
        </div>
      )}
    </>
  );
};


export const QuotationPanel = forwardRef<QuotationPanelRef, QuotationPanelProps>(({ 
  quotations, onAdd, onUpdate, onDelete, carriers, pols, pods, canCreate, canUpdate, canDelete,
  // 从 App.tsx 传递的 props
  searchTerm, onSearchChange,
  visibleColumns, onToggleColumn
}, ref) => {
  // 内部状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Quotation>>({});
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const staticColumnCount = 11;
  const dynamicColumnCount = Object.values(visibleColumns).filter(Boolean).length;
  const totalTableColumns = staticColumnCount + dynamicColumnCount;
  
  const [activeRegions, setActiveRegions] = useState<string[]>(() => {
      const dataRegions = Array.from(new Set(quotations.map(q => q.region).filter(Boolean)));
      return dataRegions.sort();
  });
  const [renamingRegion, setRenamingRegion] = useState<string | null>(null);
  const [newRegionName, setNewRegionName] = useState('');
  useEffect(() => {
      const dataRegions = Array.from(new Set(quotations.map(q => q.region).filter(Boolean)));
      setActiveRegions(prev => {
          const combined = new Set([...prev, ...dataRegions]);
          return Array.from(combined).sort();
      });
  }, [quotations]);
  const [targetContext, setTargetContext] = useState<{ week: string, region: string } | null>(null);
  const initialNewData = {
    pol: '', pod: '', carrier: '', vessel: '', etd: '',
    price20: '', price40: '', price40hq: '', price40nor: '', price45: '',
    transitTime: '', validity: '', cutSi: '', remarks: '', 
    freetime: '', availableFfe: ''
  };
  const [newQuoteData, setNewQuoteData] = useState(initialNewData);
  const creationRowRef = useRef<HTMLTableRowElement>(null);

  // Grouping logic
  const groupedData = useMemo(() => {
    const filtered = quotations.filter(q => Object.values(q).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
    const hierarchy: Record<string, Record<string, Quotation[]>> = {};
    const allWeeks = new Set<string>();
    if (targetContext) allWeeks.add(targetContext.week);
    filtered.forEach(q => {
        const week = getWeekLabel(q.etd) || 'WK--';
        const region = q.region || 'Uncategorized';
        allWeeks.add(week);
        if (!hierarchy[week]) hierarchy[week] = {};
        if (!hierarchy[week][region]) hierarchy[week][region] = [];
        hierarchy[week][region].push(q);
    });
    const sortedWeeks = Array.from(allWeeks).sort((a, b) => {
        const numA = parseInt(a.replace('WK', '') || '0', 10);
        const numB = parseInt(b.replace('WK', '') || '0', 10);
        return numA - numB;
    });
    const result: Record<string, Record<string, RegionGroupData>> = {};
    sortedWeeks.forEach((week: string) => {
        result[week] = {};
        const regionsToRender = new Set(activeRegions);
        if (targetContext) regionsToRender.add(targetContext.region);
        regionsToRender.forEach((region: string) => {
            const rawData = hierarchy[week]?.[region] || [];
            const data = rawData.sort((a, b) => {
                if (a.carrier !== b.carrier) return a.carrier.localeCompare(b.carrier);
                if (a.etd !== b.etd) return a.etd > b.etd ? 1 : -1;
                if (a.vessel !== b.vessel) return a.vessel.localeCompare(b.vessel);
                return a.pod.localeCompare(b.pod);
            });
            const spans: Record<string, number[]> = { carrier: [], pod: [], vessel: [], freetime: [], availableFfe: [], validity: [], remarks: [] };
            if (data.length > 0) {
                Object.keys(spans).forEach(key => { spans[key] = new Array(data.length).fill(1); });
                const calcSpan = (field: string, extraCheck?: (a:Quotation, b:Quotation)=>boolean) => {
                    let cursor = 0;
                    while (cursor < data.length) {
                        let count = 1;
                        while (cursor + count < data.length && String(data[cursor+count][field as keyof Quotation] || '') === String(data[cursor][field as keyof Quotation] || '') && (extraCheck ? extraCheck(data[cursor], data[cursor+count]) : true)) { count++; }
                        spans[field][cursor] = count;
                        for (let i = 1; i < count; i++) spans[field][cursor+i] = 0;
                        cursor += count;
                    }
                };
                calcSpan('carrier');
                calcSpan('pod');
                calcSpan('vessel', (a,b) => a.carrier===b.carrier && a.pol===b.pol && a.etd===b.etd);
                const infoCheck = (a:Quotation, b:Quotation) => a.carrier===b.carrier && ((a.pol===b.pol && a.vessel===b.vessel) || a.pod===b.pod);
                calcSpan('freetime', infoCheck);
                calcSpan('availableFfe', infoCheck);
                calcSpan('validity', (a,b) => a.vessel===b.vessel);
                calcSpan('remarks', (a,b) => a.vessel===b.vessel);
            }
            result[week][region] = { data, spans };
        });
    });
    return result;
  }, [quotations, searchTerm, activeRegions, targetContext]);

  const toggleWeek = (week: string) => {
    const newSet = new Set(collapsedWeeks);
    if (newSet.has(week)) newSet.delete(week); else newSet.add(week);
    setCollapsedWeeks(newSet);
  };
  
  const handleStartAdd = (week: string, region: string) => {
    if (!canCreate) return;
    setActiveRegions(prev => { if (!prev.includes(region)) return [...prev, region].sort(); return prev; });
    setTargetContext({ week, region });
    const estimatedDate = getDateFromWeek(week);
    setNewQuoteData({ ...initialNewData, etd: estimatedDate });
    setTimeout(() => { creationRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); const firstInput = creationRowRef.current?.querySelector('input'); firstInput?.focus(); }, 100);
  };
  
  const handleStartRenameRegion = (region: string, e: React.MouseEvent) => { e.stopPropagation(); if (!canUpdate) return; setRenamingRegion(region); setNewRegionName(region); };
  
  const handleSaveRenameRegion = () => { if (renamingRegion && newRegionName.trim() && newRegionName !== renamingRegion) { quotations.filter(q => q.region === renamingRegion).forEach(q => { onUpdate({ ...q, region: newRegionName }); }); setActiveRegions(prev => prev.map(r => r === renamingRegion ? newRegionName : r).sort()); if (targetContext?.region === renamingRegion) { setTargetContext(prev => prev ? ({ ...prev, region: newRegionName }) : null); } } setRenamingRegion(null); };
  
  const handleSaveNew = () => { 
  if (targetContext && (newQuoteData.pol || newQuoteData.pod)) { 
    const newQuotation: Quotation = {
      id: Date.now().toString(),
      region: targetContext.region,
      carrier: newQuoteData.carrier || '',
      pol: newQuoteData.pol || '',
      pod: newQuoteData.pod || '',
      vessel: newQuoteData.vessel || '',
      etd: newQuoteData.etd || '',
      price20: newQuoteData.price20 || '',
      price40: newQuoteData.price40 || '',
      price40hq: newQuoteData.price40hq || '',
      price40nor: newQuoteData.price40nor || '',
      price45: newQuoteData.price45 || '',
      transitTime: newQuoteData.transitTime || '',
      validity: newQuoteData.validity || '',
      cutSi: newQuoteData.cutSi || '',
      remarks: newQuoteData.remarks || '',
      freetime: newQuoteData.freetime || '',
      availableFfe: newQuoteData.availableFfe || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    onAdd(newQuotation); 
    setNewQuoteData(initialNewData); 
    setTargetContext(null); 
  } else { 
    alert("At least one Port is required."); 
  } 
};
  
  const handleCancelNew = () => { setTargetContext(null); setNewQuoteData(initialNewData); };
  
  const handleStartEdit = (q: Quotation) => { 
  if (!canUpdate) return; 
  setEditingId(q.id); 
  setEditFormData({ 
    id: q.id,
    region: q.region,
    carrier: q.carrier,
    pol: q.pol,
    pod: q.pod,
    vessel: q.vessel,
    etd: q.etd,
    price20: q.price20,
    price40: q.price40,
    price40hq: q.price40hq,
    price40nor: q.price40nor,
    price45: q.price45,
    transitTime: q.transitTime,
    validity: q.validity,
    cutSi: q.cutSi,
    remarks: q.remarks,
    freetime: q.freetime,
    availableFfe: q.availableFfe,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt
  }); 
};
  
  const handleCancelEdit = () => { setEditingId(null); setEditFormData({}); };
  
  const handleSaveEdit = () => { if (editingId && editFormData) { onUpdate(editFormData as Quotation); setEditingId(null); } };
  
  const handleKeyDown = (e: React.KeyboardEvent, action: 'saveNew' | 'saveEdit') => { if (e.key === 'Enter') { action === 'saveNew' ? handleSaveNew() : handleSaveEdit(); } };
  
  // 截图函数
  const handleScreenshot = async () => { 
    if (!scrollContainerRef.current || !tableRef.current) return; 
    
    try { 
        await new Promise(resolve => setTimeout(resolve, 150)); 
        
        const originalTable = tableRef.current; 
        const originalRect = originalTable.getBoundingClientRect();
        
        const container = document.createElement('div'); 
        container.style.position = 'absolute'; 
        container.style.top = '0'; 
        container.style.left = '0'; 
        container.style.width = `${originalTable.scrollWidth}px`; 
        container.style.height = `${originalTable.scrollHeight}px`; 
        container.style.background = '#ffffff'; 
        container.style.padding = '0'; 
        container.style.margin = '0'; 
        container.style.zIndex = '99999'; 
        container.style.visibility = 'hidden';
        container.style.overflow = 'visible'; 
        container.id = 'screenshot-container';
        
        const clonedTable = originalTable.cloneNode(true) as HTMLElement; 
        
        const classesToRemove = ['sticky', 'top-0', 'left-0', 'no-print'];
        clonedTable.querySelectorAll('*').forEach(element => {
            const el = element as HTMLElement;
            
            classesToRemove.forEach(cls => {
                el.classList.remove(cls);
            });
            
            if (el.style.position === 'sticky') {
                el.style.position = 'static';
            }
            
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.display = '';
            el.style.transform = '';
            el.style.transition = 'none';
            el.style.animation = 'none';
        });
        
        clonedTable.style.width = 'auto';
        clonedTable.style.minWidth = '100%';
        clonedTable.style.tableLayout = 'auto';
        clonedTable.style.borderCollapse = 'collapse';
        
        const allCells = clonedTable.querySelectorAll('td, th');
        allCells.forEach(cell => {
            const c = cell as HTMLElement;
            c.style.visibility = 'visible';
            c.style.opacity = '1';
            c.style.overflow = 'visible';
            c.style.textOverflow = 'clip';
            c.style.whiteSpace = 'normal';
            c.style.maxWidth = 'none';
        });
        
        const allTextElements = clonedTable.querySelectorAll('span, div, p, input, button');
        allTextElements.forEach(el => {
            const elem = el as HTMLElement;
            elem.style.visibility = 'visible';
            elem.style.opacity = '1';
            elem.style.color = '';
        });
        
        const actionButtons = clonedTable.querySelectorAll('.no-print, [class*="opacity-0"]');
        actionButtons.forEach(btn => {
            (btn as HTMLElement).style.display = 'none';
        });
        
        clonedTable.classList.forEach(cls => {
            if (cls.includes('scroll') || cls.includes('overflow')) {
                clonedTable.classList.remove(cls);
            }
        });
        
        container.appendChild(clonedTable); 
        document.body.appendChild(container); 
        
        container.style.visibility = 'visible';
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const finalWidth = clonedTable.scrollWidth;
        const finalHeight = clonedTable.scrollHeight;
        
        container.style.width = `${finalWidth}px`;
        container.style.height = `${finalHeight}px`;
        
        const canvas = await html2canvas(clonedTable, { 
            scale: 2,
            useCORS: true, 
            backgroundColor: '#ffffff', 
            ignoreElements: (element: Element) => {
                return false;
            },
            width: finalWidth,
            height: finalHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            logging: false,
            removeContainer: true,
            onclone: (clonedDocument, element) => {
                const clonedTableElement = element as HTMLElement;
                
                clonedTableElement.style.display = 'table';
                clonedTableElement.style.visibility = 'visible';
                
                const allElements = clonedDocument.querySelectorAll('*');
                allElements.forEach(el => {
                    const elem = el as HTMLElement;
                    elem.style.boxShadow = 'none';
                    elem.style.filter = 'none';
                    elem.style.backdropFilter = 'none';
                    elem.style.transform = 'none';
                    elem.style.transition = 'none';
                    elem.style.animation = 'none';
                    
                    const computedStyle = window.getComputedStyle(elem);
                    if (computedStyle.color === 'transparent' || 
                        computedStyle.opacity === '0' || 
                        computedStyle.visibility === 'hidden' ||
                        computedStyle.display === 'none') {
                        elem.style.color = '#000000';
                        elem.style.opacity = '1';
                        elem.style.visibility = 'visible';
                        elem.style.display = '';
                    }
                });
            }
        }); 
        
        document.body.removeChild(container); 
        
        const image = canvas.toDataURL("image/png", 1.0); 
        const link = document.createElement("a"); 
        const dateStr = new Date().toISOString().split('T')[0]; 
        link.href = image; 
        link.download = `Freight_Schedule_${dateStr}.png`; 
        
        document.body.appendChild(link); 
        link.click(); 
        document.body.removeChild(link);
        
    } catch (err) { 
        console.error("Screenshot error details:", err); 
        alert("Failed to create screenshot. Please try again or check console for details."); 
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if(!file) return; 
    const reader = new FileReader(); 
    reader.onload = (event) => { 
      try { 
        const text = event.target?.result as string; 
        const rawRows = parseCSV(text); 
        const importedQuotes = processImportedQuotations(rawRows); 
        if(importedQuotes.length > 0) { 
          if(window.confirm(`Found ${importedQuotes.length} quotations. Append them?`)) { 
            importedQuotes.forEach(q => onAdd(q)); 
          } 
        } else { 
          alert("No valid quotation data found."); 
        } 
      } catch(err) { 
        console.error(err); 
        alert("Failed to parse file."); 
      } 
      if(fileInputRef.current) fileInputRef.current.value = ''; 
    }; 
    reader.readAsText(file); 
  };

  // 导出函数
  const handleExport = () => {
    // 导出报价数据的逻辑
    const headers = ['Region', 'Carrier', 'POL', 'POD', 'Vessel', 'ETD', 'SI', 'T/T', '20GP', '40GP', '40HQ', '45HQ', '40NOR', 'Freetime', 'Available FFEs', 'Validity', 'Remarks'];
    const rows = quotations.map(q => [
        q.region, q.carrier, q.pol, q.pod, q.vessel, q.etd, q.cutSi, q.transitTime,
        q.price20, q.price40, q.price40hq, q.price45, q.price40nor,
        q.freetime, q.availableFfe, q.validity, q.remarks
    ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
    
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Quotations_Export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 新建区域函数
  const handleCreateRegion = () => {
    if (!canCreate) return;
    const name = prompt("Enter new Region / Group Name:");
    if (name && name.trim()) {
      const regionName = name.trim();
      setActiveRegions(prev => [...prev, regionName].sort());
      alert(`区域 "${regionName}" 已创建。现在您可以开始添加报价到该区域。`);
    }
  };

  // 快速添加函数
  const handleQuickAdd = () => {
    if (!canCreate) return;
    const currentWeek = getWeekLabel(new Date().toISOString());
    const activeRegionsList = Array.from(new Set(quotations.map(q => q.region).filter(Boolean))).sort();
    const firstRegion = activeRegionsList[0] || 'General';
    
    // 设置目标上下文以进行快速添加
    setTargetContext({ week: currentWeek, region: firstRegion });
    const estimatedDate = getDateFromWeek(currentWeek);
    setNewQuoteData({ ...initialNewData, etd: estimatedDate });
    
    // 滚动到添加行
    setTimeout(() => {
      creationRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = creationRowRef.current?.querySelector('input');
      firstInput?.focus();
    }, 100);
  };

  // 导入函数
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  // 使用 useImperativeHandle 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    handleScreenshot,
    handleExport,
    handleCreateRegion,
    handleQuickAdd,
    handleImport
  }));

  const appendDays = (val: string) => { if (val && /^\d+$/.test(val)) return `${val} Days`; return val; };
  
  const renderInputCell = (value: string, onChange: (val: string) => void, placeholder: string = '', list?: string, action: 'saveNew' | 'saveEdit' = 'saveEdit', className: string = '', optionsForMulti?: string[], isMulti: boolean = false, transform?: (v: string) => string) => { 
    if (isMulti) { 
      return ( 
        <MultiSelectEditor 
          value={value} 
          onChange={onChange} 
          options={optionsForMulti} 
          placeholder={placeholder} 
          transformLabel={transform} 
        /> 
      ); 
    } 
    return ( 
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        onKeyDown={(e) => handleKeyDown(e, action)} 
        placeholder={placeholder} 
        list={list} 
        className={`w-full bg-transparent border-b border-transparent focus:border-accent-200 focus:bg-accent-100 outline-none py-0.5 px-0.5 transition-colors ${className.includes('text-') ? '' : 'text-xs'} ${className}`} 
      /> 
    ); 
  };
  
  const ColumnHeaderRow = () => (
    <tr className="text-[10px] font-bold text-text-200 uppercase tracking-wider bg-bg-100 border-y-2 border-bg-300">
        <td className="py-1 px-2 border-r border-bg-300 text-center w-[80px] sticky left-0 bg-bg-100 z-10">Carrier</td>
        <td className="py-1 px-2 pl-4 border-r border-bg-300 w-[110px]">POL</td>
        <td className="py-1 px-2 border-r border-bg-300 w-[110px]">POD</td>
        <td className="py-1 px-2 border-r border-bg-300 w-[190px]">Vessel</td>
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[85px]">ETD</td>
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[85px]">SI</td>
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[45px]">T/T</td>
        {visibleColumns.price20 && <td className="py-1 px-2 text-center border-r border-bg-300 w-[50px]">20GP</td>}
        {visibleColumns.price40 && <td className="py-1 px-2 text-center border-r border-bg-300 w-[50px]">40GP</td>}
        {visibleColumns.price40hq && <td className="py-1 px-2 text-center border-r border-bg-300 w-[50px]">40HQ</td>}
        {visibleColumns.price45 && <td className="py-1 px-2 text-center border-r border-bg-300 w-[50px]">45HQ</td>}
        {visibleColumns.price40nor && <td className="py-1 px-2 text-center border-r border-bg-300 w-[50px]">40NOR</td>}
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[65px]">Freetime</td>
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[100px]">Available FFEs</td>
        <td className="py-1 px-2 text-center border-r border-bg-300 w-[85px]">Validity</td>
        {visibleColumns.remarks && <td className="py-1 px-2 pl-3 border-r border-bg-300 w-[160px]">Remarks</td>}
        <td className="py-1 px-2 text-center pr-1 no-print w-[50px] border-r border-bg-300">Action</td>
    </tr>
  );

  return (
    <div className="flex flex-col h-full bg-bg-200 p-4">
      <datalist id="carrier-list">{carriers.map(c => <option key={c} value={c} />)}</datalist>
      <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileChange} />

      {/* 顶部标题行，包含标题和搜索框 */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-text-100">
             Freight Quotations
           </h2>
           <p className="text-text-200 mt-1 text-sm">Manage rates by Week & Region.</p>
        </div>
        
        {/* 搜索框放在标题右侧 */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-200" />
          <input 
            type="text" 
            placeholder="Search quotes..." 
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-bg-200 border border-bg-300 rounded-lg text-sm focus:ring-2 focus:ring-accent-200/20 focus:border-accent-200 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Available Columns Toggle - 修改为类似App.tsx顶部的样式 */}
      <div className="bg-gray-100 border border-gray-300 px-3 py-2 rounded-lg mb-4 flex items-center gap-4 text-xs overflow-x-auto shadow-sm">
        {/* 左侧：列切换标签 */}
        <div className="flex items-center gap-1 font-bold text-gray-700 uppercase tracking-wider flex-shrink-0">
          <GripHorizontal className="w-4 h-4" /> Toggle Columns
        </div>
        
        {/* 右侧：列切换按钮组 */}
        <div className="flex gap-2">
          {[
            { key: 'price20', label: '20GP' },
            { key: 'price40', label: '40GP' },
            { key: 'price40hq', label: '40HQ' },
            { key: 'price45', label: '45HQ' },
            { key: 'price40nor', label: '40NOR' },
            { key: 'remarks', label: 'Remarks' }
          ].map(col => {
            const isVisible = visibleColumns[col.key as keyof typeof visibleColumns];
            return (
              <button 
                key={col.key}
                onClick={() => onToggleColumn(col.key as keyof typeof visibleColumns)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border shadow-sm transition-all duration-200 font-medium
                     ${!isVisible 
                        ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600' 
                        : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md'
                     }`}
              >
                {isVisible ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3 text-gray-400"/>}
                {col.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-bg-100 border border-bg-300 rounded-xl shadow-sm ring-1 ring-black/5 custom-scrollbar relative">
          <table ref={tableRef} className="w-full text-left border-collapse table-fixed bg-bg-100">
            <colgroup>
                {/* 1. Carrier */} <col className="w-[80px]" />
                {/* 2. POL */} <col className="w-[110px]" />
                {/* 3. POD */} <col className="w-[110px]" />
                {/* 4. Vessel */} <col className="w-[190px]" />
                {/* 5. ETD */} <col className="w-[85px]" />
                {/* 6. SI */} <col className="w-[85px]" />
                {/* 7. TT */} <col className="w-[45px]" />
                {visibleColumns.price20 && <col className="w-[50px]" />}
                {visibleColumns.price40 && <col className="w-[50px]" />}
                {visibleColumns.price40hq && <col className="w-[50px]" />}
                {visibleColumns.price45 && <col className="w-[50px]" />}
                {visibleColumns.price40nor && <col className="w-[50px]" />}
                {/* 13. Freetime */} <col className="w-[65px]" />
                {/* 14. Available FFE */} <col className="w-[100px]" />
                {/* 15. Validity */} <col className="w-[85px]" />
                {/* 16. Remarks */} {visibleColumns.remarks && <col className="w-[160px]" />}
                {/* 17. Action */} <col className="w-[50px]" />
            </colgroup>

            <tbody>
              {Object.keys(groupedData).map(week => {
                const weekData = groupedData[week];
                const totalWeekRecords = (Object.values(weekData) as RegionGroupData[]).reduce((acc: number, r: RegionGroupData) => acc + r.data.length, 0);
                
                return (
                <React.Fragment key={week}>
                    {/* Level 1: Week Header (Dark Mode Style) */}
                    <tr 
                      className="bg-slate-900 text-white sticky top-0 z-30 print:bg-black shadow-md cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => toggleWeek(week)}
                    >
                        {/* Dynamic ColSpan based on visible columns */}
                        <td colSpan={totalTableColumns} className="px-4 py-2 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {collapsedWeeks.has(week) ? <ChevronRight className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    <CalendarDays className="w-5 h-5 text-blue-400" />
                                    <span className="text-base font-bold tracking-widest">{week}</span>
                                    <span className="text-xs text-slate-400 font-normal ml-2 opacity-80 border-l border-slate-600 pl-3">
                                        {totalWeekRecords} Records
                                    </span>
                                </div>
                                {canDelete && (
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const allIds: string[] = [];
                                            Object.values(weekData).forEach((r: RegionGroupData) => {
                                                r.data.forEach(q => {
                                                    if(q.id) allIds.push(q.id);
                                                });
                                            });
                                            if (allIds.length > 0) onDelete(allIds);
                                            else alert("No records to delete in this week.");
                                        }}
                                        className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-slate-800 no-print cursor-pointer relative z-20"
                                        title="Delete entire week"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>

                    {!collapsedWeeks.has(week) && Object.keys(weekData).map(region => {
                        const { data: quotes, spans } = weekData[region];
                        const isAddingHere = targetContext?.week === week && targetContext?.region === region;
                        const isRenaming = renamingRegion === region;
                        const isAnyEditing = quotes.some(q => q.id === editingId);
                        const applySpans = !isAnyEditing;

                        if (quotes.length === 0 && !isAddingHere) return null;

                        return (
                            <React.Fragment key={`${week}-${region}`}>
                                {/* Level 2: Region Header */}
                                <tr className="bg-gray-100 group">
                                    <td colSpan={totalTableColumns} className="px-4 py-2 border border-gray-300">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {isRenaming ? (
                                                    <div className="flex items-center gap-1">
                                                        <input 
                                                            value={newRegionName}
                                                            onChange={(e) => setNewRegionName(e.target.value)}
                                                            className="text-sm font-bold uppercase tracking-wide border border-blue-400 rounded px-2 py-0.5 outline-none bg-white text-blue-900"
                                                            autoFocus
                                                            onClick={e => e.stopPropagation()}
                                                            onKeyDown={(e) => {
                                                                if(e.key === 'Enter') handleSaveRenameRegion();
                                                                if(e.key === 'Escape') setRenamingRegion(null);
                                                            }}
                                                        />
                                                        <button onClick={handleSaveRenameRegion} className="p-0.5 text-green-600 hover:bg-green-100 rounded"><Check className="w-4 h-4"/></button>
                                                        <button onClick={() => setRenamingRegion(null)} className="p-0.5 text-red-500 hover:bg-red-100 rounded"><X className="w-4 h-4"/></button>
                                                    </div>
                                                ) : (
                                                    <span 
                                                        className={`text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2 ${canUpdate ? 'group-hover:underline cursor-pointer' : ''}`}
                                                        onClick={(e) => canUpdate && handleStartRenameRegion(region, e)}
                                                    >
                                                        {region}
                                                        {canUpdate && <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 text-blue-400" />}
                                                    </span>
                                                )}
                                            </div>
                                            {canCreate && (
                                                <button 
                                                    onClick={() => handleStartAdd(week, region)} 
                                                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-3 py-1 bg-white border border-blue-200 rounded text-[10px] font-medium text-blue-600 hover:bg-blue-100 transition-all shadow-sm no-print"
                                                >
                                                    <Plus className="w-3 h-3" /> Add Quote
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                <ColumnHeaderRow />

                                {isAddingHere && (
                                    <tr ref={creationRowRef} className="bg-emerald-50 border-b-2 border-emerald-500 shadow-inner animate-in fade-in text-xs">
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.carrier || '', v => setNewQuoteData({...newQuoteData, carrier: v}), 'Carrier', 'carrier-list', 'saveNew')}</td>
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.pol || '', v => setNewQuoteData({...newQuoteData, pol: v}), 'POL', undefined, 'saveNew', '', pols, true)}</td>
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.pod || '', v => setNewQuoteData({...newQuoteData, pod: v}), 'POD', undefined, 'saveNew', '', pods, true)}</td>
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.vessel || '', v => setNewQuoteData({...newQuoteData, vessel: v}), 'Vessel', undefined, 'saveNew')}</td>
                                        <td className="p-1 border-r border-gray-300"><input type="date" value={safeDate(newQuoteData.etd)} onChange={e => setNewQuoteData({...newQuoteData, etd: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                        <td className="p-1 border-r border-gray-300"><input type="date" value={safeDate(newQuoteData.cutSi)} onChange={e => setNewQuoteData({...newQuoteData, cutSi: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.transitTime || '', v => setNewQuoteData({...newQuoteData, transitTime: v}), 'Days', undefined, 'saveNew', 'text-center', [], true, appendDays)}</td>
                                        {visibleColumns.price20 && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.price20 || '', v => setNewQuoteData({...newQuoteData, price20: v}), '-', undefined, 'saveNew', 'text-center text-red-600 text-xs')}</td>}
                                        {visibleColumns.price40 && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.price40 || '', v => setNewQuoteData({...newQuoteData, price40: v}), '-', undefined, 'saveNew', 'text-center text-red-600 text-xs')}</td>}
                                        {visibleColumns.price40hq && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.price40hq || '', v => setNewQuoteData({...newQuoteData, price40hq: v}), '-', undefined, 'saveNew', 'text-center text-red-600 font-bold text-xs')}</td>}
                                        {visibleColumns.price45 && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.price45 || '', v => setNewQuoteData({...newQuoteData, price45: v}), '-', undefined, 'saveNew', 'text-center text-red-600 text-xs')}</td>}
                                        {visibleColumns.price40nor && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.price40nor || '', v => setNewQuoteData({...newQuoteData, price40nor: v}), '-', undefined, 'saveNew', 'text-center text-red-600 text-xs')}</td>}
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.freetime || '', v => setNewQuoteData({...newQuoteData, freetime: v}), '-', undefined, 'saveNew', 'text-center text-xs')}</td>
                                        <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.availableFfe || '', v => setNewQuoteData({...newQuoteData, availableFfe: v}), '-', undefined, 'saveNew', 'text-center text-xs')}</td>
                                        <td className="p-1 border-r border-gray-300"><input type="date" value={safeDate(newQuoteData.validity)} onChange={e => setNewQuoteData({...newQuoteData, validity: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                        {visibleColumns.remarks && <td className="p-1 border-r border-gray-300">{renderInputCell(newQuoteData.remarks || '', v => setNewQuoteData({...newQuoteData, remarks: v}), 'Remarks', undefined, 'saveNew', 'font-bold')}</td>}
                                        <td className="p-1 text-center no-print border-r border-gray-300">
                                            <div className="flex justify-center items-center gap-1">
                                                <button onClick={handleSaveNew} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"><Check className="w-4 h-4"/></button>
                                                <button onClick={handleCancelNew} className="p-1 text-red-500 hover:bg-red-100 rounded"><X className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {/* Data Rows */}
                                {quotes.map((q, index) => {
                                    const isEditing = editingId === q.id;
                                    const cellClass = "p-1 border-r border-b border-gray-300 px-2";
                                    const centerClass = "p-1 text-center border-r border-b border-gray-300 px-1";
                                    const carrierSpan = applySpans ? spans.carrier[index] : 1;
                                    const podSpan = applySpans ? spans.pod[index] : 1;
                                    const vesselSpan = applySpans ? spans.vessel[index] : 1;
                                    const freetimeSpan = applySpans ? spans.freetime[index] : 1;
                                    const ffeSpan = applySpans ? spans.availableFfe[index] : 1;
                                    const validitySpan = applySpans ? spans.validity[index] : 1;
                                    const remarksSpan = applySpans ? spans.remarks[index] : 1;

                                    if (isEditing) {
                                        return (
                                            <tr key={q.id} className="bg-blue-50/30 text-xs">
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.carrier || '', v => setEditFormData({...editFormData, carrier: v}), 'Carrier', 'carrier-list')}</td>
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.pol || '', v => setEditFormData({...editFormData, pol: v}), 'POL', undefined, 'saveEdit', '', pols, true)}</td>
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.pod || '', v => setEditFormData({...editFormData, pod: v}), 'POD', undefined, 'saveEdit', '', pods, true)}</td>
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.vessel || '', v => setEditFormData({...editFormData, vessel: v}), 'Vessel')}</td>
                                                <td className="p-1 border border-gray-300"><input type="date" value={safeDate(editFormData.etd)} onChange={e => setEditFormData({...editFormData, etd: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                                <td className="p-1 border border-gray-300"><input type="date" value={safeDate(editFormData.cutSi)} onChange={e => setEditFormData({...editFormData, cutSi: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.transitTime || '', v => setEditFormData({...editFormData, transitTime: v}), 'T/T', undefined, 'saveEdit', 'text-center', [], true, appendDays)}</td>
                                                
                                                {visibleColumns.price20 && <td className="p-1 border border-gray-300">{renderInputCell(editFormData.price20 || '', v => setEditFormData({...editFormData, price20: v}), '-', undefined, 'saveEdit', 'text-center font-mono text-red-600 text-xs')}</td>}
                                                {visibleColumns.price40 && <td className="p-1 border border-gray-300">{renderInputCell(editFormData.price40 || '', v => setEditFormData({...editFormData, price40: v}), '-', undefined, 'saveEdit', 'text-center font-mono text-red-600 text-xs')}</td>}
                                                {visibleColumns.price40hq && <td className="p-1 border border-gray-300">{renderInputCell(editFormData.price40hq || '', v => setEditFormData({...editFormData, price40hq: v}), '-', undefined, 'saveEdit', 'text-center font-mono text-red-600 font-bold text-xs')}</td>}
                                                {visibleColumns.price45 && <td className="p-1 border border-gray-300">{renderInputCell(editFormData.price45 || '', v => setEditFormData({...editFormData, price45: v}), '-', undefined, 'saveEdit', 'text-center font-mono text-red-600 text-xs')}</td>}
                                                {visibleColumns.price40nor && <td className="p-1 border border-gray-300">{renderInputCell(editFormData.price40nor || '', v => setEditFormData({...editFormData, price40nor: v}), '-', undefined, 'saveEdit', 'text-center font-mono text-red-600 text-xs')}</td>}
                                                
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.freetime || '', v => setEditFormData({...editFormData, freetime: v}), '-', undefined, 'saveEdit', 'text-center text-xs')}</td>
                                                <td className="p-1 border border-gray-300">{renderInputCell(editFormData.availableFfe || '', v => setEditFormData({...editFormData, availableFfe: v}), '-', undefined, 'saveEdit', 'text-center text-xs')}</td>

                                                <td className="p-1 border border-gray-300"><input type="date" value={safeDate(editFormData.validity)} onChange={e => setEditFormData({...editFormData, validity: e.target.value})} className="w-full bg-transparent text-xs outline-none text-center" /></td>
                                                {visibleColumns.remarks && <td className="p-1 pl-3 border border-gray-300">{renderInputCell(editFormData.remarks || '', v => setEditFormData({...editFormData, remarks: v}), 'Remarks', undefined, 'saveEdit', 'font-bold')}</td>}
                                                
                                                <td className="p-1 text-center border border-gray-300">
                                                    <div className="flex justify-center items-center gap-1">
                                                        <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-100 rounded"><Save className="w-3.5 h-3.5"/></button>
                                                        <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr key={q.id} className="hover:bg-gray-50/50 transition-colors text-xs text-gray-800 group/row leading-relaxed bg-white">
                                            {carrierSpan > 0 && (<td className={`${cellClass} font-bold text-gray-900 bg-white align-middle text-center`} rowSpan={carrierSpan}>{q.carrier}</td>)}
                                            <td className={cellClass}><MultiValueCell value={q.pol} /></td>
                                            {podSpan > 0 && (<td className={`${cellClass} align-middle text-left bg-white`} rowSpan={podSpan}><MultiValueCell value={q.pod} align="left" /></td>)}
                                            {vesselSpan > 0 && (<td className={`${cellClass} text-gray-600 whitespace-normal leading-tight max-w-[210px] align-middle`} rowSpan={vesselSpan}>{q.vessel}</td>)}
                                            <td className={`${cellClass} text-gray-600 font-mono text-center text-xs`}>{safeDate(q.etd)}</td>
                                            <td className={`${cellClass} text-gray-600 font-mono text-center text-xs`}>{safeDate(q.cutSi)}</td>
                                            <td className={cellClass}><MultiValueCell value={q.transitTime.replace('Days','').trim()} align="center" /></td>
                                            {visibleColumns.price20 && <td className={`${centerClass} font-mono text-red-600 font-medium text-xs`}>{q.price20}</td>}
                                            {visibleColumns.price40 && <td className={`${centerClass} font-mono text-red-600 font-medium text-xs`}>{q.price40}</td>}
                                            {visibleColumns.price40hq && <td className={`${centerClass} font-mono text-red-600 font-bold bg-red-50/30 text-xs`}>{q.price40hq}</td>}
                                            {visibleColumns.price45 && <td className={`${centerClass} font-mono text-red-600 font-medium text-xs`}>{q.price45}</td>}
                                            {visibleColumns.price40nor && <td className={`${centerClass} font-mono text-red-600 font-medium text-xs`}>{q.price40nor}</td>}
                                            {freetimeSpan > 0 && (<td className={`${centerClass} font-medium text-gray-700 text-xs align-middle bg-white`} rowSpan={freetimeSpan}>{q.freetime}</td>)}
                                            {ffeSpan > 0 && (<td className={`${centerClass} font-medium text-blue-700 text-xs align-middle bg-white`} rowSpan={ffeSpan}>{q.availableFfe}</td>)}
                                            {validitySpan > 0 && (<td className={`${cellClass} text-center text-xs align-middle bg-white`} rowSpan={validitySpan}><span className={`px-1.5 py-0.5 rounded ${new Date(q.validity) < new Date() ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{safeDate(q.validity)}</span></td>)}
                                            {visibleColumns.remarks && remarksSpan > 0 && (<td className={`${cellClass} pl-3 text-gray-500 italic max-w-xs truncate font-bold align-middle bg-white`} rowSpan={remarksSpan}>{q.remarks}</td>)}
                                            <td className="p-1 border-r border-b border-gray-300 text-center align-middle no-print bg-white w-[50px]">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity h-full">
                                                    {canUpdate && (<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStartEdit(q); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5"/></button>)}
                                                    {canDelete && (<button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(q.id); }} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5"/></button>)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </React.Fragment>
              );})}
              
              {Object.keys(groupedData).length === 0 && (
                 <tr>
                    <td colSpan={17} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-3">
                            <CalendarDays className="w-10 h-10 opacity-20" />
                            <p className="text-sm">No quotations found. Use "Quick Add" to start.</p>
                        </div>
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
});