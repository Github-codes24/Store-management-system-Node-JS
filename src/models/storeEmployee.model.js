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
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
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
    username: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to automatically generate and clean username
storeEmployeeSchema.pre('validate', async function (next) {
  if (this.isModified('name') || this.isModified('username') || this.isNew) {
    let base = this.username || this.name || '';
    let baseUsername = base
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove symbols, emojis, punctuation
      .replace(/[\s-]+/g, '_');  // Replace spaces and hyphens with underscores

    if (!baseUsername) {
      baseUsername = 'employee';
    }

    let username = baseUsername;
    let count = 0;
    while (true) {
      const existing = await this.constructor.findOne({ username });
      if (!existing || existing._id.equals(this._id)) {
        break;
      }
      count++;
      username = `${baseUsername}_${count}`;
    }
    this.username = username;
  }
  next();
});

const StoreEmployee = mongoose.model('StoreEmployee', storeEmployeeSchema);

export default StoreEmployee;

