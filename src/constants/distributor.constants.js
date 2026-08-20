export const DISTRIBUTOR_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const DISTRIBUTOR_STATUS_VALUES = Object.values(DISTRIBUTOR_STATUS);

export const DISTRIBUTOR_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE: /^\+?[0-9]{10,15}$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
};

export const DISTRIBUTOR_VALIDATION = {
  NAME: {
    MIN: 2,
    MAX: 100,
  },
  SALESPERSON: {
    MIN: 2,
    MAX: 100,
  },
  MOBILE: {
    MIN: 10,
    MAX: 15,
    PATTERN: DISTRIBUTOR_PATTERNS.MOBILE,
  },
  EMAIL: {
    MIN: 5,
    MAX: 255,
    PATTERN: DISTRIBUTOR_PATTERNS.EMAIL,
  },
  GSTIN: {
    MIN: 15,
    MAX: 15,
    PATTERN: DISTRIBUTOR_PATTERNS.GSTIN,
  },
  ADDRESS: {
    MIN: 5,
    MAX: 500,
  },
  STATUS: {
    ENUM: DISTRIBUTOR_STATUS_VALUES,
    DEFAULT: DISTRIBUTOR_STATUS.ACTIVE,
  },
};
