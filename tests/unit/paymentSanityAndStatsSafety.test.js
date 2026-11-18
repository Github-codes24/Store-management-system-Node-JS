import { jest } from '@jest/globals';

describe('Billing Payment Sanity Check and Stats Calculation Safety', () => {
  describe('Bill Save Payment Amount Sanity Check Logic', () => {
    const validatePayments = (payments, finalNetAmount) => {
      if (Array.isArray(payments) && payments.length > 0) {
        for (const p of payments) {
          const pAmt = Number(p.amount) || 0;
          if (pAmt < 0 || pAmt > 1000000 || pAmt > (finalNetAmount * 2)) {
            return {
              status: 400,
              body: {
                success: false,
                message: `Invalid payment amount for mode ${p.mode}: ₹${pAmt}. Payment cannot exceed bill amount.`,
              },
            };
          }
        }
      }
      return null;
    };

    it('should reject astronomical payment amount scanned from barcode into UPI field', () => {
      const finalNetAmount = 1680.30;
      const barcodeNumber = 8.90073538181389e+38;
      const payments = [{ mode: 'UPI', amount: barcodeNumber }];

      const res = validatePayments(payments, finalNetAmount);
      expect(res).not.toBeNull();
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid payment amount for mode UPI');
      expect(res.body.message).toContain('Payment cannot exceed bill amount');
    });

    it('should reject negative payment amounts', () => {
      const finalNetAmount = 500;
      const payments = [{ mode: 'Cash', amount: -100 }];

      const res = validatePayments(payments, finalNetAmount);
      expect(res).not.toBeNull();
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid payment amount for mode Cash: ₹-100');
    });

    it('should reject payment amounts exceeding reasonable bill threshold (finalNetAmount * 2)', () => {
      const finalNetAmount = 500;
      const payments = [{ mode: 'UPI', amount: 1200 }]; // 1200 > 500 * 2

      const res = validatePayments(payments, finalNetAmount);
      expect(res).not.toBeNull();
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid payment amount for mode UPI: ₹1200');
    });

    it('should allow valid payment amounts within allowable bill threshold', () => {
      const finalNetAmount = 1680.30;
      const payments = [{ mode: 'UPI', amount: 1680.30 }];

      const res = validatePayments(payments, finalNetAmount);
      expect(res).toBeNull();
    });

    it('should allow valid split payments within threshold', () => {
      const finalNetAmount = 1000;
      const payments = [
        { mode: 'Cash', amount: 400 },
        { mode: 'UPI', amount: 600 },
      ];

      const res = validatePayments(payments, finalNetAmount);
      expect(res).toBeNull();
    });
  });

  describe('calculateOrderPaymentStats Safety Logic', () => {
    const calculateOrderPaymentStats = (orders = []) => {
      let totalCash = 0;
      let totalUPI = 0;
      let totalCard = 0;

      for (const o of orders) {
        let oCash = 0;
        let oUpi = 0;
        let oCard = 0;
        const paymentsList = (Array.isArray(o.payments) && o.payments.length > 0)
          ? o.payments
          : (Array.isArray(o.bills?.[0]?.payments) && o.bills[0].payments.length > 0)
          ? o.bills[0].payments
          : [];

        const bill = o.bills?.[0] || {};
        const netAmount = Number(bill.netAmount ?? o.totalOrderNet ?? 0);
        const refunded = Number(bill.totalRefunded || o.totalOrderRefunded || 0);
        const effective = Math.max(0, netAmount - refunded);
        const safeNet = netAmount > 0 ? netAmount : 1000000;

        if (paymentsList.length > 0) {
          for (const p of paymentsList) {
            const mode = (p.mode || '').trim().toLowerCase();
            const amt = Math.min(Math.max(0, Number(p.amount) || 0), safeNet);
            if (mode === 'cash') oCash += amt;
            else if (mode === 'upi') oUpi += amt;
            else if (mode === 'card' || mode.includes('card')) oCard += amt;
          }
        }

        const rawPaid = Number(bill.paidAmount ?? o.totalOrderPaid ?? effective);
        const paid = Math.min(Math.max(0, rawPaid), safeNet);

        if (oCash === 0 && oUpi === 0 && oCard === 0 && paid > 0) {
          const method = (bill.paymentMethod || o.paymentMethod || '').trim().toLowerCase();
          if (method === 'cash') oCash = paid;
          else if (method === 'upi') oUpi = paid;
          else if (method === 'card' || method.includes('card')) oCard = paid;
          else if (effective > 0) oCash = paid;
        }

        const maxPayable = effective > 0 ? effective : (netAmount > 0 ? netAmount : 0);
        const recorded = oCash + oUpi + oCard;
        if (maxPayable > 0 && recorded > maxPayable) {
          const ratio = maxPayable / recorded;
          oCash *= ratio;
          oUpi *= ratio;
          oCard *= ratio;
        }

        totalCash += oCash;
        totalUPI += oUpi;
        totalCard += oCard;
      }

      return {
        totalCash: Math.round(totalCash * 100) / 100,
        totalUPI: Math.round(totalUPI * 100) / 100,
        totalCard: Math.round(totalCard * 100) / 100,
        totalAmount: Math.round((totalCash + totalUPI + totalCard) * 100) / 100,
      };
    };

    it('should prevent astronomical numbers in existing DB order from corrupting aggregate UPI stats', () => {
      const orders = [
        // Order 1: Normal order
        {
          orderId: 'SODR08406',
          totalOrderNet: 500,
          payments: [{ mode: 'UPI', amount: 500 }],
        },
        // Order 2: SODR08407 with astronomical barcode scan stored in payments array
        {
          orderId: 'SODR08407',
          totalOrderNet: 1680.30,
          bills: [{ netAmount: 1680.30 }],
          payments: [{ mode: 'UPI', amount: 8.90073538181389e+38 }],
        },
        // Order 3: Normal cash order
        {
          orderId: 'SODR08408',
          totalOrderNet: 200,
          payments: [{ mode: 'Cash', amount: 200 }],
        },
      ];

      const stats = calculateOrderPaymentStats(orders);

      // Order 2 UPI amount should be capped at netAmount 1680.30
      // Total UPI = 500 + 1680.30 = 2180.30 (NOT 8.9e+38!)
      expect(stats.totalUPI).toBe(2180.3);
      expect(stats.totalCash).toBe(200);
      expect(stats.totalAmount).toBe(2380.3);
    });

    it('should sanitize paidAmount fallback when payments array is empty and paidAmount was corrupt', () => {
      const orders = [
        {
          orderId: 'SODR08407',
          totalOrderNet: 1680.30,
          bills: [
            {
              netAmount: 1680.30,
              paymentMethod: 'UPI',
              paidAmount: 8.90073538181389e+38,
              payments: [],
            },
          ],
        },
      ];

      const stats = calculateOrderPaymentStats(orders);
      expect(stats.totalUPI).toBe(1680.3);
      expect(stats.totalAmount).toBe(1680.3);
    });

    it('should correctly handle refund scaling along with sanitization', () => {
      const orders = [
        {
          orderId: 'ORD-REFUND',
          totalOrderNet: 1000,
          bills: [
            {
              netAmount: 1000,
              totalRefunded: 300,
              payments: [{ mode: 'UPI', amount: 1000 }],
            },
          ],
        },
      ];

      const stats = calculateOrderPaymentStats(orders);
      // Effective net is 700 (1000 - 300)
      expect(stats.totalUPI).toBe(700);
      expect(stats.totalAmount).toBe(700);
    });
  });
});
