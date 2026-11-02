import mongoose from 'mongoose';
import StoreOrder from '../../src/models/storeOrder.model.js';

describe('Cash Tendered and Change Return Model Logic', () => {
  it('should correctly store tenderedAmount and changeReturn on bill and order', () => {
    const mockOrder = new StoreOrder({
      orderId: 'ORD-TEST-TENDER',
      customer: { name: 'Walk-in Customer' },
      bills: [
        {
          billId: 'INV-TEST-TENDER-1',
          billNumber: 1,
          saleType: 'Offline',
          items: [
            {
              product: new mongoose.Types.ObjectId(),
              productName: 'Test Product 100',
              sellingPrice: 114,
              quantity: 1,
              totalAmount: 114,
              returnedQuantity: 0,
            },
          ],
          subtotal: 114,
          netAmount: 114,
          paidAmount: 114,
          dueAmount: 0,
          tenderedAmount: 1200,
          changeReturn: 1086,
          paymentStatus: 'Paid',
          paymentMethod: 'Cash',
          payments: [
            {
              mode: 'Cash',
              amount: 114,
              description: 'Cash Tendered: ₹1200, Change: ₹1086',
            },
          ],
        },
      ],
      totalOrderNet: 114,
      totalOrderPaid: 114,
      totalOrderTendered: 1200,
      totalOrderChangeReturn: 1086,
      orderStatus: 'Completed',
    });

    expect(mockOrder.bills[0].netAmount).toBe(114);
    expect(mockOrder.bills[0].paidAmount).toBe(114);
    expect(mockOrder.bills[0].tenderedAmount).toBe(1200);
    expect(mockOrder.bills[0].changeReturn).toBe(1086);
    expect(mockOrder.bills[0].payments[0].amount).toBe(114);
    expect(mockOrder.totalOrderTendered).toBe(1200);
    expect(mockOrder.totalOrderChangeReturn).toBe(1086);
  });

  it('should default tenderedAmount and changeReturn to 0 when not provided', () => {
    const mockOrder = new StoreOrder({
      orderId: 'ORD-EXACT',
      customer: { name: 'Exact Customer' },
      bills: [
        {
          billId: 'INV-EXACT-1',
          billNumber: 1,
          items: [
            {
              product: new mongoose.Types.ObjectId(),
              productName: 'Biscuits',
              sellingPrice: 50,
              quantity: 1,
              totalAmount: 50,
            },
          ],
          subtotal: 50,
          netAmount: 50,
          paidAmount: 50,
          dueAmount: 0,
        },
      ],
    });

    expect(mockOrder.bills[0].tenderedAmount).toBe(0);
    expect(mockOrder.bills[0].changeReturn).toBe(0);
    expect(mockOrder.totalOrderTendered).toBe(0);
    expect(mockOrder.totalOrderChangeReturn).toBe(0);
  });
});

