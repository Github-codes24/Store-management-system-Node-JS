import { RETAILER_PATTERNS } from '../../src/constants/retailer.constants.js';
import Retailer from '../../src/models/retailer.model.js';
import {
  createRetailerSchema,
  updateRetailerSchema,
} from '../../src/validations/retailer.validation.js';

describe('Retailer Constants', () => {
  it('should validate email pattern correctly', () => {
    expect(RETAILER_PATTERNS.EMAIL.test('retailer@example.com')).toBe(true);
    expect(RETAILER_PATTERNS.EMAIL.test('invalid-email')).toBe(false);
  });

  it('should validate mobile pattern correctly', () => {
    expect(RETAILER_PATTERNS.MOBILE.test('9876543210')).toBe(true);
    expect(RETAILER_PATTERNS.MOBILE.test('+919876543210')).toBe(true);
    expect(RETAILER_PATTERNS.MOBILE.test('123')).toBe(false);
  });

  it('should validate retailer code pattern correctly', () => {
    expect(RETAILER_PATTERNS.RETAILER_CODE.test('RET0001')).toBe(true);
    expect(RETAILER_PATTERNS.RETAILER_CODE.test('RET-123')).toBe(true);
  });
});

describe('Retailer Zod Validations', () => {
  it('should pass createRetailerSchema with valid payload', () => {
    const payload = {
      retailerCode: 'RET0001',
      name: 'Simmons Stores',
      mobile: '9876543210',
      email: 'example@mail.com',
      location: '3517 W. Gray St. Utica, Pennsylvania 57867',
    };

    const result = createRetailerSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retailerCode).toBe('RET0001');
      expect(result.data.name).toBe('Simmons Stores');
    }
  });

  it('should fail createRetailerSchema with missing name', () => {
    const payload = {
      mobile: '9876543210',
      email: 'example@mail.com',
    };

    const result = createRetailerSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should pass updateRetailerSchema with partial payload', () => {
    const payload = {
      name: 'Daily Choice Mart',
    };

    const result = updateRetailerSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe('Retailer Mongoose Model', () => {
  it('should format document fields and set default soft delete flag', () => {
    const doc = new Retailer({
      retailerCode: 'RET0002',
      name: 'Price Buster',
      mobile: '9876543210',
      email: 'pricebuster@example.com',
      location: 'Main Market',
    });

    expect(doc.name).toBe('Price Buster');
    expect(doc.isDeleted).toBe(false);
  });
});
