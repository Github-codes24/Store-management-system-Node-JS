import crypto from 'crypto';

const secret = process.env.RAZORPAY_KEY_SECRET || 'RGQWnuEMYJvM1C7VzJLC626F';
const orderId = process.argv[2] || 'order_PK1234567890ab';
const paymentId = process.argv[3] || `pay_test_${Date.now()}`;

const payload = `${orderId}|${paymentId}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

console.log('==================================================');
console.log('  RAZORPAY TEST SIGNATURE GENERATOR');
console.log('==================================================');
console.log('1. Razorpay Order ID  :', orderId);
console.log('2. Razorpay Payment ID:', paymentId);
console.log('3. Valid Signature    :', signature);
console.log('==================================================\n');
console.log('JSON Payload for POST /api/verify-payment:');
console.log(
  JSON.stringify(
    {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    },
    null,
    2
  )
);
