/**
 * 日期处理工具函数 - 简化版本
 * 不再进行时区转换，直接处理 YYYY-MM-DD 格式的日期字符串
 */

/**
 * 获取日期所在周的日期范围
 * 返回：{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
export const getWeekRange = (dateString: string): { start: string; end: string } => {
  if (!dateString) return { start: '', end: '' };
  
  try {
    // 解析日期，不进行时区转换
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return { start: '', end: '' };
    
    const dayOfWeek = date.getDay(); // 0 = 周日, 1 = 周一, ...
    
    // 计算周一的日期（如果当前是周日，dayOfWeek=0，则向前推6天）
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    
    // 计算周日的日期
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start: formatDateForInput(monday.toISOString()),
      end: formatDateForInput(sunday.toISOString())
    };
  } catch (error) {
    console.warn('计算周范围错误:', error);
    return { start: '', end: '' };
  }
};

// 在 dateUtils.ts 中添加
export const getShanghaiDate = (date?: Date): string => {
  const targetDate = date || new Date();
  const shanghaiTime = new Date(targetDate.getTime() + (8 * 60 - targetDate.getTimezoneOffset()) * 60000);
  
  const year = shanghaiTime.getFullYear();
  const month = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
  const day = String(shanghaiTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

export const getShanghaiDateTime = (date?: Date): string => {
  const targetDate = date || new Date();
  const shanghaiTime = new Date(targetDate.getTime() + (8 * 60 - targetDate.getTimezoneOffset()) * 60000);
  
  return shanghaiTime.toISOString().replace('Z', '+08:00');
};

/**
 * 解析日期字符串，不进行时区转换
 * 将任意日期字符串解析为 Date 对象
 */
export const parseDateWithoutTimezone = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  try {
    // 如果是 YYYY-MM-DD 格式，直接解析为本地时间
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // 使用本地时间（不进行时区转换）
      return new Date(year, month - 1, day);
    }
    
    // 尝试解析其他格式
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.warn('日期解析错误:', error);
    return null;
  }
};

/**
 * 获取ISO周数（辅助函数）
 */
const getISOWeek = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // 将周日(0)转换为6，周一(1)转换为0，依此类推
  target.setDate(target.getDate() - dayNr + 3); // 调整到目标周的周四
  
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const dayDiff = (target.getTime() - firstThursday.getTime()) / 86400000;
  
  return 1 + Math.ceil(dayDiff / 7);
};

/**
 * 获取ISO周所在的年份（辅助函数）
 */
const getISOWeekYear = (date: Date): number => {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() + 3 - (date.getDay() + 6) % 7); // 调整到周四
  return target.getFullYear();
};

/**
 * 获取日期所在周的标签（ISO 8601 标准周数）
 * 规则：每周从周一开始，每年的第一周包含该年的第一个星期四
 * 示例：2025-12-01 到 2025-12-07 显示为 2025 WK49
 */
export const getWeekLabel = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return '';
    
    // 获取该日期所在的ISO周数
    const weekNumber = getISOWeek(date);
    const year = date.getFullYear();
    
    // 处理跨年的情况
    const adjustedYear = getISOWeekYear(date);
    
    return `${adjustedYear} WK${weekNumber.toString().padStart(2, '0')}`;
  } catch (error) {
    console.warn('计算周数错误:', error);
    return '';
  }
};

/**
 * 格式化日期，不进行时区转换
 * 输入：任何日期字符串
 * 输出：YYYY-MM-DD（不进行时区转换）
 */
export const formatDateWithoutTimezone = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return dateString;
    
    // 格式化为 YYYY-MM-DD，不进行时区转换
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateString;
  }
};

/**
 * 检查是否为日期字段
 */
export const isDateField = (key: string): boolean => {
  const dateKeys = ['etd', 'eta', 'etb', 'gatein', 'gateIn', 'gateInDate'];
  return dateKeys.some(k => key.toLowerCase().includes(k));
};

/**
 * 将任意日期字符串格式化为 input[type="date"] 需要的格式 (YYYY-MM-DD)
 * @param dateStr 日期字符串
 * @returns 格式化的日期字符串
 */
export const formatDateForInput = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // 解析日期，不进行时区转换
    const date = parseDateWithoutTimezone(dateString);
    if (!date) {
      console.warn('无效的日期字符串:', dateString);
      return '';
    }
    
    // 格式化为 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('日期格式化错误:', error);
    return dateString;
  }
};

/**
 * 将日期字符串格式化为本地时间显示
 * 输入：2025-12-11 或 2025年12月11日
 * 输出：2025-12-11
 */
export const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // 处理 "2026年01月24日" 格式
    const chineseMatch = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (chineseMatch) {
      const [, year, month, day] = chineseMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // 尝试解析其他格式
    const date = parseDateWithoutTimezone(dateString);
    if (!date) {
      console.warn('无效的日期字符串:', dateString);
      return dateString;
    }
    
    // 格式化为 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('日期显示格式化错误:', error);
    return dateString;
  }
};

/**
 * 将日期格式化为数据库存储格式
 * 直接返回 YYYY-MM-DD 格式的字符串
 * 不再进行时区转换，由数据库时区设置负责
 */
export const formatDateForDatabase = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // 直接返回格式化后的日期字符串（YYYY-MM-DD）
    return formatDateForInput(dateString);
  } catch (error) {
    console.warn('数据库日期格式化错误:', error);
    return dateString;
  }
};

/**
 * 获取当前日期（YYYY-MM-DD 格式，不包含时间部分）
 */
export const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 比较两个日期字符串（YYYY-MM-DD 格式）
 * @returns 负数表示 date1 在 date2 之前，0 表示相等，正数表示 date1 在 date2 之后
 */
export const compareDates = (date1: string, date2: string): number => {
  if (!date1 || !date2) return 0;
  
  try {
    const d1 = parseDateWithoutTimezone(date1);
    const d2 = parseDateWithoutTimezone(date2);
    
    if (!d1 || !d2) return 0;
    
    return d1.getTime() - d2.getTime();
  } catch (error) {
    console.warn('日期比较错误:', error);
    return 0;
  }
};

/**
 * 计算日期之间的天数差
 */
export const getDaysDifference = (date1: string, date2: string): number => {
  if (!date1 || !date2) return 0;
  
  try {
    const d1 = parseDateWithoutTimezone(date1);
    const d2 = parseDateWithoutTimezone(date2);
    
    if (!d1 || !d2) return 0;
    
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.warn('计算天数差错误:', error);
    return 0;
  }
};

/**
 * 验证日期字符串是否为有效日期
 */
export const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false;
  
  try {
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return false;
    
    return !isNaN(date.getTime());
  } catch (error) {
    console.warn('日期验证错误:', error);
    return false;
  }
};

/**
 * 日期加减天数
 * @param dateString 原始日期字符串
 * @param days 要加减的天数（正数为加，负数为减）
 * @returns 新的日期字符串（YYYY-MM-DD 格式）
 */
export const addDays = (dateString: string, days: number): string => {
  if (!dateString) return '';
  
  try {
    const date = parseDateWithoutTimezone(dateString);
    if (!date) return '';
    
    date.setDate(date.getDate() + days);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('日期加减错误:', error);
    return dateString;
  }
};

/**
 * 获取月份的第一天和最后一天
 * @param year 年份
 * @param month 月份（1-12）
 * @returns { firstDay: 'YYYY-MM-DD', lastDay: 'YYYY-MM-DD' }
 */
export const getMonthRange = (year: number, month: number): { firstDay: string; lastDay: string } => {
  try {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    return {
      firstDay: format(firstDay),
      lastDay: format(lastDay)
    };
  } catch (error) {
    console.warn('获取月份范围错误:', error);
    return { firstDay: '', lastDay: '' };
  }
};

/**
 * 将 UTC 日期字符串格式化为本地日期字符串 YYYY-MM-DD
 * @param utcString UTC 日期字符串
 * @returns 格式化后的本地日期字符串
 * @deprecated 请使用 formatDateForInput 或 formatDateWithoutTimezone
 */
export const formatUTCDateToLocal = (dateString: string): string => {
  return formatDateForInput(dateString);
};

/**
 * 将本地日期字符串转换为 UTC 字符串
 * @param localDateStr 本地日期字符串 (YYYY-MM-DD)
 * @returns UTC 日期字符串
 * @deprecated 请使用 formatDateForInput
 */
export const formatLocalDateToUTC = (dateString: string): string => {
  return dateString; // 直接返回，由后端处理时区转换
};

/**
 * 根据周标签获取日期（该周的周五）
 * @param weekLabel 周标签，如 'WK49' 或 '2025 WK49'
 * @returns 该周周五的日期字符串（YYYY-MM-DD）
 */
export const getDateFromWeek = (weekLabel: string): string => {
  if (!weekLabel || !weekLabel.includes('WK')) return getCurrentDate();
  
  try {
    // 解析年份和周数
    const weekParts = weekLabel.split(' WK');
    let year: number, weekNum: number;
    
    if (weekParts.length === 2) {
      // 格式: '2025 WK49'
      year = parseInt(weekParts[0], 10);
      weekNum = parseInt(weekParts[1], 10);
    } else {
      // 格式: 'WK49'
      year = new Date().getFullYear();
      weekNum = parseInt(weekLabel.replace('WK', ''), 10);
    }
    
    if (isNaN(weekNum)) return getCurrentDate();
    
    // 计算该年第一天的日期
    const firstDayOfYear = new Date(year, 0, 1);
    // 计算第一周的周四
    const firstThursday = new Date(year, 0, 4);
    // 调整到第一周的周一
    const firstMonday = new Date(firstThursday);
    firstMonday.setDate(firstThursday.getDate() - 3);
    
    // 计算目标周的周一
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    
    // 计算目标周的周五
    const targetFriday = new Date(targetMonday);
    targetFriday.setDate(targetMonday.getDate() + 4);
    
    return formatDateForInput(targetFriday.toISOString());
  } catch (error) {
    console.warn('从周标签解析日期错误:', error);
    return getCurrentDate();
  }
};

/**
 * 简化日期格式化函数
 * 专门用于处理 YYYY-MM-DD 格式的日期，不进行任何时区转换
 */
export const formatSimpleDate = (dateString: string): string => {
  if (!dateString) return '';
  
  // 如果是 YYYY-MM-DD 格式，直接返回
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // 尝试解析其他格式
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.warn('简单日期格式化错误:', error);
    return dateString;
  }
};