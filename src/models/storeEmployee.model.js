import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';
import { STORE_EMPLOYEE_VALIDATION } from '../constants/storeEmployee.constants.js';

const storeEmployeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [STORE_EMPLOYEE_VALIDATION.NAME.MIN, `Name must be at least ${STORE_EMPLOYEE_VALIDATION.NAME.MIN} characters`],
      maxlength: [STORE_EMPLOYEE_VALIDATION.NAME.MAX, `Name cannot exceed ${STORE_EMPLOYEE_VALIDATION.NAME.MAX} characters`],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email format'],
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      match: [STORE_EMPLOYEE_VALIDATION.USER_ID.PATTERN, 'Invalid User ID format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      match: [STORE_EMPLOYEE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'],
    },
    phone: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Assigned Store is required'],
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    resetOtp: {
      type: String,
      default: null,
      select: false,
    },
    resetOtpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    resetToken: {
      type: String,
      default: null,
      select: false,
    },
    resetTokenExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to encrypt password using crypto AES-256-CBC and sync phone/mobile
storeEmployeeSchema.pre('save', function (next) {
  if (this.mobile && !this.phone) {
    this.phone = this.mobile;
  } else if (this.phone && !this.mobile) {
    this.mobile = this.phone;
  }

  if (!this.isModified('password')) return next();

  try {
    // Encrypt password if not already encrypted (AES-256-CBC string format with IV prefix)
    const isEncrypted = typeof this.password === 'string' && this.password.includes(':') && this.password.length > 32;
    if (!isEncrypted) {
      this.password = encrypt(this.password);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Decrypt password helper method
storeEmployeeSchema.methods.getDecryptedPassword = function () {
  try {
    if (!this.password) return '';
    return decrypt(this.password);
  } catch (_err) {
    return this.password;
  }
};

// Instance method to compare password for login
storeEmployeeSchema.methods.comparePassword = function (candidatePassword) {
  try {
    const plainPassword = this.getDecryptedPassword();
    return candidatePassword === plainPassword;
  } catch (_err) {
    return false;
  }
};

// Indexes for optimized searching and filtering
storeEmployeeSchema.index({ email: 1, isDeleted: 1 });
storeEmployeeSchema.index({ userId: 1, isDeleted: 1 });
storeEmployeeSchema.index({ storeId: 1, isDeleted: 1 });
storeEmployeeSchema.index({ name: 'text', email: 'text', mobile: 'text', userId: 'text', designation: 'text' });

const StoreEmployee = mongoose.model('StoreEmployee', storeEmployeeSchema);

export default StoreEmployee;
