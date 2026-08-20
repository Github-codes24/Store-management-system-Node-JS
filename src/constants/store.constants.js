export const STORE_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE: /^\+?[0-9]{10,15}$/,
  STORE_CODE: /^[A-Za-z0-9\s_-]{2,30}$/,
};

export const STORE_VALIDATION = {
  STORE_CODE: {
    MIN: 2,
    MAX: 30,
    PATTERN: STORE_PATTERNS.STORE_CODE,
  },
  NAME: {
    MIN: 2,
    MAX: 100,
  },
  MOBILE: {
    MIN: 10,
    MAX: 15,
    PATTERN: STORE_PATTERNS.MOBILE,
  },
  EMAIL: {
    MIN: 5,
    MAX: 255,
    PATTERN: STORE_PATTERNS.EMAIL,
  },
  LOCATION: {
    MIN: 5,
    MAX: 500,
  },
};
