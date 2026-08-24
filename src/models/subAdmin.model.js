import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const DESIGNATION_ENUM = [
  'Warehouse Manager',
  'Store Manager',
  'Manager',
  'Cashier',
  'Billing Manager',
];

const subAdminSchema = new mongoose.Schema(
  {
    employeeName: {
      type: String,
      required: [true, 'Employee Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    designation: {
      type: String,
      enum: {
        values: DESIGNATION_ENUM,
        message: '{VALUE} is not a valid designation',
      },
      required: [true, 'Designation is required'],
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    role: {
      type: String,
      default: 'subadmin',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password if modified
subAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
subAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const SubAdmin = mongoose.model('SubAdmin', subAdminSchema);

export default SubAdmin;
export { DESIGNATION_ENUM };
