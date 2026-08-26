import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminProduct',
      required: [true, 'Product is required'],
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    offlineSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    onlineSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required'],
    },
    gstPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const productPurchaseInvoiceSchema = new mongoose.Schema(
  {
    purchaseId: {
      type: String,
      required: [true, 'Purchase ID is required'],
      trim: true,
    },
    billDate: {
      type: Date,
      required: [true, 'Bill date is required'],
      default: Date.now,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Distributor',
      required: [true, 'Distributor is required'],
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one purchase item is required',
      },
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'flat',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid',
    },
    status: {
      type: String,
      enum: ['Draft', 'Completed', 'Cancelled'],
      default: 'Completed',
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

productPurchaseInvoiceSchema.index({ purchaseId: 1, isDeleted: 1 });
productPurchaseInvoiceSchema.index({ distributor: 1, isDeleted: 1 });
productPurchaseInvoiceSchema.index({ billDate: -1 });

const ProductPurchaseInvoice = mongoose.model(
  'ProductPurchaseInvoice',
  productPurchaseInvoiceSchema
);

export default ProductPurchaseInvoice;
