import mongoose from 'mongoose';

const taxSchema = new mongoose.Schema(
  {
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
    cgst: {
      type: Number,
      required: [true, 'CGST percentage is required'],
      min: [0, 'CGST cannot be negative'],
      max: [100, 'CGST cannot be more than 100%'],
    },
    sgst: {
      type: Number,
      required: [true, 'SGST percentage is required'],
      min: [0, 'SGST cannot be negative'],
      max: [100, 'SGST cannot be more than 100%'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

const Tax = mongoose.model('Tax', taxSchema);

export default Tax;
