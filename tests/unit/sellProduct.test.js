import SellProduct from '../../src/models/sellProduct.model.js';
import SellProductPayment from '../../src/models/sellProductPayment.model.js';
import {
  addSellPaymentSchema,
  createSellProductSchema,
  updateSellProductSchema,
} from '../../src/validations/sellProduct.validation.js';

describe('SellProduct Zod Validations', () => {
  it('should pass createSellProductSchema with valid payload', () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const payload = {
      sellId: 'SODR03245',
      saleType: 'Other Retailer',
      retailer: validObjectId,
      items: [
        {
          product: validObjectId,
          productName: 'Product 1',
          mrp: 110,
          sellingPrice: 100,
          quantity: 5,
          unit: validObjectId,
          gstPercentage: 12,
        },
      ],
      discountType: 'flat',
      discountValue: 0,
      payments: [
        {
          paymentDate: '2026-08-06',
          paymentMode: 'Cash',
          amount: 1300,
        },
      ],
    };

    const result = createSellProductSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sellId).toBe('SODR03245');
      expect(result.data.saleType).toBe('Other Retailer');
      expect(result.data.items.length).toBe(1);
    }
  });

  it('should fail createSellProductSchema with empty items array', () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const payload = {
      sellId: 'SODR03245',
      saleType: 'Own Store',
      store: validObjectId,
      items: [],
    };

    const result = createSellProductSchema.body.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should pass addSellPaymentSchema with valid payment details', () => {
    const payload = {
      paymentDate: '2026-08-08',
      paymentMode: 'UPI',
      amount: 500,
      transactionId: 'TXN123456',
    };

    const result = addSellPaymentSchema.body.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe('SellProduct & Payment Mongoose Models', () => {
  it('should format SellProduct model correctly', () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const doc = new SellProduct({
      sellId: 'SODR03245',
      saleType: 'Own Store',
      store: validObjectId,
      items: [
        {
          product: validObjectId,
          productName: 'Product 1',
          mrp: 110,
          sellingPrice: 100,
          quantity: 5,
          unit: validObjectId,
          gstPercentage: 12,
          totalAmount: 560,
        },
      ],
      totalItems: 1,
      grossAmount: 550,
      savings: 50,
      gstAmount: 60,
      netAmount: 560,
      createdBy: validObjectId,
    });

    expect(doc.sellId).toBe('SODR03245');
    expect(doc.status).toBe('Completed');
    expect(doc.paymentStatus).toBe('Unpaid');
    expect(doc.isDeleted).toBe(false);
  });

  it('should format SellProductPayment model correctly', () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const paymentDoc = new SellProductPayment({
      sellInvoice: validObjectId,
      paymentMode: 'Cash',
      amount: 1300,
      createdBy: validObjectId,
    });

    expect(paymentDoc.amount).toBe(1300);
    expect(paymentDoc.paymentMode).toBe('Cash');
    expect(paymentDoc.isDeleted).toBe(false);
  });
});
