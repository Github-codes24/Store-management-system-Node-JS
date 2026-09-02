import mongoose from 'mongoose';

const batchItemSchema = new mongoose.Schema(
  {
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Batch stock cannot be negative'],
    },
    mrp: {
      type: Number,
      default: 0,
    },
    offlineSellingPrice: {
      type: Number,
      default: 0,
    },
    onlineSellingPrice: {
      type: Number,
      default: 0,
    },
    manufactureDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);

const storeProductSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      trim: true,
    },
    productImage: {
      type: String,
      default: null,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    productType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductType',
      required: [true, 'Product type is required'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcategory',
      required: [true, 'Subcategory is required'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand is required'],
    },
    batchType: {
      type: String,
      enum: ['Old Batch', 'New Batch'],
      default: 'New Batch',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    // Product-specific batches array
    batches: [batchItemSchema],
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required'],
    },
    piece: {
      type: Number,
      default: 1,
      min: [0, 'Piece cannot be negative'],
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      default: 0,
      min: [0, 'Stock quantity cannot be negative'],
    },
    minStockAlert: {
      type: Number,
      default: 0,
      min: [0, 'Minimum stock alert cannot be negative'],
    },
    alertQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Alert quantity cannot be negative'],
    },
    reorderPoint: {
      type: Number,
      default: 0,
      min: [0, 'Reorder point cannot be negative'],
    },
    mrp: {
      type: Number,
      required: [true, 'MRP is required'],
      min: [0, 'MRP cannot be negative'],
    },
    offlineSellingPrice: {
      type: Number,
      required: [true, 'Offline selling price is required'],
      min: [0, 'Offline selling price cannot be negative'],
    },
    onlineSellingPrice: {
      type: Number,
      required: [true, 'Online selling price is required'],
      min: [0, 'Online selling price cannot be negative'],
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    taxType: {
      type: String,
      enum: ['GST Invoice', 'Non GST'],
      default: 'GST Invoice',
    },
    gstPercentage: {
      type: Number,
      default: 0,
      min: [0, 'GST percentage cannot be negative'],
      max: [100, 'GST percentage cannot exceed 100'],
    },
    cgstPercentage: {
      type: Number,
      default: 0,
      min: [0, 'CGST percentage cannot be negative'],
      max: [100, 'CGST percentage cannot exceed 100'],
    },
    sgstPercentage: {
      type: Number,
      default: 0,
      min: [0, 'SGST percentage cannot be negative'],
      max: [100, 'SGST percentage cannot exceed 100'],
    },
    manufactureDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    hsnCode: {
      type: String,
      trim: true,
      default: null,
    },
    // Dynamic attributes array
    attributes: [
      {
        attributeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attribute',
        },
        attributeKey: {
          type: String,
          trim: true,
        },
        displayLabel: {
          type: String,
          trim: true,
        },
        fieldType: {
          type: String,
          trim: true,
        },
        value: {
          type: mongoose.Schema.Types.Mixed,
        },
      },
    ],
    // Store scoping
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreEmployee',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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

// Sync alertQuantity and minStockAlert pre-save
storeProductSchema.pre('save', function (next) {
  if (this.alertQuantity !== undefined && (this.minStockAlert === undefined || this.minStockAlert === 0)) {
    this.minStockAlert = this.alertQuantity;
  } else if (this.minStockAlert !== undefined && (this.alertQuantity === undefined || this.alertQuantity === 0)) {
    this.alertQuantity = this.minStockAlert;
  }
  next();
});

// Indexes for fast lookup
storeProductSchema.index({ barcode: 1, isDeleted: 1 });
storeProductSchema.index({ storeId: 1, isDeleted: 1 });
storeProductSchema.index({ productName: 'text', barcode: 'text' });
storeProductSchema.index({ category: 1, isDeleted: 1 });
storeProductSchema.index({ subcategory: 1, isDeleted: 1 });
storeProductSchema.index({ brand: 1, isDeleted: 1 });

const StoreProduct = mongoose.model('StoreProduct', storeProductSchema);

export default StoreProduct;
