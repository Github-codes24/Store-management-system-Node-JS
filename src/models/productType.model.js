import mongoose from 'mongoose';

const productTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product Type name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

const ProductType = mongoose.model('ProductType', productTypeSchema);

export default ProductType;
