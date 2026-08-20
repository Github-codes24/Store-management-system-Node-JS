import { STORE_PATTERNS } from '../../src/constants/store.constants.js';
import Store from '../../src/models/store.model.js';
import {
  createStoreSchema,
  updateStoreSchema,
} from '../../src/validations/store.validation.js';

describe('Store Constants', () => {
  it('should validate email pattern correctly', () => {
    expect(STORE_PATTERNS.EMAIL.test('store@example.com')).toBe(true);
    expect(STORE_PATTERNS.EMAIL.test('invalid-email')).toBe(false);
  });

  it('should validate mobile pattern correctly', () => {
    expect(STORE_PATTERNS.MOBILE.test('9876543210')).toBe(true);
    expect(STORE_PATTERNS.MOBILE.test('+919876543210')).toBe(true);
    expect(STORE_PATTERNS.MOBILE.test('123')).toBe(false);
  });

  it('should validate store code pattern correctly', () => {
    expect(STORE_PATTERNS.STORE_CODE.test('Store 001')).toBe(true);
    expect(STORE_PATTERNS.STORE_CODE.test('STORE-123')).toBe(true);
    expect(STORE_PATTERNS.STORE_CODE.test('S')).toBe(false);
  });
});

describe('Store Zod Validations', () => {
  it('should pass createStoreSchema with valid payload', () => {
    const payload = {
      storeCode: 'Store 001',
      name: 'Daily Choice Mart',
      mobile: '9876543210',
      email: 'example@mail.com',
      location: '1901 Thornridge Cir. Shiloh, Hawaii 81063',
    };

    const result = createStoreSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.storeCode).toBe('STORE 001');
    }
  });

  it('should fail createStoreSchema with missing storeCode', () => {
    const payload = {
      name: 'Daily Choice Mart',
      mobile: '9876543210',
      email: 'example@mail.com',
    };

    const result = createStoreSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail createStoreSchema with invalid mobile format', () => {
    const payload = {
      storeCode: 'Store 001',
      name: 'Daily Choice Mart',
      mobile: 'abc',
      email: 'example@mail.com',
    };

    const result = createStoreSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should pass updateStoreSchema with partial payload', () => {
    const payload = {
      name: 'Updated Store Mart',
    };

    const result = updateStoreSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe('Store Mongoose Model', () => {
  it('should correctly format document fields and soft delete default', () => {
    const doc = new Store({
      storeCode: 'Store 002',
      name: 'Family Basket Store',
      mobile: '9876543210',
      email: 'example@mail.com',
      location: '4517 Washington Ave',
    });

    expect(doc.name).toBe('Family Basket Store');
    expect(doc.isDeleted).toBe(false);
  });
});
