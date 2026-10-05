import crypto from 'crypto';
import razorpayInstance from '../../config/razorpay.js';
import env from '../../config/env.js';
import StoreOrder from '../../models/storeOrder.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, internal, notFound } from '../../utils/api-error.js';

/**
 * 1. Create Razorpay Order
 * POST /api/customer/payments/create-order or /api/create-order
 * Body: { amount (Rupees e.g. 150.00), currency, receipt, notes }
 */
export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', receipt, storeOrderId, notes = {} } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return next(badRequest('Valid payment amount is required'));
    }

    // Convert Rupees to Paise
    const amountInPaise = Math.round(Number(amount) * 100);

    if (amountInPaise < 100) {
      return next(badRequest('Minimum payment amount must be at least ₹1 (100 paise)'));
    }

    const receiptId = receipt || (storeOrderId ? `rcpt_${storeOrderId}` : `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    const orderNotes = {
      ...notes,
      ...(storeOrderId ? { storeOrderId } : {}),
    };

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: receiptId,
      notes: orderNotes,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    return res.status(201).json(
      successResponse({
        message: 'Razorpay order created successfully',
        data: {
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          storeOrderId: storeOrderId || null,
          keyId: env.RAZORPAY_KEY_ID,
        },
      })
    );
  } catch (error) {
    console.error('[Razorpay Order Creation Error]:', error);
    const errMsg = error?.message || error?.description || 'Gateway error';
    return next(internal(`Razorpay order creation failed: ${errMsg}`));
  }
};

/**
 * 2. Verify Razorpay Payment Signature
 * POST /api/customer/payments/verify-payment or /api/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, storeOrderId }
 */
export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      storeOrderId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(badRequest('Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)'));
    }

    // Generate expected HMAC-SHA256 signature
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    // Timing-safe comparison
    const genSigBuf = Buffer.from(generatedSignature, 'utf-8');
    const recSigBuf = Buffer.from(razorpay_signature, 'utf-8');

    let isValid = false;
    if (genSigBuf.length === recSigBuf.length) {
      isValid = crypto.timingSafeEqual(genSigBuf, recSigBuf);
    }

    if (!isValid) {
      return next(badRequest('Payment verification failed: Signature mismatch'));
    }

    // Auto-resolve target storeOrderId from body or fallback to Razorpay order notes / receipt
    let targetStoreOrderId = storeOrderId;
    if (!targetStoreOrderId && razorpay_order_id) {
      try {
        const rzpOrder = await razorpayInstance.orders.fetch(razorpay_order_id);
        if (rzpOrder?.notes?.storeOrderId) {
          targetStoreOrderId = rzpOrder.notes.storeOrderId;
        } else if (rzpOrder?.receipt && rzpOrder.receipt.startsWith('rcpt_')) {
          targetStoreOrderId = rzpOrder.receipt.replace(/^rcpt_/, '');
        }
      } catch (fetchErr) {
        console.warn('[Razorpay Fetch Order Note]:', fetchErr.message);
      }
    }

    // Update StoreOrder payment status to Paid when targetStoreOrderId is resolved
    let orderDetails = null;
    if (targetStoreOrderId) {
      const order = await StoreOrder.findOne({
        $or: [
          { _id: targetStoreOrderId.match(/^[0-9a-fA-F]{24}$/) ? targetStoreOrderId : null },
          { orderId: targetStoreOrderId },
        ],
      });

      if (order) {
        if (Array.isArray(order.bills) && order.bills.length > 0) {
          order.bills[0].paymentStatus = 'Paid';
          order.bills[0].paymentMethod = 'UPI';
          order.bills[0].paidAmount = order.bills[0].netAmount;
          order.bills[0].dueAmount = 0;
          order.bills[0].payments.push({
            date: new Date().toISOString(),
            mode: 'UPI',
            amount: order.bills[0].netAmount,
            transactionId: razorpay_payment_id,
            description: `Razorpay Online Payment (Order: ${razorpay_order_id})`,
          });
        }
        order.totalOrderPaid = order.totalOrderNet;
        await order.save();
        orderDetails = {
          orderId: order._id,
          orderNumber: order.orderId,
          orderStatus: order.orderStatus,
          totalAmount: order.totalOrderNet,
          customerName: order.customer?.name || '',
          items: (order.bills[0]?.items || []).map((it) => ({
            productId: it.product,
            productName: it.productName,
            quantity: it.quantity,
            sellingPrice: it.sellingPrice,
            totalAmount: it.totalAmount,
          })),
        };
      }
    }

    return res.status(200).json(
      successResponse({
        message: 'Razorpay payment verified successfully',
        data: {
          isPaid: true,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          orderDetails,
        },
      })
    );
  } catch (error) {
    console.error('[Razorpay Signature Verification Error]:', error);
    const errMsg = error?.message || 'Verification error';
    return next(internal(`Razorpay payment verification failed: ${errMsg}`));
  }
};

/**
 * 3. Check Payment Status
 * GET /api/customer/payments/status/:orderId or /api/payment-status/:orderId
 * OrderId can be Store Order ID (e.g. SODR01954), Mongo _id, or Razorpay Order ID (e.g. order_TjJxhaawj3W2U1)
 */
export const getRazorpayPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return next(badRequest('Order ID parameter is required'));
    }

    // 1. Search in StoreOrder database
    const storeOrder = await StoreOrder.findOne({
      $or: [
        { _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null },
        { orderId },
      ],
    }).lean();

    if (storeOrder) {
      const bill = storeOrder.bills[0] || {};
      const isPaid = bill.paymentStatus === 'Paid' || storeOrder.totalOrderPaid >= storeOrder.totalOrderNet;

      return res.status(200).json(
        successResponse({
          message: 'Payment status retrieved from database',
          data: {
            orderId: storeOrder._id,
            orderNumber: storeOrder.orderId,
            paymentStatus: bill.paymentStatus || (isPaid ? 'Paid' : 'Unpaid'),
            isPaid,
            totalAmount: storeOrder.totalOrderNet,
            paidAmount: storeOrder.totalOrderPaid,
            dueAmount: bill.dueAmount ?? Math.max(0, storeOrder.totalOrderNet - storeOrder.totalOrderPaid),
            paymentMethod: bill.paymentMethod || 'UPI',
            payments: storeOrder.payments || [],
            items: (bill.items || []).map((it) => ({
              productId: it.product,
              productName: it.productName,
              quantity: it.quantity,
              sellingPrice: it.sellingPrice,
              totalAmount: it.totalAmount,
            })),
          },
        })
      );
    }

    // 2. Fallback: Query Razorpay Gateway directly if razorpay orderId passed
    if (orderId.startsWith('order_')) {
      const rzpOrder = await razorpayInstance.orders.fetch(orderId);
      const isPaid = rzpOrder.status === 'paid';

      return res.status(200).json(
        successResponse({
          message: 'Payment status retrieved from Razorpay Gateway',
          data: {
            razorpayOrderId: rzpOrder.id,
            amount: rzpOrder.amount / 100,
            currency: rzpOrder.currency,
            status: rzpOrder.status,
            isPaid,
            receipt: rzpOrder.receipt,
            notes: rzpOrder.notes,
          },
        })
      );
    }

    return next(notFound(`Order '${orderId}' not found in database or Razorpay`));
  } catch (error) {
    console.error('[Payment Status Error]:', error);
    return next(internal(`Failed to fetch payment status: ${error.message}`));
  }
};
