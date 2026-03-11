import React, { useState, useMemo } from 'react';
import { User, Permission } from '../../types';
import { Button } from '../Button';
import { Shield, Check, X, Search } from 'lucide-react';
import { AVAILABLE_PERMISSIONS, PERMISSION_GROUPS } from '../../constants';

interface PermissionManagerProps {
  user: User;
  onUpdatePermissions: (userId: string, permissions: Permission[]) => void;
}

export const PermissionManager: React.FC<PermissionManagerProps> = ({
  user,
  onUpdatePermissions
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(user.permissions || []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPermissions = useMemo(() => {
    return Object.entries(PERMISSION_GROUPS).reduce((acc, [group, permissions]) => {
      const filtered = permissions.filter(p => 
        p.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[group] = filtered;
      }
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [searchTerm]);

  const togglePermission = (permission: Permission) => {
    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter(p => p !== permission)
      : [...selectedPermissions, permission];
    
    setSelectedPermissions(newPermissions);
    onUpdatePermissions(user.id, newPermissions);
  };

  const getPermissionDescription = (permission: Permission): string => {
    const descriptions: Record<string, string> = {
      'admin': '完全系统管理权限',
      'user': '用户管理权限',
      'booking': '预订管理权限',
      'quotation': '报价管理权限',
      'settings': '系统设置权限',
      'finance': '财务管理权限',
      'database': '数据库管理权限',
      'export': '数据导出权限',
      'import': '数据导入权限'
    };
    return descriptions[permission] || permission;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5" />
          权限管理 - {user.displayName || user.username}
        </h3>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="搜索权限..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            当前用户角色: <strong>{user.role}</strong>
          </span>
        </div>
      </div>

      {/* 权限组 */}
      <div className="space-y-6">
        {Object.entries(filteredPermissions).map(([group, permissions]) => (
          <div key={group} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 capitalize">
              {group.replace('_', ' ')} 权限组
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissions.map(permission => (
                <div
                  key={permission}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedPermissions.includes(permission)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => togglePermission(permission)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{permission}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {getPermissionDescription(permission)}
                      </div>
                    </div>
                    
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedPermissions.includes(permission)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedPermissions.includes(permission) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 权限摘要 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">权限摘要</h4>
        <div className="flex flex-wrap gap-2">
          {selectedPermissions.length === 0 ? (
            <span className="text-sm text-gray-500">暂无权限</span>
          ) : (
            selectedPermissions.map(permission => (
              <span
                key={permission}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {permission}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};