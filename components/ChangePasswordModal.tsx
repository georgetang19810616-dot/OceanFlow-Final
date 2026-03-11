// components/ChangePasswordModal.tsx
import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { Button } from './Button';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  isAdmin?: boolean;
  targetUserId?: string;
  targetUsername?: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onChangePassword,
  isAdmin = false,
  targetUserId,
  targetUsername
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 验证
    if (!isAdmin && !currentPassword) {
      setError('请输入当前密码');
      return;
    }
    
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('新密码长度至少为6位');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('新密码和确认密码不一致');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await onChangePassword(currentPassword, newPassword);
      
      // 重置表单
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // 关闭模态框
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (err: any) {
      console.error('修改密码失败:', err);
      setError(err.message || '修改密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 relative animate-in zoom-in">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isAdmin ? '重置用户密码' : '修改密码'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isAdmin 
                    ? `为 ${targetUsername || '用户'} 重置密码` 
                    : '请确认您的身份并设置新密码'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
          
          {/* 当前密码（如果不是管理员） */}
          {!isAdmin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                当前密码
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="请输入当前密码"
                required={!isAdmin}
                disabled={isLoading}
              />
            </div>
          )}
          
          {/* 新密码 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              新密码
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="请输入新密码（至少6位）"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-400 mt-1">
              密码长度至少6位，建议包含字母、数字和特殊字符
            </p>
          </div>
          
          {/* 确认密码 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              确认新密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="请再次输入新密码"
              required
              disabled={isLoading}
            />
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  处理中...
                </>
              ) : (
                '确认修改'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};