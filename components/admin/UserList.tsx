import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../../types';
import { Button } from '../Button';
import { Search, Shield, UserPlus, Trash2, Edit3, CheckCircle2, Clock, ShieldAlert, Users } from 'lucide-react';

interface UserListProps {
  users: User[];
  onApprove: (userId: string) => void;
  onDelete: (userId: string) => void;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  onApprove,
  onDelete,
  onEdit,
  onResetPassword
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesStatus = filterStatus === 'all' || 
                           (filterStatus === 'pending' && !user.isApproved) ||
                           (filterStatus === 'approved' && user.isApproved);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  const getRoleColor = (role: UserRole) => {
    const colors = {
      ADMIN: 'bg-red-100 text-red-800',
      MANAGER: 'bg-orange-100 text-orange-800',
      USER: 'bg-blue-100 text-blue-800',
      VIEWER: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (isApproved: boolean) => {
    return isApproved 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          用户管理
          <span className="text-sm font-normal text-gray-500">({filteredUsers.length} 用户)</span>
        </h3>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索用户名、邮箱或显示名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有角色</option>
          <option value="ADMIN">管理员</option>
          <option value="MANAGER">经理</option>
          <option value="USER">用户</option>
          <option value="VIEWER">查看者</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'approved')}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">所有状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已批准</option>
        </select>
      </div>

      {/* 用户列表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-700">用户信息</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">角色</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">状态</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">创建时间</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div>
                    <div className="font-medium text-gray-900">{user.displayName || user.username}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">{user.username}</div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.isApproved)}`}>
                    {user.isApproved ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" />已批准</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" />待审核</>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {!user.isApproved && (
                      <Button
                        onClick={() => onApprove(user.id)}
                        size="sm"
                        variant="primary"
                        icon={CheckCircle2}
                      >
                        批准
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => onEdit(user)}
                      size="sm"
                      variant="secondary"
                      icon={Edit3}
                    >
                      编辑
                    </Button>
                    
                    <Button
                      onClick={() => onResetPassword(user)}
                      size="sm"
                      variant="secondary"
                    >
                      重置密码
                    </Button>
                    
                    <Button
                      onClick={() => onDelete(user.id)}
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                    >
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">没有找到匹配的用户</p>
        </div>
      )}
    </div>
  );
};