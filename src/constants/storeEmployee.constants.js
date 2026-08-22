export const STORE_EMPLOYEE_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE: /^\+?[0-9]{10,15}$/,
  USER_ID: /^[A-Za-z0-9_.-]{3,30}$/,
};

export const STORE_EMPLOYEE_DESIGNATIONS = [
  'Manager',
  'Cashier',
  'Store Associate',
  'Sales Associate',
  'Storekeeper',
];

export const STORE_EMPLOYEE_VALIDATION = {
  NAME: {
    MIN: 2,
    MAX: 100,
  },
  DESIGNATION: {
    ENUM: STORE_EMPLOYEE_DESIGNATIONS,
  },
  USER_ID: {
    MIN: 3,
    MAX: 30,
    PATTERN: STORE_EMPLOYEE_PATTERNS.USER_ID,
  },
  MOBILE: {
    MIN: 10,
    MAX: 15,
    PATTERN: STORE_EMPLOYEE_PATTERNS.MOBILE,
  },
  EMAIL: {
    MIN: 5,
    MAX: 255,
    PATTERN: STORE_EMPLOYEE_PATTERNS.EMAIL,
  },
  ADDRESS: {
    MIN: 5,
    MAX: 500,
  },
  PASSWORD: {
    MIN: 6,
    MAX: 100,
  },
};
