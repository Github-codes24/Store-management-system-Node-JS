import {
  DISTRIBUTOR_PATTERNS,
  DISTRIBUTOR_STATUS,
  DISTRIBUTOR_VALIDATION,
} from '../../src/constants/distributor.constants.js';
import Distributor from '../../src/models/distributor.model.js';
import {
  createDistributorSchema,
  updateDistributorSchema,
} from '../../src/validations/distributor.validation.js';

describe('Distributor Constants', () => {
  it('should define correct status values', () => {
    expect(DISTRIBUTOR_STATUS.ACTIVE).toBe('active');
    expect(DISTRIBUTOR_STATUS.INACTIVE).toBe('inactive');
    expect(DISTRIBUTOR_VALIDATION.STATUS.ENUM).toEqual(['active', 'inactive']);
  });

  it('should validate email pattern correctly', () => {
    expect(DISTRIBUTOR_PATTERNS.EMAIL.test('example@mail.com')).toBe(true);
    expect(DISTRIBUTOR_PATTERNS.EMAIL.test('invalid-email')).toBe(false);
  });

  it('should validate mobile pattern correctly', () => {
    expect(DISTRIBUTOR_PATTERNS.MOBILE.test('9876543210')).toBe(true);
    expect(DISTRIBUTOR_PATTERNS.MOBILE.test('+919876543210')).toBe(true);
    expect(DISTRIBUTOR_PATTERNS.MOBILE.test('123')).toBe(false);
  });

  it('should validate GSTIN pattern correctly', () => {
    expect(DISTRIBUTOR_PATTERNS.GSTIN.test('27AAACR5055K1Z7')).toBe(true);
    expect(DISTRIBUTOR_PATTERNS.GSTIN.test('INVALIDGSTIN123')).toBe(false);
  });
});

describe('Distributor Zod Validations', () => {
  it('should pass createDistributorSchema with valid payload', () => {
    const payload = {
      name: 'Sysco',
      salesperson: 'John Doe',
      mobile: '9876543210',
      email: 'example@mail.com',
      gstin: '27AAACR5055K1Z7',
      address: '1901 Thornridge Cir. Shiloh, Hawaii 81063',
      status: 'active',
    };

    const result = createDistributorSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should fail createDistributorSchema with missing name', () => {
    const payload = {
      salesperson: 'John Doe',
      mobile: '9876543210',
      email: 'example@mail.com',
    };

    const result = createDistributorSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should fail createDistributorSchema with invalid GSTIN', () => {
    const payload = {
      name: 'Sysco',
      mobile: '9876543210',
      email: 'example@mail.com',
      gstin: 'INVALIDGSTIN',
    };

    const result = createDistributorSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should pass updateDistributorSchema with partial payload', () => {
    const payload = {
      name: 'Sysco Updated',
    };

    const result = updateDistributorSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe('Distributor Mongoose Model', () => {
  it('should correctly format document fields and defaults', () => {
    const doc = new Distributor({
      name: 'Reinhart Foodservice',
      mobile: '9876543210',
      email: 'reinhart@mail.com',
    });

    expect(doc.name).toBe('Reinhart Foodservice');
    expect(doc.status).toBe('active');
    expect(doc.isDeleted).toBe(false);
  });
});
