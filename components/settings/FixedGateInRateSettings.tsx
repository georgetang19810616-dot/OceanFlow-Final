import React from 'react';
import { GateInRate, GateInRateItem } from '../../types';
import { Button } from '../Button';
import { Plus, Trash2 } from 'lucide-react';

interface GateInRateSettingsProps {
  gateInRates: GateInRate[];
  onUpdate: (rates: GateInRate[]) => void;
}

export const GateInRateSettings: React.FC<GateInRateSettingsProps> = ({
  gateInRates,
  onUpdate
}) => {
  const [newRate, setNewRate] = React.useState<Partial<GateInRate>>({
    startDate: '',
    endDate: '',
    service: '',
    contact: '',
    items: []
  });

  const handleAddRate = () => {
    if (newRate.startDate?.trim() && newRate.endDate?.trim()) {
      const rate: GateInRate = {
        id: Date.now().toString(),
        startDate: newRate.startDate.trim(),
        endDate: newRate.endDate.trim(),
        service: newRate.service?.trim() || '',
        contact: newRate.contact?.trim() || '',
        items: newRate.items || []
      };
      onUpdate([...gateInRates, rate]);
      setNewRate({
        startDate: '',
        endDate: '',
        service: '',
        contact: '',
        items: []
      });
    }
  };

  const handleDeleteRate = (id: string) => {
    onUpdate(gateInRates.filter(rate => rate.id !== id));
  };

  const handleAddItem = (rateId: string) => {
    const rate = gateInRates.find(r => r.id === rateId);
    if (rate) {
      const newItem: GateInRateItem = {
        id: Date.now().toString(),
        pols: [],
        pods: [],
        containerTypes: [],
        price: 0
      };
      const updatedRates = gateInRates.map(r =>
        r.id === rateId ? { ...r, items: [...r.items, newItem] } : r
      );
      onUpdate(updatedRates);
    }
  };

  const handleUpdateItem = (rateId: string, itemId: string, updates: Partial<GateInRateItem>) => {
    const updatedRates = gateInRates.map(rate => {
      if (rate.id === rateId) {
        return {
          ...rate,
          items: rate.items.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        };
      }
      return rate;
    });
    onUpdate(updatedRates);
  };

  const handleDeleteItem = (rateId: string, itemId: string) => {
    const updatedRates = gateInRates.map(rate => {
      if (rate.id === rateId) {
        return {
          ...rate,
          items: rate.items.filter(item => item.id !== itemId)
        };
      }
      return rate;
    });
    onUpdate(updatedRates);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Gate In Rate 设置</h3>
      </div>

      {/* 添加新费率 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
          <input
            type="date"
            value={newRate.startDate}
            onChange={(e) => setNewRate({ ...newRate, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
          <input
            type="date"
            value={newRate.endDate}
            onChange={(e) => setNewRate({ ...newRate, endDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">服务</label>
          <input
            type="text"
            value={newRate.service}
            onChange={(e) => setNewRate({ ...newRate, service: e.target.value })}
            placeholder="输入服务名称"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">合约</label>
          <input
            type="text"
            value={newRate.contact}
            onChange={(e) => setNewRate({ ...newRate, contact: e.target.value })}
            placeholder="输入合约名称"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleAddRate}
          variant="primary"
          size="sm"
          icon={Plus}
        >
          添加费率
        </Button>
      </div>

      {/* 费率列表 */}
      <div className="space-y-4">
        {gateInRates.map((rate) => (
          <div key={rate.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">
                  {rate.service || '通用服务'} - {rate.contact || '通用合约'}
                </h4>
                <p className="text-sm text-gray-600">
                  {rate.startDate} 至 {rate.endDate}
                </p>
              </div>
              <Button
                onClick={() => handleDeleteRate(rate.id)}
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="text-red-600"
              />
            </div>

            {/* 费率项列表 */}
            <div className="space-y-2">
              {rate.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <input
                    type="text"
                    value={item.pols.join(', ')}
                    onChange={(e) => handleUpdateItem(rate.id, item.id, { pols: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="起运港"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    value={item.pods.join(', ')}
                    onChange={(e) => handleUpdateItem(rate.id, item.id, { pods: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="目的港"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    value={item.containerTypes.join(', ')}
                    onChange={(e) => handleUpdateItem(rate.id, item.id, { containerTypes: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="箱型"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => handleUpdateItem(rate.id, item.id, { price: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                    step="0.01"
                  />
                  <Button
                    onClick={() => handleDeleteItem(rate.id, item.id)}
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="text-red-600"
                  />
                </div>
              ))}
              
              <Button
                onClick={() => handleAddItem(rate.id)}
                size="sm"
                variant="secondary"
                icon={Plus}
              >
                添加价格组合
              </Button>
            </div>
          </div>
        ))}
      </div>

      {gateInRates.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          暂无 Gate In Rate 数据，请添加新费率
        </p>
      )}
    </div>
  );
};