import React, { useState, useMemo } from 'react';
import { Database as DatabaseType, SystemSettings, GateInRate, Allocation } from '../../types';
import { Button } from '../Button';
import { DatabaseSettings } from './DatabaseSettings';
import { ListManager } from './ListManager';
import { GateInRateSettings } from './SimpleGateInRateSettings';
import { AllocationList } from './AllocationList';
import { 
  Save, Download, Upload, Database, 
  Building, Ship, MapPin, Calendar, Tag, Users, Briefcase, 
  ClipboardList, FileText, DollarSign, Settings as SettingsIcon,
  AlertTriangle, Check, Eye, EyeOff, StickyNote, Info, ChevronDown, ChevronUp
} from 'lucide-react';

interface OptimizedSettingsPanelProps {
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
  allocations: Allocation[];
  setAllocations: (v: Allocation[]) => void;
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

// 可折叠面板组件
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
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

export const OptimizedSettingsPanel: React.FC<OptimizedSettingsPanelProps> = (props) => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['basic', 'database']));
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleExportSettings = async () => {
    setIsExporting(true);
    try {
      const settingsToExport: SystemSettings = {
        carriers: props.carriers,
        clients: props.clients,
        services: props.services,
        pols: props.pols,
        pods: props.pods,
        containerTypes: props.containerTypes,
        statuses: props.statuses,
        jobs: props.jobs,
        allocations: props.allocations,
        remarks: props.remarks,
        gateInRates: props.systemSettings.gateInRates || []
      };

      const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oceanflow-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出设置失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text) as SystemSettings;
      
      // 验证导入的数据结构
      if (props.onImportSettings) {
        props.onImportSettings(importedSettings);
      } else {
        // 直接更新各个字段
        if (importedSettings.carriers) props.setCarriers(importedSettings.carriers);
        if (importedSettings.clients) props.setClients(importedSettings.clients);
        if (importedSettings.services) props.setServices(importedSettings.services);
        if (importedSettings.pols) props.setPols(importedSettings.pols);
        if (importedSettings.pods) props.setPods(importedSettings.pods);
        if (importedSettings.containerTypes) props.setContainerTypes(importedSettings.containerTypes);
        if (importedSettings.statuses) props.setStatuses(importedSettings.statuses);
        if (importedSettings.jobs) props.setJobs(importedSettings.jobs);
        if (importedSettings.allocations) props.setAllocations(importedSettings.allocations);
        if (importedSettings.remarks) props.setRemarks(importedSettings.remarks);
        if (importedSettings.gateInRates) {
          props.updateSetting('gateInRates', importedSettings.gateInRates);
        }
      }
    } catch (error) {
      console.error('导入设置失败:', error);
      alert('导入失败：文件格式不正确');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const sections = useMemo(() => [
    {
      id: 'database',
      title: '数据库管理',
      icon: Database,
      description: '管理数据库列表和配置',
      component: (
        <DatabaseSettings
          databases={props.databases}
          addDatabase={props.addDatabase}
          renameDatabase={props.renameDatabase}
          deleteDatabase={props.deleteDatabase}
          onRefreshDatabases={props.onRefreshDatabases}
        />
      )
    },
    {
      id: 'basic',
      title: '基础数据配置',
      icon: SettingsIcon,
      description: '配置系统基础数据选项',
      component: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ListManager
            title="船公司列表"
            items={props.carriers}
            onUpdate={props.setCarriers}
            placeholder="输入船公司名称"
          />
          <ListManager
            title="客户列表"
            items={props.clients}
            onUpdate={props.setClients}
            placeholder="输入客户名称"
          />
          <ListManager
            title="服务类型"
            items={props.services}
            onUpdate={props.setServices}
            placeholder="输入服务类型"
          />
          <ListManager
            title="装货港"
            items={props.pols}
            onUpdate={props.setPols}
            placeholder="输入装货港名称"
          />
          <ListManager
            title="卸货港"
            items={props.pods}
            onUpdate={props.setPods}
            placeholder="输入卸货港名称"
          />
          <ListManager
            title="集装箱类型"
            items={props.containerTypes}
            onUpdate={props.setContainerTypes}
            placeholder="输入集装箱类型"
          />
          <ListManager
            title="状态列表"
            items={props.statuses}
            onUpdate={props.setStatuses}
            placeholder="输入状态名称"
          />
          <ListManager
            title="作业类型"
            items={props.jobs}
            onUpdate={props.setJobs}
            placeholder="输入作业类型"
          />
        </div>
      )
    },
    {
      id: 'allocations',
      title: '分配设置',
      icon: Briefcase,
      description: '管理分配选项',
      component: (
        <AllocationList
              allocations={props.allocations}
              onUpdate={props.setAllocations}
              placeholder="输入分配名称"
            />
      )
    },
    {
      id: 'remarks',
      title: '备注模板',
      icon: StickyNote,
      description: '管理常用备注模板',
      component: (
        <ListManager
          title="备注模板"
          items={props.remarks}
          onUpdate={props.setRemarks}
          placeholder="输入备注模板"
        />
      )
    },
    {
      id: 'gateInRates',
      title: 'Gate In Rate',
      icon: DollarSign,
      description: '配置Gate In费率',
      component: (
        <GateInRateSettings
          gateInRates={props.systemSettings.gateInRates || []}
          onUpdate={(rates) => props.updateSetting('gateInRates', rates)}
        />
      )
    }
  ], [props]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6" />
              系统设置
            </h1>
            <p className="text-gray-600 mt-1">配置系统基础数据和参数</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportSettings}
              variant="secondary"
              size="sm"
              icon={Download}
              loading={isExporting}
            >
              导出设置
            </Button>
            
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="hidden"
              />              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  loading={isImporting}
                >
                  导入设置
                </Button>
              </label>
            </label>
            
            <Button
              onClick={() => {
                // 保存所有设置
                Promise.all([
                  props.updateSetting('carriers', props.carriers),
                  props.updateSetting('clients', props.clients),
                  props.updateSetting('services', props.services),
                  props.updateSetting('pols', props.pols),
                  props.updateSetting('pods', props.pods),
                  props.updateSetting('containerTypes', props.containerTypes),
                  props.updateSetting('statuses', props.statuses),
                  props.updateSetting('jobs', props.jobs),
                  props.updateSetting('allocations', props.allocations),
                  props.updateSetting('remarks', props.remarks),
                ]).then(() => {
                  alert('设置已保存');
                });
              }}
              variant="primary"
              size="sm"
              icon={Save}
            >
              保存所有设置
            </Button>
          </div>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="space-y-4">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            description={section.description}
          >
            {section.component}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  );
};