/**
 * Parses boolean-like values from Excel
 * e.g., 'Evet', 'Hayır', 'Var', 'Yok', '1', '0', 1, 0, true, false
 */
export const parseBoolean = (val: any): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  if (!val) return false;
  const str = String(val).toLowerCase().trim();
  if (['evet', 'var', 'true', '1', 'aktif'].includes(str)) return true;
  return false;
};

/**
 * Parses numeric values or currency text
 * e.g., "1.234,50 ₺", "1500", 1500
 */
export const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  
  // Try to remove currency symbols, spaces, etc.
  let str = String(val).replace(/[^0-9.,-]/g, '');
  
  // Handle Turkish locale number format: 1.234,50 -> 1234.50
  if (str.includes(',') && str.includes('.')) {
    // If it has both, comma is probably the decimal separator
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // If only comma, it might be the decimal
    str = str.replace(',', '.');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Cleans phone numbers (remove spaces, +90, etc.)
 */
export const parsePhone = (val: any): string => {
  if (!val) return '';
  const str = String(val).replace(/\D/g, '');
  // Optionally remove leading 90 or 0
  if (str.startsWith('90') && str.length === 12) return str.substring(2);
  if (str.startsWith('0') && str.length === 11) return str.substring(1);
  return str;
};
