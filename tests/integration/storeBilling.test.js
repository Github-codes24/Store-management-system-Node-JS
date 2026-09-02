import mongoose from 'mongoose';
import StoreOrder from '../../src/models/storeOrder.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import { getCode128BitString } from '../../src/utils/barcode.util.js';

describe('Store Billing & Returns Multi-Bill Logic', () => {
  it('should generate valid Code128 bit sequence for barcodes', () => {
    const bitSeq = getCode128BitString('8903448120588');
    expect(typeof bitSeq).toBe('string');
    expect(bitSeq.length).toBeGreaterThan(50);
    expect(bitSeq.startsWith('1101')).toBe(true);
  });

  it('should validate StoreOrder model structure with multiple bills and returns', async () => {
    const mockOrderId = 'ORD-240829-9999';
    const mockOrder = new StoreOrder({
      orderId: mockOrderId,
      customer: {
        name: 'John Doe',
        phone: '9876543210',
      },
      bills: [
        {
          billId: 'INV-240829-9999-1',
          billNumber: 1,
          saleType: 'Offline',
          items: [
            {
              product: new mongoose.Types.ObjectId(),
              productName: 'T-Shirt',
              sellingPrice: 500,
              quantity: 2,
              totalAmount: 1000,
              returnedQuantity: 0,
            },
          ],
          subtotal: 1000,
          netAmount: 1000,
        },
      ],
      returns: [],
      totalOrderNet: 1000,
      orderStatus: 'Completed',
    });

    expect(mockOrder.bills.length).toBe(1);
    expect(mockOrder.bills[0].billId).toBe('INV-240829-9999-1');

    // Simulate appending second bill in same purchase session
    mockOrder.bills.push({
      billId: 'INV-240829-9999-2',
      billNumber: 2,
      saleType: 'Offline',
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          productName: 'Jeans',
          sellingPrice: 1200,
          quantity: 1,
          totalAmount: 1200,
          returnedQuantity: 0,
        },
      ],
      subtotal: 1200,
      netAmount: 1200,
    });
    mockOrder.totalOrderNet += 1200;

    expect(mockOrder.bills.length).toBe(2);
    expect(mockOrder.totalOrderNet).toBe(2200);

    // Simulate processing a return against Bill 1
    const bill1 = mockOrder.bills[0];
    bill1.items[0].returnedQuantity += 1;
    mockOrder.returns.push({
      returnId: 'RET-240829-9999-1',
      billId: bill1.billId,
      items: [
        {
          product: bill1.items[0].product,
          productName: bill1.items[0].productName,
          sellingPrice: 500,
          quantity: 1,
          refundAmount: 500,
          reason: 'Wrong Size',
        },
      ],
      totalRefundAmount: 500,
      refundMethod: 'Cash',
    });
    mockOrder.totalOrderRefunded = 500;
    mockOrder.orderStatus = 'Partially Returned';

    expect(mockOrder.returns.length).toBe(1);
    expect(mockOrder.returns[0].totalRefundAmount).toBe(500);
    expect(mockOrder.orderStatus).toBe('Partially Returned');
    expect(mockOrder.bills[0].items[0].returnedQuantity).toBe(1);
  });
});
