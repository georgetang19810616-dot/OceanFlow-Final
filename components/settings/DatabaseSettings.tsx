import React from 'react';
import { Database as DatabaseType } from '../../types';
import { Button } from '../Button';
import { Database, Plus, Trash2, Edit3 } from 'lucide-react';

interface DatabaseSettingsProps {
  databases: DatabaseType[];
  addDatabase: (name: string) => void;
  renameDatabase: (id: string, newName: string) => void;
  deleteDatabase: (id: string) => void;
  onRefreshDatabases?: () => void;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  databases,
  addDatabase,
  renameDatabase,
  deleteDatabase,
  onRefreshDatabases
}) => {
  const [newDatabaseName, setNewDatabaseName] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState('');

  const handleAddDatabase = () => {
    if (newDatabaseName.trim()) {
      addDatabase(newDatabaseName.trim());
      setNewDatabaseName('');
    }
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameDatabase(id, editingName.trim());
      setEditingId(null);
      setEditingName('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">数据库管理</h3>
      </div>

      {/* 添加新数据库 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDatabaseName}
          onChange={(e) => setNewDatabaseName(e.target.value)}
          placeholder="输入数据库名称"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleAddDatabase()}
        />
        <Button
          onClick={handleAddDatabase}
          variant="primary"
          size="sm"
          icon={Plus}
        >
          添加
        </Button>
      </div>

      {/* 数据库列表 */}
      <div className="space-y-2">
        {databases.map((db) => (
          <div
            key={db.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            {editingId === db.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleRename(db.id);
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditingName('');
                    }
                  }}
                />
                <Button
                  onClick={() => handleRename(db.id)}
                  size="sm"
                  variant="primary"
                >
                  保存
                </Button>
                <Button
                  onClick={() => {
                    setEditingId(null);
                    setEditingName('');
                  }}
                  size="sm"
                  variant="secondary"
                >
                  取消
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: (db as any).color || '#3B82F6' }}
                  />
                  <span className="font-medium">{db.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => {
                      setEditingId(db.id);
                      setEditingName(db.name);
                    }}
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                  />
                  <Button
                    onClick={() => deleteDatabase(db.id)}
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="text-red-600 hover:text-red-700"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {onRefreshDatabases && (
        <Button
          onClick={onRefreshDatabases}
          variant="secondary"
          size="sm"
        >
          刷新数据库列表
        </Button>
      )}
    </div>
  );
};