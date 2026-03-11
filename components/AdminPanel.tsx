// AdminPanel.tsx - 完整修改版

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Permission, UserRole, DatabaseType, DatabaseAccess, DatabasePermission } from '../types';
import { AVAILABLE_PERMISSIONS, PERMISSION_GROUPS } from '../constants';
import { Button } from './Button';
import { 
  Check, Trash2, Shield, UserPlus, X, Search, KeyRound, 
  ShieldAlert, CheckCircle2, Clock, ChevronDown, ChevronUp, Globe,
  Database, Lock, Eye, EyeOff, Save, Copy, AlertCircle,
  FolderTree, BookOpen, FileText, Users as UsersIcon,
  CheckSquare, Square, Filter, RefreshCw, Download, Upload
} from 'lucide-react';
import { apiService } from '../services/apiService';

interface AdminPanelProps {
  users: User[];
  databases: DatabaseType[]; // 新增：传递数据库列表
  onApprove: (userId: string) => void;
  onUpdatePermissions: (userId: string, permissions: Permission[]) => void;
  onUpdateDatabaseAccess: (userId: string, databaseAccess: DatabaseAccess[]) => void; // 新增：更新数据库权限
  onDeleteUser: (userId: string) => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onResetPassword?: (user: User) => void;
}

// 管理员权限检查函数
const isAdminUser = (user: User): boolean => {
  return user.role === UserRole.ADMIN || user.username.toLowerCase() === 'admin';
};

// 获取用户的有效权限（管理员自动获得所有权限）
const getEffectivePermissions = (user: User): Permission[] => {
  if (isAdminUser(user)) {
    return AVAILABLE_PERMISSIONS;
  }
  return user.permissions;
};

// 权限标签配置
const PERMISSION_LABELS: Record<DatabasePermission, string> = {
  'READ': '查看',
  'CREATE': '创建',
  'UPDATE': '修改',
  'DELETE': '删除',
  'LOCK': '锁定'
};

// 权限颜色配置
const PERMISSION_COLORS: Record<DatabasePermission, string> = {
  'READ': 'bg-blue-100 text-blue-700 border-blue-200',
  'CREATE': 'bg-green-100 text-green-700 border-green-200',
  'UPDATE': 'bg-amber-100 text-amber-700 border-amber-200',
  'DELETE': 'bg-red-100 text-red-700 border-red-200',
  'LOCK': 'bg-purple-100 text-purple-700 border-purple-200'
};

// --- Database Permissions Component ---
interface DatabasePermissionsProps {
  user: User;
  databases: DatabaseType[];
  databaseAccess: DatabaseAccess[];
  onUpdate: (databaseAccess: DatabaseAccess[]) => void;
}

const DatabasePermissions: React.FC<DatabasePermissionsProps> = ({ 
  user, databases, databaseAccess, onUpdate 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState<DatabaseAccess[]>(databaseAccess || []);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isAdmin = isAdminUser(user);
  
  // 初始化数据库权限
  useEffect(() => {
    if (!editingPermissions.length && databases.length > 0) {
      const initialAccess: DatabaseAccess[] = databases.map(db => ({
        databaseId: db.id,
        databaseName: db.name,
        permissions: ['READ'], // 默认只给查看权限
        isActive: true
      }));
      setEditingPermissions(initialAccess);
    }
  }, [databases]);
  
  // 过滤数据库
  const filteredDatabases = useMemo(() => {
    if (!searchTerm) return databases;
    return databases.filter(db => 
      db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [databases, searchTerm]);
  
  // 获取数据库的权限配置
  const getDatabaseAccess = (databaseId: string): DatabaseAccess => {
    const existing = editingPermissions.find(access => access.databaseId === databaseId);
    if (existing) return existing;
    
    const db = databases.find(d => d.id === databaseId);
    return {
      databaseId,
      databaseName: db?.name || databaseId,
      permissions: [],
      isActive: false
    };
  };
  
  // 切换权限
  const togglePermission = (databaseId: string, permission: DatabasePermission) => {
    if (isAdmin) return; // 管理员不可修改
    
    setEditingPermissions(prev => prev.map(access => {
      if (access.databaseId === databaseId) {
        const hasPermission = access.permissions.includes(permission);
        const newPermissions = hasPermission
          ? access.permissions.filter(p => p !== permission)
          : [...access.permissions, permission];
        
        return {
          ...access,
          permissions: newPermissions,
          isActive: newPermissions.length > 0 // 如果有权限则激活
        };
      }
      return access;
    }));
  };
  
  // 批量操作
  const handleSelectAll = (selected: boolean) => {
    if (isAdmin) return;
    
    setEditingPermissions(prev => prev.map(access => ({
      ...access,
      permissions: selected ? ['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOCK'] : [],
      isActive: selected
    })));
  };
  
  const handleCopyFromUser = (sourceUser: User) => {
    if (sourceUser.databaseAccess) {
      setEditingPermissions(sourceUser.databaseAccess);
      alert(`已从用户 ${sourceUser.firstName} 复制数据库权限配置`);
    }
  };
  
  const handleSave = () => {
    onUpdate(editingPermissions);
    setIsExpanded(false);
  };
  
  const handleCancel = () => {
    setEditingPermissions(databaseAccess || []);
    setIsExpanded(false);
  };
  
  // 检查是否所有权限都已授予
  const hasAllPermissions = (access: DatabaseAccess): boolean => {
    return ['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOCK'].every(p => 
      access.permissions.includes(p as DatabasePermission)
    );
  };
  
  return (
    <div className="border rounded-lg border-gray-200 bg-white">
      {/* 标题栏 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FolderTree className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">数据库访问权限</h4>
              <p className="text-sm text-gray-500">
                共 {databases.length} 个数据库，已配置 {editingPermissions.filter(a => a.isActive).length} 个
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {isAdmin ? '管理员拥有全部权限' : '可配置每个数据库的访问权限'}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* 内容区域 */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* 管理员提示 */}
          {isAdmin ? (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-purple-600" />
                <div>
                  <h5 className="font-semibold text-purple-800">管理员权限说明</h5>
                  <p className="text-sm text-purple-600">
                    管理员用户自动拥有所有数据库的全部权限，无需单独配置。此配置仅对普通用户有效。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 控制栏 */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 w-full">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索数据库..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSelectAll(true)}
                    variant="secondary"
                    size="sm"
                    className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    全选所有权限
                  </Button>
                  <Button
                    onClick={() => handleSelectAll(false)}
                    variant="secondary"
                    size="sm"
                    className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    清除所有权限
                  </Button>
                </div>
              </div>
              
              {/* 批量操作提示 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700">
                    提示：点击权限标签可快速切换，配置完成后记得点击"保存更改"
                  </span>
                </div>
              </div>
              
              {/* 数据库权限表格 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 grid grid-cols-12 gap-4 p-3 text-xs font-medium text-gray-600 border-b">
                  <div className="col-span-4">数据库名称</div>
                  <div className="col-span-8">权限配置</div>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {filteredDatabases.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      没有找到匹配的数据库
                    </div>
                  ) : (
                    filteredDatabases.map((db) => {
                      const access = getDatabaseAccess(db.id);
                      const isActive = access.isActive;
                      const hasAll = hasAllPermissions(access);
                      
                      return (
                        <div key={db.id} className="p-3 hover:bg-gray-50 grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                <Database className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{db.name}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                  ID: {db.id}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-8">
                            <div className="flex flex-wrap gap-2">
                              {(['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOCK'] as DatabasePermission[]).map((perm) => {
                                const hasPerm = access.permissions.includes(perm);
                                return (
                                  <button
                                    key={perm}
                                    onClick={() => togglePermission(db.id, perm)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                      hasPerm ? PERMISSION_COLORS[perm] : 'bg-gray-100 text-gray-400 border-gray-200'
                                    }`}
                                    title={PERMISSION_LABELS[perm]}
                                  >
                                    {PERMISSION_LABELS[perm]}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => {
                                  if (hasAll) {
                                    // 清除所有权限
                                    setEditingPermissions(prev => prev.map(access => 
                                      access.databaseId === db.id 
                                        ? { ...access, permissions: [], isActive: false }
                                        : access
                                    ));
                                  } else {
                                    // 授予所有权限
                                    setEditingPermissions(prev => prev.map(access => 
                                      access.databaseId === db.id 
                                        ? { 
                                            ...access, 
                                            permissions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOCK'],
                                            isActive: true
                                          }
                                        : access
                                    ));
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                                  hasAll 
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent' 
                                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                                }`}
                              >
                                {hasAll ? '取消全部' : '全部权限'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={handleCancel}
                  variant="secondary"
                >
                  <X className="w-4 h-4 mr-2" />
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  variant="primary"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- User Card Component (优化风格) ---
interface UserCardProps {
  user: User;
  databases: DatabaseType[];
  onApprove: (userId: string) => void;
  onUpdatePermissions: (userId: string, permissions: Permission[]) => void;
  onUpdateDatabaseAccess: (userId: string, databaseAccess: DatabaseAccess[]) => void;
  onDeleteUser: (userId: string) => void;
  onResetPassword?: (user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  databases,
  onApprove,
  onUpdatePermissions,
  onUpdateDatabaseAccess,
  onDeleteUser,
  onResetPassword
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'database'>('system');
  const isAdmin = isAdminUser(user);
  const isMe = user.username.toLowerCase() === 'admin';
  
  // 新增：数据库权限更新函数
  const handleUpdateDatabaseAccess = async (databaseAccess: DatabaseAccess[]) => {
    try {
      console.log('💾 更新用户数据库权限:', {
        userId: user.id,
        databaseAccessLength: databaseAccess.length,
        activeCount: databaseAccess.filter(a => a.isActive).length
      });
      
      // 构建更新数据 - 确保字段名正确，后端会自动映射
      const updateData = {
        databaseAccess: databaseAccess.map(access => ({
          ...access,
          // 确保权限是有效的数组
          permissions: Array.isArray(access.permissions) ? access.permissions : []
        }))
      };
      
      console.log('📤 发送的更新数据:', updateData);
      
      // 调用父组件的更新函数
      await onUpdateDatabaseAccess(user.id, updateData.databaseAccess);
      
    } catch (error) {
      console.error('❌ 更新数据库权限失败:', error);
      alert('更新数据库权限失败: ' + (error as Error).message);
    }
  };
  
  // 系统权限相关函数
  const toggleSystemPermission = (perm: Permission) => {
    if (isAdmin) {
      alert('管理员权限是固定的，无法修改');
      return;
    }
    const currentPerms = user.permissions;
    const newPerms = currentPerms.includes(perm)
      ? currentPerms.filter(p => p !== perm)
      : [...currentPerms, perm];
    onUpdatePermissions(user.id, newPerms);
  };
  
  const handleToggleAllSystemPermissions = (enable: boolean) => {
    if (isAdmin) {
      alert('管理员权限是固定的，无法修改');
      return;
    }
    let newPerms: Permission[];
    if (enable) {
      newPerms = AVAILABLE_PERMISSIONS;
    } else {
      newPerms = [Permission.BOOKING_READ, Permission.QUOTATION_READ];
    }
    onUpdatePermissions(user.id, newPerms);
  };
  
  const hasAllSystemPermissions = (): boolean => {
    if (isAdmin) return true;
    return AVAILABLE_PERMISSIONS.every(perm => user.permissions.includes(perm));
  };
  
  // 用户头像颜色
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-500 to-indigo-600',
      'bg-gradient-to-br from-green-500 to-emerald-600',
      'bg-gradient-to-br from-purple-500 to-violet-600',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-rose-500 to-pink-600',
      'bg-gradient-to-br from-cyan-500 to-teal-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 用户卡片头部 */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-xl ${getAvatarColor(user.firstName)} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}>
              {user.firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-900">{user.firstName}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  user.role === UserRole.ADMIN 
                    ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-200' 
                    : 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border-blue-200'
                }`}>
                  {user.role === UserRole.ADMIN ? (
                    <>
                      <ShieldAlert className="w-3 h-3 inline mr-1" />
                      管理员
                    </>
                  ) : '用户'}
                </span>
                {!user.isApproved && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
                    <Clock className="w-3 h-3 inline mr-1" />
                    待审核
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-1">@{user.username}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <UsersIcon className="w-4 h-4" />
                  创建于 {new Date(user.createdAt).toLocaleDateString()}
                </span>
                {user.lastLogin && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    最后登录 {new Date(user.lastLogin).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!user.isApproved && (
              <Button
                onClick={() => onApprove(user.id)}
                variant="primary"
                size="sm"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                <Check className="w-4 h-4 mr-2" />
                批准用户
              </Button>
            )}
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="secondary"
              size="sm"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  收起详情
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  权限配置
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* 权限配置区域 */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          {/* 标签页切换 */}
          <div className="flex border-b border-gray-300 mb-6">
            <button
              onClick={() => setActiveTab('system')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'system' 
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                系统权限
              </div>
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'database' 
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                数据库权限
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {user.databaseAccess?.filter(a => a.isActive).length || 0}/{databases.length}
                </span>
              </div>
            </button>
          </div>
          
          {/* 系统权限标签页 */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              {/* 管理员提示 */}
              {isAdmin ? (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-purple-600" />
                    <div>
                      <h5 className="font-semibold text-purple-800">管理员拥有全部系统权限</h5>
                      <p className="text-sm text-purple-600">
                        管理员用户自动拥有所有系统权限，无需单独配置。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 批量操作 */}
                  <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200">
                    <div>
                      <h5 className="font-semibold text-gray-900">系统权限配置</h5>
                      <p className="text-sm text-gray-500">
                        当前拥有 {user.permissions.length}/{AVAILABLE_PERMISSIONS.length} 个权限
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleToggleAllSystemPermissions(true)}
                        variant="secondary"
                        size="sm"
                        className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        授予全部权限
                      </Button>
                      <Button
                        onClick={() => handleToggleAllSystemPermissions(false)}
                        variant="secondary"
                        size="sm"
                        className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        清空全部权限
                      </Button>
                    </div>
                  </div>
                  
                  {/* 权限组 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
                      const activeCount = perms.filter(p => user.permissions.includes(p)).length;
                      const isFull = activeCount === perms.length;
                      
                      // 组主题颜色
                      const theme = 
                        group === 'Booking' ? { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' } :
                        group === 'Quotation' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' } :
                        group === 'Finance' ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' } :
                        group === 'SAF_Finance' ? { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' } :
                        group === 'CMA_Finance' ? { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' } :
                        group === 'Concord_Finance' ? { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' } :
                        group === 'Admin' ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' } :
                        group === 'Settings' ? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' } :
                        { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
                      
                      return (
                        <div key={group} className={`border rounded-lg p-4 ${theme.border} ${theme.bg}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h6 className={`font-semibold ${theme.text}`}>{group}</h6>
                            <span className={`px-2 py-1 text-xs rounded-full ${isFull ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {activeCount}/{perms.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {perms.map(perm => {
                              const hasPerm = user.permissions.includes(perm);
                              return (
                                <button
                                  key={perm}
                                  onClick={() => toggleSystemPermission(perm)}
                                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                                    hasPerm 
                                      ? `${theme.bg} ${theme.text} ${theme.border} border` 
                                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{perm.split('_').pop()}</span>
                                    {hasPerm && <Check className="w-3 h-3" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* 数据库权限标签页 */}
          {activeTab === 'database' && (
            <DatabasePermissions
              user={user}
              databases={databases}
              databaseAccess={user.databaseAccess || []}
              onUpdate={handleUpdateDatabaseAccess} // 使用新的处理函数
            />
          )}
          
          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-300">
            {onResetPassword && (
              <Button
                onClick={() => onResetPassword(user)}
                variant="secondary"
                className="bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200 hover:from-amber-100 hover:to-orange-100"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                重置密码
              </Button>
            )}
            {!isMe && (
              <Button
                onClick={() => {
                  if (window.confirm(`确定要删除用户 "${user.firstName}" 吗？此操作不可恢复。`)) {
                    onDeleteUser(user.id);
                  }
                }}
                variant="danger"
                className="bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200 hover:from-red-100 hover:to-rose-100"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除用户
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  users, 
  databases,
  onApprove, 
  onUpdatePermissions,
  onUpdateDatabaseAccess,
  onDeleteUser, 
  onAddUser,
  onResetPassword 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: UserRole.USER,
    isApproved: true
  });
  
  // 过滤用户
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // 搜索过滤
      const matchesSearch = 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 角色过滤
      const matchesRole = 
        roleFilter === 'all' || 
        (roleFilter === 'admin' && isAdminUser(user)) ||
        (roleFilter === 'user' && !isAdminUser(user));
      
      // 状态过滤
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'approved' && user.isApproved) ||
        (statusFilter === 'pending' && !user.isApproved);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);
  
  // 统计信息
  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => isAdminUser(u)).length,
    active: users.filter(u => u.isActive !== false).length,
    pending: users.filter(u => !u.isApproved).length,
    withDatabaseAccess: users.filter(u => u.databaseAccess && u.databaseAccess.some(a => a.isActive)).length
  }), [users]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password || !formData.firstName) {
      alert('请填写必填字段：用户名、密码和姓名');
      return;
    }
    
    // 检查用户名是否已存在
    const existingUser = users.find(u => u.username === formData.username);
    if (existingUser) {
      alert(`用户名 "${formData.username}" 已存在，请使用其他用户名`);
      return;
    }
    
    // 构建用户数据
    const userData: Omit<User, 'id'> = {
      ...formData,
      permissions: formData.role === UserRole.ADMIN 
        ? AVAILABLE_PERMISSIONS 
        : [Permission.BOOKING_READ, Permission.QUOTATION_READ],
      databaseAccess: databases.map(db => ({
        databaseId: db.id,
        databaseName: db.name,
        permissions: ['READ'], // 默认给查看权限
        isActive: formData.role === UserRole.ADMIN ? true : false // 管理员默认全部激活
      })),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    onAddUser(userData);
    setIsAddModalOpen(false);
    setFormData({
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      role: UserRole.USER,
      isApproved: true
    });
  };
  
  // 导出用户数据
  const handleExportUsers = () => {
    const usersToExport = users.map(user => ({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName || '',
      role: user.role,
      isApproved: user.isApproved,
      permissions: user.permissions,
      databaseAccess: user.databaseAccess || [],
      createdAt: user.createdAt
    }));
    
    const blob = new Blob([JSON.stringify(usersToExport, null, 2)], { 
      type: 'application/json;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white">
                <UsersIcon className="w-7 h-7" />
              </div>
              用户管理系统
            </h1>
            <p className="text-gray-600 max-w-2xl">
              管理团队成员及其权限，包括系统权限和数据库级别的访问控制。
              您可以精确控制每个用户对每个数据库的访问权限。
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="secondary"
              className="border border-gray-300"
            >
              <Upload className="w-4 h-4 mr-2" />
              批量导入
            </Button>
            <Button
              onClick={handleExportUsers}
              variant="secondary"
              className="border border-gray-300"
            >
              <Download className="w-4 h-4 mr-2" />
              导出用户
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              添加用户
            </Button>
          </div>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">总用户数</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-purple-700">{stats.admins}</div>
            <div className="text-sm text-gray-500">管理员</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-green-700">{stats.active}</div>
            <div className="text-sm text-gray-500">活跃用户</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
            <div className="text-sm text-gray-500">待审核</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">{stats.withDatabaseAccess}</div>
            <div className="text-sm text-gray-500">有数据库权限</div>
          </div>
        </div>
      </div>
      
      {/* 过滤和搜索 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索用户 (用户名、姓名)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">所有角色</option>
                <option value="admin">管理员</option>
                <option value="user">普通用户</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="appearance-none pl-4 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">所有状态</option>
                <option value="approved">已批准</option>
                <option value="pending">待审核</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
            </div>
            <Button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              variant="secondary"
              className="border border-gray-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重置筛选
            </Button>
          </div>
        </div>
        
        {/* 搜索结果统计 */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            找到 <span className="font-semibold text-gray-900">{filteredUsers.length}</span> 个用户
            {searchTerm && (
              <span className="ml-2">
                搜索: <span className="font-semibold text-blue-600">"{searchTerm}"</span>
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            共 {databases.length} 个数据库可配置权限
          </div>
        </div>
      </div>
      
      {/* 用户列表 */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-600 mb-2">未找到用户</h3>
            <p className="text-gray-500 mb-6">尝试调整搜索条件或添加新用户</p>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              添加第一个用户
            </Button>
          </div>
        ) : (
          filteredUsers.map(user => (
            <UserCard
              key={user.id}
              user={user}
              databases={databases}
              onApprove={onApprove}
              onUpdatePermissions={onUpdatePermissions}
              onUpdateDatabaseAccess={onUpdateDatabaseAccess}
              onDeleteUser={onDeleteUser}
              onResetPassword={onResetPassword}
            />
          ))
        )}
      </div>
      
      {/* 添加用户模态框 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">添加新用户</h3>
                <p className="text-sm text-gray-600">创建新的团队成员账户</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">用户名 *</label>
                  <input
                    required
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="输入用户名"
                  />
                  <p className="text-xs text-gray-500">用于登录的用户名，不能重复</p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">密码 *</label>
                  <input
                    required
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="输入密码"
                  />
                  <p className="text-xs text-gray-500">至少6个字符</p>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">姓氏 *</label>
                  <input
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="输入姓氏"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">名字</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="输入名字"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">用户角色</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`border rounded-xl p-4 cursor-pointer transition-all ${formData.role === UserRole.USER ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value={UserRole.USER} 
                      checked={formData.role === UserRole.USER} 
                      onChange={() => setFormData({...formData, role: UserRole.USER})} 
                      className="hidden" 
                    />
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <UsersIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold">普通用户</div>
                        <div className="text-sm text-gray-500">可分配具体权限</div>
                      </div>
                    </div>
                  </label>
                  
                  <label className={`border rounded-xl p-4 cursor-pointer transition-all ${formData.role === UserRole.ADMIN ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input 
                      type="radio" 
                      name="role" 
                      value={UserRole.ADMIN} 
                      checked={formData.role === UserRole.ADMIN} 
                      onChange={() => setFormData({...formData, role: UserRole.ADMIN})} 
                      className="hidden" 
                    />
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <ShieldAlert className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-semibold">管理员</div>
                        <div className="text-sm text-gray-500">拥有全部权限</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="isApproved"
                  checked={formData.isApproved}
                  onChange={(e) => setFormData({...formData, isApproved: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isApproved" className="text-sm text-gray-700">
                  <span className="font-medium">立即激活账户</span>
                  <span className="text-gray-500 ml-2">(如不勾选，用户需要管理员批准才能登录)</span>
                </label>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setIsAddModalOpen(false)}
                  variant="secondary"
                  className="flex-1 py-3"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  创建用户
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};