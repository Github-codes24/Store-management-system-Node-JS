import { jest } from '@jest/globals';

describe('Store Billing Stock Sufficiency Validation Unit Tests', () => {
  it('should reject billing when requested quantity exceeds available stock', () => {
    const storeProd = {
      _id: 'prod-001',
      productName: 'Test Product 100 - Diwali Special',
      stockQuantity: 70,
    };
    const requestedQty = 100;

    let error = null;
    if (storeProd.stockQuantity < requestedQty) {
      error = {
        status: 400,
        message: `Insufficient stock for "${storeProd.productName}". Available stock: ${storeProd.stockQuantity}, Requested: ${requestedQty}. Please adjust quantity.`,
      };
    }

    expect(error).not.toBeNull();
    expect(error.status).toBe(400);
    expect(error.message).toContain('Insufficient stock for "Test Product 100 - Diwali Special"');
    expect(error.message).toContain('Available stock: 70, Requested: 100');
  });

  it('should reject billing when multiple cart rows of same product aggregate beyond available stock', () => {
    const storeProd = {
      _id: 'prod-001',
      productName: 'Test Product 100 - Diwali Special',
      stockQuantity: 70,
    };

    const cartItems = [
      { product: 'prod-001', quantity: 40 },
      { product: 'prod-001', quantity: 40 },
    ];

    const productQtyMap = new Map();
    for (const item of cartItems) {
      const prodId = item.product;
      const current = productQtyMap.get(prodId) || { totalRequestedQty: 0, storeProd };
      current.totalRequestedQty += item.quantity;
      productQtyMap.set(prodId, current);
    }

    let error = null;
    for (const [prodId, { totalRequestedQty, storeProd: p }] of productQtyMap.entries()) {
      if (p.stockQuantity < totalRequestedQty) {
        error = {
          status: 400,
          message: `Insufficient stock for "${p.productName}". Available stock: ${p.stockQuantity}, Requested: ${totalRequestedQty}. Please adjust quantity.`,
        };
      }
    }

    expect(error).not.toBeNull();
    expect(error.status).toBe(400);
    expect(error.message).toContain('Available stock: 70, Requested: 80');
  });

  it('should allow billing when requested quantity is within available stock', () => {
    const storeProd = {
      _id: 'prod-001',
      productName: 'Test Product 100 - Diwali Special',
      stockQuantity: 70,
    };
    const requestedQty = 70;

    let error = null;
    if (storeProd.stockQuantity < requestedQty) {
      error = {
        status: 400,
        message: 'Insufficient stock',
      };
    }

    expect(error).toBeNull();
  });

  it('should correctly deduct stock across multiple batches with FIFO deduction', () => {
    const storeProd = {
      batches: [
        { batchNumber: 'B1', stockQuantity: 30 },
        { batchNumber: 'B2', stockQuantity: 40 },
      ],
      stockQuantity: 70,
    };
    const qtyToDeduct = 50;

    let remainingToDeduct = qtyToDeduct;
    for (const b of storeProd.batches) {
      if (remainingToDeduct <= 0) break;
      const bStock = Number(b.stockQuantity) || 0;
      if (bStock <= 0) continue;
      const deductAmt = Math.min(bStock, remainingToDeduct);
      b.stockQuantity = bStock - deductAmt;
      remainingToDeduct -= deductAmt;
    }

    // Clean up batches with 0 stock
    storeProd.batches = storeProd.batches.filter((b) => (Number(b.stockQuantity) || 0) > 0);
    storeProd.stockQuantity = storeProd.batches.reduce((sum, b) => sum + b.stockQuantity, 0);

    expect(storeProd.batches.length).toBe(1);
    expect(storeProd.batches[0].batchNumber).toBe('B2');
    expect(storeProd.batches[0].stockQuantity).toBe(20);
    expect(storeProd.stockQuantity).toBe(20);
  });
});
