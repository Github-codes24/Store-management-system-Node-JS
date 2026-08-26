import mongoose from 'mongoose';

const adminProductSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: [true, 'Barcode is required'],
      trim: true,
      // Note: No unique: true index at Mongoose level to prevent soft-delete collisions.
      // Uniqueness for active products is checked logically in application layer.
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
    mrp: {
      type: Number,
      required: [true, 'MRP is required'],
      min: [0, 'MRP cannot be negative'],
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
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
    taxType: {
      type: String,
      enum: {
        values: ['GST Invoice', 'Non GST'],
        message: 'Invalid tax type',
      },
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
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required'],
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock quantity cannot be negative'],
    },
    minStockAlert: {
      type: Number,
      default: 0,
      min: [0, 'Minimum stock alert cannot be negative'],
    },
    reorderPoint: {
      type: Number,
      default: 0,
      min: [0, 'Reordering point cannot be negative'],
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
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Invalid status',
      },
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

// Search indexes
adminProductSchema.index({ barcode: 1, isDeleted: 1 });
adminProductSchema.index({ productName: 'text', hsnCode: 'text' });
adminProductSchema.index({ category: 1, isDeleted: 1 });
adminProductSchema.index({ brand: 1, isDeleted: 1 });

const AdminProduct = mongoose.model('AdminProduct', adminProductSchema);

export default AdminProduct;
