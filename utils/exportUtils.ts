import { Booking, FieldDefinition } from '../types';
import { formatUTCDateToLocal, isDateField } from './dateUtils';

export const exportToCSV = (data: Booking[], fields: FieldDefinition[], filename: string) => {
  // 1. Create Header Row
  const headers = fields.map(f => f.label);
  const headerKeys = fields.map(f => f.key);

  // 2. Create Rows
  const rows = data.map(booking => {
    return headerKeys.map(key => {
      let val = booking[key];
      
      // 特殊处理所有日期字段，格式化为 YYYY-MM-DD
      if (isDateField(key) && val) {
        val = formatUTCDateToLocal(String(val));
      }
      
      // Escape quotes and wrap in quotes to handle commas/newlines
      const stringVal = val === undefined || val === null ? '' : String(val);
      return `"${stringVal.replace(/"/g, '""')}"`;
    }).join(',');
  });

  // 3. Combine with BOM for UTF-8 to fix Chinese encoding
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.join(','), ...rows].join('\n');

  // 4. Create Blob and Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};