import mongoose from 'mongoose';
import { STORE_VALIDATION } from '../constants/store.constants.js';

const storeSchema = new mongoose.Schema(
  {
    storeCode: {
      type: String,
      required: [true, 'Store code is required'],
      trim: true,
      uppercase: true,
      minlength: [STORE_VALIDATION.STORE_CODE.MIN, `Store code must be at least ${STORE_VALIDATION.STORE_CODE.MIN} characters`],
      maxlength: [STORE_VALIDATION.STORE_CODE.MAX, `Store code cannot exceed ${STORE_VALIDATION.STORE_CODE.MAX} characters`],
      match: [STORE_VALIDATION.STORE_CODE.PATTERN, 'Invalid store code format'],
    },
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [STORE_VALIDATION.NAME.MIN, `Store name must be at least ${STORE_VALIDATION.NAME.MIN} characters`],
      maxlength: [STORE_VALIDATION.NAME.MAX, `Store name cannot exceed ${STORE_VALIDATION.NAME.MAX} characters`],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      minlength: [STORE_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${STORE_VALIDATION.MOBILE.MIN} digits`],
      maxlength: [STORE_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${STORE_VALIDATION.MOBILE.MAX} digits`],
      match: [STORE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      minlength: [STORE_VALIDATION.EMAIL.MIN, `Email must be at least ${STORE_VALIDATION.EMAIL.MIN} characters`],
      maxlength: [STORE_VALIDATION.EMAIL.MAX, `Email cannot exceed ${STORE_VALIDATION.EMAIL.MAX} characters`],
      match: [STORE_VALIDATION.EMAIL.PATTERN, 'Invalid email format'],
    },
    location: {
      type: String,
      trim: true,
      minlength: [STORE_VALIDATION.LOCATION.MIN, `Store location must be at least ${STORE_VALIDATION.LOCATION.MIN} characters`],
      maxlength: [STORE_VALIDATION.LOCATION.MAX, `Store location cannot exceed ${STORE_VALIDATION.LOCATION.MAX} characters`],
      default: null,
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

// Indexes for optimized query execution
storeSchema.index({ storeCode: 1, isDeleted: 1 });
storeSchema.index({ email: 1, isDeleted: 1 });
storeSchema.index({ name: 'text', storeCode: 'text', email: 'text', mobile: 'text', location: 'text' });

const Store = mongoose.model('Store', storeSchema);

export default Store;
