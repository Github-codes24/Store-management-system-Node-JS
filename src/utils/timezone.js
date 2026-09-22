export const getKolkataTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour) === 24 ? 0 : Number(partMap.hour),
    minute: Number(partMap.minute),
    second: Number(partMap.second)
  };
};

export const getKolkataDate = (date = new Date()) => {
  const parts = getKolkataTimeParts(date);
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

export const getKolkataTodayRange = (date = new Date()) => {
  const kolkataDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const start = new Date(`${kolkataDateStr}T00:00:00.000+05:30`);
  const end = new Date(`${kolkataDateStr}T23:59:59.999+05:30`);
  return { start, end };
};
