export const RETAILER_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE: /^\+?[0-9]{10,15}$/,
  RETAILER_CODE: /^[A-Za-z0-9\s_-]{2,30}$/,
};

export const RETAILER_VALIDATION = {
  RETAILER_CODE: {
    MIN: 2,
    MAX: 30,
    PATTERN: RETAILER_PATTERNS.RETAILER_CODE,
  },
  NAME: {
    MIN: 2,
    MAX: 100,
  },
  MOBILE: {
    MIN: 10,
    MAX: 15,
    PATTERN: RETAILER_PATTERNS.MOBILE,
  },
  EMAIL: {
    MIN: 5,
    MAX: 255,
    PATTERN: RETAILER_PATTERNS.EMAIL,
  },
  LOCATION: {
    MIN: 2,
    MAX: 500,
  },
};
