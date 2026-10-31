/**
 * Helper to safely parse multiple date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO, timestamp).
 * Returns a valid JavaScript Date or null. Never returns an Invalid Date object.
 */
export const parseFlexibleDate = (dateVal, isEndOfDay = false) => {
  if (dateVal === null || dateVal === undefined) return null;
  
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    if (isEndOfDay) {
      const d = new Date(dateVal);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return dateVal;
  }

  if (typeof dateVal === 'number') {
    if (isNaN(dateVal)) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    if (isEndOfDay) {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (
      !trimmed || 
      trimmed.toLowerCase() === 'invalid date' || 
      trimmed.toLowerCase() === 'null' || 
      trimmed.toLowerCase() === 'undefined'
    ) {
      return null;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = isEndOfDay
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0);
      return !isNaN(d.getTime()) ? d : null;
    }

    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = isEndOfDay
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0);
      return !isNaN(d.getTime()) ? d : null;
    }

    // Standard string parsing (ISO 8601, etc.)
    const standard = new Date(trimmed);
    if (!isNaN(standard.getTime())) {
      if (isEndOfDay) {
        if (standard.getHours() === 0 && standard.getMinutes() === 0 && standard.getSeconds() === 0) {
          standard.setHours(23, 59, 59, 999);
        }
      }
      return standard;
    }
  }

  return null;
};
