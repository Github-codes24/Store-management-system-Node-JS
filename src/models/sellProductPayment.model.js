import mongoose from 'mongoose';

const sellProductPaymentSchema = new mongoose.Schema(
  {
    sellInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellProduct',
      required: [true, 'Sell invoice ID is required'],
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

sellProductPaymentSchema.index({ sellInvoice: 1, isDeleted: 1 });
sellProductPaymentSchema.index({ paymentDate: -1 });

const SellProductPayment = mongoose.model('SellProductPayment', sellProductPaymentSchema);

export default SellProductPayment;
