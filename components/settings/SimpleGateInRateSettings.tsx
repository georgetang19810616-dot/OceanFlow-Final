import React, { useState } from 'react';
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
  const [newRate, setNewRate] = useState<Partial<GateInRate>>({
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">Gate In Rate 设置</h3>
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
                <p className="text-sm text-gray-500">
                  共 {rate.items.length} 个价格组合
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
          </div>
        ))}
      </div>

      {gateInRates.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          暂无 Gate In Rate 数据
        </p>
      )}
    </div>
  );
};