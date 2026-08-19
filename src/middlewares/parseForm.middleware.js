export const parseNestedValue = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === '') return '';
    if (!isNaN(trimmed) && trimmed.length < 6) {
      return Number(trimmed);
    }
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseNestedValue(parsed);
      } catch {
        // Fallback
      }
    }
    return trimmed;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => parseNestedValue(item));
  }

  if (typeof obj === 'object') {
    if (obj.constructor && obj.constructor.name !== 'Object' && obj.constructor.name !== 'Array') {
      return obj;
    }

    const result = {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

      const parsedVal = parseNestedValue(obj[key]);

      if (key.includes('.') || key.includes('[')) {
        const normalizedKey = key.replace(/\[([^\]]+)\]/g, '.$1');
        const parts = normalizedKey.split('.');

        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const nextPart = parts[i + 1];
          const isNextArray = !isNaN(nextPart);

          if (!current[part]) {
            current[part] = isNextArray ? [] : {};
          }
          current = current[part];
        }

        const lastPart = parts[parts.length - 1];

        if (current[lastPart] !== undefined && typeof current[lastPart] === 'object' && typeof parsedVal === 'object') {
          current[lastPart] = mergeObjects(current[lastPart], parsedVal);
        } else {
          current[lastPart] = parsedVal;
        }
      } else {
        if (result[key] !== undefined && typeof result[key] === 'object' && typeof parsedVal === 'object') {
          result[key] = mergeObjects(result[key], parsedVal);
        } else {
          result[key] = parsedVal;
        }
      }
    }
    return result;
  }

  return obj;
};

function mergeObjects(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }
  if (typeof target === 'object' && typeof source === 'object') {
    const result = { ...target };
    for (const key in source) {
      if (result[key] !== undefined && typeof result[key] === 'object' && typeof source[key] === 'object') {
        result[key] = mergeObjects(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  return source;
}

export default function parseForm(req, _res, next) {
  try {
    if (req.body) {
      req.body = parseNestedValue(req.body);
    }
    next();
  } catch (error) {
    next(error);
  }
}
