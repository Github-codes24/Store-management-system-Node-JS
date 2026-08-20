import mongoose from 'mongoose';
import { DISTRIBUTOR_VALIDATION } from '../constants/distributor.constants.js';

const distributorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Distributor name is required'],
      trim: true,
      minlength: [DISTRIBUTOR_VALIDATION.NAME.MIN, `Distributor name must be at least ${DISTRIBUTOR_VALIDATION.NAME.MIN} characters`],
      maxlength: [DISTRIBUTOR_VALIDATION.NAME.MAX, `Distributor name cannot exceed ${DISTRIBUTOR_VALIDATION.NAME.MAX} characters`],
    },
    salesperson: {
      type: String,
      trim: true,
      minlength: [DISTRIBUTOR_VALIDATION.SALESPERSON.MIN, `Salesperson name must be at least ${DISTRIBUTOR_VALIDATION.SALESPERSON.MIN} characters`],
      maxlength: [DISTRIBUTOR_VALIDATION.SALESPERSON.MAX, `Salesperson name cannot exceed ${DISTRIBUTOR_VALIDATION.SALESPERSON.MAX} characters`],
      default: null,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      minlength: [DISTRIBUTOR_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${DISTRIBUTOR_VALIDATION.MOBILE.MIN} digits`],
      maxlength: [DISTRIBUTOR_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${DISTRIBUTOR_VALIDATION.MOBILE.MAX} digits`],
      match: [DISTRIBUTOR_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      minlength: [DISTRIBUTOR_VALIDATION.EMAIL.MIN, `Email must be at least ${DISTRIBUTOR_VALIDATION.EMAIL.MIN} characters`],
      maxlength: [DISTRIBUTOR_VALIDATION.EMAIL.MAX, `Email cannot exceed ${DISTRIBUTOR_VALIDATION.EMAIL.MAX} characters`],
      match: [DISTRIBUTOR_VALIDATION.EMAIL.PATTERN, 'Invalid email format'],
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: [DISTRIBUTOR_VALIDATION.GSTIN.MIN, `GSTIN must be exactly ${DISTRIBUTOR_VALIDATION.GSTIN.MIN} characters`],
      maxlength: [DISTRIBUTOR_VALIDATION.GSTIN.MAX, `GSTIN must be exactly ${DISTRIBUTOR_VALIDATION.GSTIN.MAX} characters`],
      match: [DISTRIBUTOR_VALIDATION.GSTIN.PATTERN, 'Invalid GSTIN format'],
      default: null,
    },
    address: {
      type: String,
      trim: true,
      minlength: [DISTRIBUTOR_VALIDATION.ADDRESS.MIN, `Address must be at least ${DISTRIBUTOR_VALIDATION.ADDRESS.MIN} characters`],
      maxlength: [DISTRIBUTOR_VALIDATION.ADDRESS.MAX, `Address cannot exceed ${DISTRIBUTOR_VALIDATION.ADDRESS.MAX} characters`],
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: DISTRIBUTOR_VALIDATION.STATUS.ENUM,
        message: 'Invalid distributor status',
      },
      default: DISTRIBUTOR_VALIDATION.STATUS.DEFAULT,
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

// Indexes for optimized searching and filtering
distributorSchema.index({ name: 'text', salesperson: 'text', email: 'text', mobile: 'text', gstin: 'text' });
distributorSchema.index({ email: 1, isDeleted: 1 });
distributorSchema.index({ gstin: 1, isDeleted: 1 });

const Distributor = mongoose.model('Distributor', distributorSchema);

export default Distributor;
