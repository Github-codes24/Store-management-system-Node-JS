import mongoose from 'mongoose';

const taxSchema = new mongoose.Schema(
  {
    productType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductType',
      required: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },

    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subcategory',
      required: true,
    },

    cgst: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    sgst: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
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