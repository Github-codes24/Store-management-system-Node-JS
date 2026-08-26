import mongoose from 'mongoose';

const productPurchasePaymentSchema = new mongoose.Schema(
  {
    purchaseInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductPurchaseInvoice',
      required: [true, 'Purchase invoice ID is required'],
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
    },
    paymentMode: {
      type: String,
      required: [true, 'Payment mode is required'],
      enum: {
        values: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'],
        message: 'Invalid payment mode',
      },
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    transactionId: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

productPurchasePaymentSchema.index({ purchaseInvoice: 1, isDeleted: 1 });
productPurchasePaymentSchema.index({ paymentDate: -1 });

const ProductPurchasePayment = mongoose.model(
  'ProductPurchasePayment',
  productPurchasePaymentSchema
);

export default ProductPurchasePayment;
