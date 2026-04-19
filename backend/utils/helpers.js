/**
 * Umumiy yordamchi funksiyalar
 */

/**
 * Bugungi sana (YYYY-MM-DD)
 */
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Date ni YYYY-MM-DD formatga o'tkazish
 */
const toDateString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Bugungi sananing boshi va oxiri (00:00:00 va 23:59:59)
 */
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
};

/**
 * Ikki sana orasidagi kunlarni qaytarish (YYYY-MM-DD array)
 */
const getDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

/**
 * Joriy oyning oxirgi kuni
 */
const getEndOfMonth = (date = new Date()) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

/**
 * Joriy oyning birinchi kuni
 */
const getStartOfMonth = (date = new Date()) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

/**
 * Kod unique tekshirish (biznes ichida)
 */
const isValidCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 1 || code.length > 50) return false;
  // Bo'sh joy va faqat space bo'lsa - noto'g'ri
  if (code.trim().length === 0) return false;
  return true;
};

/**
 * Xavfsiz string (HTML inject dan himoya)
 */
const sanitizeString = (str, maxLength = 500) => {
  if (!str) return '';
  return String(str)
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '');
};

/**
 * Pul formatlash (so'm bilan)
 */
const formatMoney = (amount) => {
  if (typeof amount !== 'number') return '0';
  return amount.toLocaleString('uz-UZ');
};

/**
 * Random ID
 */
const generateId = (length = 8) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

module.exports = {
  getTodayString,
  toDateString,
  getTodayRange,
  getDateRange,
  getEndOfMonth,
  getStartOfMonth,
  isValidCode,
  sanitizeString,
  formatMoney,
  generateId,
};