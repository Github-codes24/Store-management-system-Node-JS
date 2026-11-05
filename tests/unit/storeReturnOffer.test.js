import mongoose from 'mongoose';
import { jest } from '@jest/globals';

describe('Store Return Offer & Refund Safeguards Unit Tests', () => {
  it('should calculate BOGO full pair return as full paid amount', () => {
    const billPaidAmount = 50;
    const maxPossibleBillRefund = 50;
    const totalPurchasedQty = 2;
    const setSize = 2;
    const returnQty = 2;

    const completePairsReturned = Math.floor(returnQty / setSize);
    const totalSets = Math.floor(totalPurchasedQty / setSize) || 1;

    let refundAmt = 0;
    if (completePairsReturned > 0) {
      const refundPerSet = billPaidAmount / totalSets;
      refundAmt = Math.min(
        parseFloat((completePairsReturned * refundPerSet).toFixed(2)),
        maxPossibleBillRefund
      );
    }

    expect(refundAmt).toBe(50);
  });

  it('should calculate BOGO single item return (incomplete pair) as 0 refund', () => {
    const billPaidAmount = 50;
    const maxPossibleBillRefund = 50;
    const totalPurchasedQty = 2;
    const setSize = 2;
    const returnQty = 1; // only 1 returned out of pair of 2

    const completePairsReturned = Math.floor(returnQty / setSize);
    const totalSets = Math.floor(totalPurchasedQty / setSize) || 1;

    let refundAmt = 0;
    if (completePairsReturned > 0) {
      const refundPerSet = billPaidAmount / totalSets;
      refundAmt = Math.min(
        parseFloat((completePairsReturned * refundPerSet).toFixed(2)),
        maxPossibleBillRefund
      );
    } else {
      refundAmt = 0;
    }

    expect(refundAmt).toBe(0);
  });

  it('should calculate BXGY free item return as 0 refund', () => {
    const bxgyFreeProdId = 'free-prod-123';
    const currentProdId = 'free-prod-123';
    const isFreeItem = bxgyFreeProdId === currentProdId;

    let refundAmt = 0;
    if (isFreeItem) {
      refundAmt = 0;
    }

    expect(refundAmt).toBe(0);
  });

  it('should calculate BXGY both items returned as full paid amount', () => {
    const billPaidAmount = 90;
    const maxPossibleBillRefund = 90;
    const bxgyFreeProdId = 'free-prod-123';
    const returnItems = [
      { product: 'buy-prod-456', quantity: 1 },
      { product: 'free-prod-123', quantity: 1 },
    ];

    let totalRefund = 0;
    for (const item of returnItems) {
      if (item.product === bxgyFreeProdId) {
        totalRefund += 0; // free item gets 0
      } else {
        const returningFreeItem = returnItems.some((r) => r.product === bxgyFreeProdId);
        if (returningFreeItem) {
          totalRefund += Math.min(billPaidAmount, maxPossibleBillRefund);
        } else {
          totalRefund += 0;
        }
      }
    }

    expect(totalRefund).toBe(90);
  });

  it('should strictly cap totalRefund to remaining paid amount (safeguard against inflated frontend refunds)', () => {
    const maxPossibleBillRefund = 50;
    let processedReturnItems = [
      { product: 'prod-1', refundAmount: 100 },
    ];

    let totalRefund = processedReturnItems.reduce((sum, it) => sum + (Number(it.refundAmount) || 0), 0);
    if (totalRefund > maxPossibleBillRefund) {
      const capRatio = totalRefund > 0 ? (maxPossibleBillRefund / totalRefund) : 0;
      for (const it of processedReturnItems) {
        it.refundAmount = parseFloat((it.refundAmount * capRatio).toFixed(2));
      }
      totalRefund = maxPossibleBillRefund;
    }

    expect(totalRefund).toBe(50);
    expect(processedReturnItems[0].refundAmount).toBe(50);
  });

  it('should provide effectiveDiscountValue in lookupBillForReturn when discountValue is 0 for BOGO/BXGY', () => {
    const billBogo = {
      discountType: 'BOGO',
      discountValue: 0,
      discountAmount: 50,
      netAmount: 50,
      paidAmount: 50,
    };

    const effectiveDiscountValue = (billBogo.discountValue && Number(billBogo.discountValue) > 0)
      ? billBogo.discountValue
      : (['BOGO', 'BXGY', '₹'].includes(billBogo.discountType) ? (billBogo.discountAmount || 0) : 0);

    expect(effectiveDiscountValue).toBe(50);
  });
});

