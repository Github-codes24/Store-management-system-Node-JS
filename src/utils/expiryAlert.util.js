/**
 * Utility for flexible parsing and formatting of product expiry alert thresholds.
 * Supports numbers and descriptive strings like:
 * - 20, "20", "20 days", "before 20 days", "10 days"
 * - "1 month", "2 months", "before 1 month", "2 month"
 * - "1 week", "2 weeks"
 */

export const parseExpiryAlertDays = (value, defaultDays = 30) => {
  if (value === null || value === undefined || value === '') {
    return defaultDays;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : defaultDays;
  }

  const str = String(value).trim().toLowerCase();
  if (!str) return defaultDays;

  // Check for months: "1 month", "2 months", "before 1 month", "2 month"
  const monthMatch = str.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (monthMatch) {
    const months = parseFloat(monthMatch[1]);
    return Math.round(months * 30);
  }

  // Check for weeks: "1 week", "2 weeks"
  const weekMatch = str.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (weekMatch) {
    const weeks = parseFloat(weekMatch[1]);
    return Math.round(weeks * 7);
  }

  // Check for days: "20 days", "before 20 days", "10 days"
  const dayMatch = str.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (dayMatch) {
    return Math.round(parseFloat(dayMatch[1]));
  }

  // Pure digits: "20", "10", "60"
  const rawNum = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(rawNum) && rawNum >= 0) {
    return Math.round(rawNum);
  }

  return defaultDays;
};

export const formatExpiryAlertLabel = (days) => {
  if (days === null || days === undefined || days === '') return '30 Days (1 Month)';
  const num = Number(days);
  if (isNaN(num)) return '30 Days (1 Month)';
  if (num === 30) return '1 Month (30 Days)';
  if (num === 60) return '2 Months (60 Days)';
  if (num === 90) return '3 Months (90 Days)';
  if (num === 7) return '1 Week (7 Days)';
  if (num === 14) return '2 Weeks (14 Days)';
  return `${num} Days`;
};

export const isNearExpiry = (expiryDate, expiryAlertDays = 30, fromDate = new Date()) => {
  if (!expiryDate) return false;
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return false;
  const alertDays = Number(expiryAlertDays) > 0 ? Number(expiryAlertDays) : 30;
  const cutoff = fromDate.getTime() + alertDays * 86400000;
  return exp.getTime() <= cutoff;
};
