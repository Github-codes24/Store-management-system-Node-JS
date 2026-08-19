import mongoose from 'mongoose';

const storeEmployeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    profileImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const StoreEmployee = mongoose.model('StoreEmployee', storeEmployeeSchema);

export default StoreEmployee;
