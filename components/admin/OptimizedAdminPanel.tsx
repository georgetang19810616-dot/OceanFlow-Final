import React, { useState, useMemo } from 'react';
import { User, Permission, DatabaseAccess, DatabasePermission, Database as DatabaseType, UserRole } from '../../types';
import { Button } from '../Button';
import { UserList } from './UserList';
import { PermissionManager } from './PermissionManager';
import { 
  UserPlus, Search, Shield, Database, 
  Plus, Trash2, Edit3, CheckCircle2, X, Users 
} from 'lucide-react';

interface OptimizedAdminPanelProps {
  users: User[];
  databases: DatabaseType[];
  onApprove: (userId: string) => void;
  onUpdatePermissions: (userId: string, permissions: Permission[]) => void;
  onUpdateDatabaseAccess: (userId: string, databaseAccess: DatabaseAccess[]) => void;
  onDeleteUser: (userId: string) => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onResetPassword?: (user: User) => void;
}

// 用户表单组件
const UserForm: React.FC<{
  onSubmit: (user: Omit<User, 'id'>) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    displayName: '',
    password: 'temp123',
    firstName: '',
    role: 'USER' as UserRole,
    permissions: [] as Permission[],
    databaseAccess: [] as DatabaseAccess[],
    isApproved: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.username && formData.email) {
      onSubmit(formData);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">添加新用户</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">显示名</label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="VIEWER">查看者</option>
            <option value="USER">用户</option>
            <option value="MANAGER">经理</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            创建用户
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        </div>
      </form>
    </div>
  );
};

// 数据库权限管理组件
const DatabaseAccessManager: React.FC<{
  user: User;
  databases: DatabaseType[];
  onUpdateAccess: (userId: string, access: DatabaseAccess[]) => void;
}> = ({ user, databases, onUpdateAccess }) => {
  const [selectedAccess, setSelectedAccess] = useState<DatabaseAccess[]>(user.databaseAccess || []);

  const toggleDatabaseAccess = (databaseId: string, permission: DatabasePermission) => {
    const existing = selectedAccess.find(a => a.databaseId === databaseId);
    let newAccess: DatabaseAccess[];

    if (existing) {
      const permissions = existing.permissions.includes(permission)
        ? existing.permissions.filter(p => p !== permission)
        : [...existing.permissions, permission];

      if (permissions.length === 0) {
        newAccess = selectedAccess.filter(a => a.databaseId !== databaseId);
      } else {
        newAccess = selectedAccess.map(a =>
          a.databaseId === databaseId ? { ...a, permissions } : a
        );
      }
    } else {
      newAccess = [...selectedAccess, { 
        databaseId, 
        databaseName: databases.find(db => db.id === databaseId)?.name || '',
        permissions: [permission],
        isActive: true
      }];
    }

    setSelectedAccess(newAccess);
    onUpdateAccess(user.id, newAccess);
  };

  const hasPermission = (databaseId: string, permission: DatabasePermission) => {
    const access = selectedAccess.find(a => a.databaseId === databaseId);
    return access?.permissions.includes(permission) || false;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Database className="w-5 h-5" />
        数据库权限 - {user.displayName || user.username}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {databases.map(database => (
          <div key={database.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: database.color }}
              />
              <h4 className="font-medium">{database.name}</h4>
            </div>
            
            <div className="space-y-2">
              {(['VIEW', 'CREATE', 'UPDATE', 'DELETE'] as DatabasePermission[]).map(permission => (
                <label key={permission} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPermission(database.id, permission)}
                    onChange={() => toggleDatabaseAccess(database.id, permission)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{permission}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const OptimizedAdminPanel: React.FC<OptimizedAdminPanelProps> = ({
  users,
  databases,
  onApprove,
  onUpdatePermissions,
  onUpdateDatabaseAccess,
  onDeleteUser,
  onAddUser,
  onResetPassword
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'database'>('users');

  const pendingUsers = useMemo(() => 
    users.filter(user => !user.isApproved), 
    [users]
  );

  const approvedUsers = useMemo(() => 
    users.filter(user => user.isApproved), 
    [users]
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              用户管理
            </h1>
            <p className="text-gray-600 mt-1">管理系统用户和权限</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">总用户数:</span>
              <span className="font-semibold ml-1">{users.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">待审核:</span>
              <span className="font-semibold ml-1 text-yellow-600">{pendingUsers.length}</span>
            </div>
            <Button
              onClick={() => setShowAddForm(true)}
              variant="primary"
              icon={UserPlus}
            >
              添加用户
            </Button>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'users', label: '用户列表', icon: Users },
              { key: 'permissions', label: '权限管理', icon: Shield },
              { key: 'database', label: '数据库权限', icon: Database }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <UserList
              users={users}
              onApprove={onApprove}
              onDelete={onDeleteUser}
              onEdit={setSelectedUser}
              onResetPassword={onResetPassword}
            />
          )}

          {activeTab === 'permissions' && selectedUser && (
            <PermissionManager
              user={selectedUser}
              onUpdatePermissions={onUpdatePermissions}
            />
          )}

          {activeTab === 'database' && selectedUser && (
            <DatabaseAccessManager
              user={selectedUser}
              databases={databases}
              onUpdateAccess={onUpdateDatabaseAccess}
            />
          )}

          {activeTab !== 'users' && !selectedUser && (
            <div className="text-center py-8">
              <div className="text-gray-500">请先从用户列表中选择一个用户</div>
            </div>
          )}
        </div>
      </div>

      {/* 添加用户表单 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">添加新用户</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <UserForm
              onSubmit={(userData) => {
                onAddUser(userData);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* 编辑用户模态框 */}
      {selectedUser && activeTab === 'users' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">编辑用户 - {selectedUser.displayName || selectedUser.username}</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <PermissionManager
                user={selectedUser}
                onUpdatePermissions={onUpdatePermissions}
              />
              
              <DatabaseAccessManager
                user={selectedUser}
                databases={databases}
                onUpdateAccess={onUpdateDatabaseAccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};