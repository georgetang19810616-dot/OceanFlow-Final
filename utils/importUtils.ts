import { Booking, FieldDefinition, Quotation } from '../types';
import { getWeekLabel } from './dateUtils';

// Helper to parse a CSV line handling quotes: "Value, with comma", Normal Value
const parseCSVLine = (text: string, separator: string = ','): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Detect separator (comma or semicolon)
const detectSeparator = (text: string): string => {
  const firstLine = text.split('\n')[0];
  return firstLine.includes(';') ? ';' : ',';
};

export const parseCSV = (csvText: string): string[][] => {
  // 1. Remove BOM (Byte Order Mark) if present (common in Excel UTF-8)
  const cleanText = csvText.replace(/^\uFEFF/, '');
  
  const separator = detectSeparator(cleanText);
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
  
  return lines.map(line => parseCSVLine(line, separator));
};

export const generateTemplate = (fields: FieldDefinition[]): string => {
  // Create a header row
  const headers = fields.map(f => f.label).join(',');
  // Add a dummy example row to help users understand formats
  const exampleRow = fields.map(f => {
    if (f.key === 'week') return 'WK49';
    if (f.key === 'state') return 'PENDING';
    if (f.type === 'DATE') return '2023-12-01'; // 修复：使用 'DATE' 而不是 'date'
    return '';
  }).join(',');
  
  return `${headers}\n${exampleRow}`;
};

export const processImportedData = (
  rawRows: string[][], 
  fields: FieldDefinition[]
): Booking[] => {
  if (rawRows.length < 2) return [];

  // 1. Map Headers (Labels) to Keys
  const headers = rawRows[0].map(h => h.replace(/^"|"$/g, '').trim());
  
  const keyMap: Record<number, string> = {}; // Index -> Field Key

  headers.forEach((header, index) => {
    // 1. Exact Match via Field Definition Labels
    let field = fields.find(f => f.label.toLowerCase() === header.toLowerCase());
    
    // 2. 增强字段映射
    if (!field) {
        const lowerHeader = header.toLowerCase();
        // 处理 allocation 字段
        if (lowerHeader === 'allocation' || lowerHeader === 'alloc') {
            field = fields.find(f => f.key === 'allocation');
            if (!field) {
                field = fields.find(f => f.key === 'quantity');
            }
        } else if (lowerHeader === 'job') {
            field = fields.find(f => f.key === 'job');
            if (!field) {
                field = fields.find(f => f.key === 'client');
            }
        } else if (lowerHeader === 'qty' || lowerHeader === 'quantity') {
            field = fields.find(f => f.key === 'quantity');
        } else if (lowerHeader === 'ref' || lowerHeader === 'reference') {
            field = fields.find(f => f.key === 'bookingRef');
        }
    }

    if (field) {
      keyMap[index] = field.key;
    }
  });

  // 2. Process Data Rows
  const newBookings: Booking[] = [];
  const now = Date.now();

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0) continue;

    // Generate a truly unique ID
    const uniqueId = `imp-${now}-${i}-${Math.random().toString(36).substring(2, 9)}`;

    const booking: any = {
      id: uniqueId,
      state: 'PENDING', // Default state
      isLocked: false
    };

    let hasData = false;

    row.forEach((cell, cellIndex) => {
      const key = keyMap[cellIndex];
      if (key) {
        // Clean cell data and convert to uppercase
        let value = cell ? cell.replace(/^"|"$/g, '').trim().toUpperCase() : '';
        booking[key] = value;
        if (value) hasData = true;
      }
    });

    // Only add if row wasn't completely empty
    if (hasData) {
      // Auto-calculate Week if ETD is present but Week is missing or needs update
      if (booking.etd) {
        booking.week = getWeekLabel(booking.etd);
      } else if (!booking.week) {
        booking.week = 'WK--';
      }
      
      newBookings.push(booking as Booking);
    }
  }

  return newBookings;
};

// --- Quotations Import Processor ---
export const processImportedQuotations = (rawRows: string[][]): Quotation[] => {
    if (rawRows.length < 2) return [];

    const headers = rawRows[0].map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    
    // Manual mapping for standard columns
    const mapHeaderToKey = (h: string): keyof Quotation | null => {
        if (h.includes('region')) return 'region';
        if (h.includes('carrier')) return 'carrier';
        if (h.includes('pol')) return 'pol';
        if (h.includes('pod')) return 'pod';
        if (h.includes('vessel')) return 'vessel';
        if (h.includes('etd')) return 'etd';
        if (h.includes('20')) return 'price20';
        if (h.includes('40gp')) return 'price40';
        if (h.includes('40hq')) return 'price40hq';
        if (h.includes('45')) return 'price45';
        if (h.includes('nor')) return 'price40nor';
        if (h.includes('transit') || h.includes('t/t')) return 'transitTime';
        if (h.includes('validity')) return 'validity';
        if (h.includes('si')) return 'cutSi';
        if (h.includes('remark')) return 'remarks';
        if (h.includes('freetime')) return 'freetime';
        if (h.includes('ffe')) return 'availableFfe';
        return null;
    };

    const keyMap: Record<number, keyof Quotation> = {};
    headers.forEach((h, idx) => {
        const key = mapHeaderToKey(h);
        if (key) keyMap[idx] = key;
    });

    const newQuotations: Quotation[] = [];
    const now = Date.now();

    for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (row.length === 0) continue;

        const q: any = { id: `q-imp-${now}-${i}` };
        let hasData = false;

        row.forEach((cell, idx) => {
            const key = keyMap[idx];
            if (key) {
                // Clean cell data and convert to uppercase
                let val = cell ? cell.replace(/^"|"$/g, '').trim().toUpperCase() : '';
                q[key] = val;
                if(val) hasData = true;
            }
        });

        if (hasData) {
            // Defaults
            if (!q.region) q.region = 'General';
            newQuotations.push(q as Quotation);
        }
    }

    return newQuotations;
};
