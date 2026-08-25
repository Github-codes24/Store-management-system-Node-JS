import mongoose from 'mongoose';

const taxSchema = new mongoose.Schema(
  {
    productType: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    subcategory: {
      type: String,
      required: true,
      trim: true,
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