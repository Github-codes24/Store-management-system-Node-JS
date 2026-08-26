import mongoose from 'mongoose';

export const FIELD_TYPES_ENUM = [
  'Text',
  'Number',
  'Decimal',
  'Dropdown',
  'Multi-select',
  'Checkbox',
  'Color Picker',
  'Date',
];

const attributeSchema = new mongoose.Schema(
  {
    displayLabel: {
      type: String,
      required: [true, 'Display Label is required'],
      trim: true,
    },
    attributeKey: {
      type: String,
      required: [true, 'Attribute Key is required'],
      trim: true,
      lowercase: true,
    },
    // Backwards compatibility aliases
    attribute: {
      type: String,
      trim: true,
    },
    key: {
      type: String,
      trim: true,
      lowercase: true,
    },
    fieldType: {
      type: String,
      required: [true, 'Field Type is required'],
      enum: {
        values: FIELD_TYPES_ENUM,
        message: '{VALUE} is not a valid field type',
      },
    },
    productTypes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductType',
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory',
      },
    ],
    appliesTo: {
      type: [String],
      default: [],
    },
    placeholder: {
      type: String,
      trim: true,
      default: '',
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    options: {
      type: [String],
      default: [],
    },
    optionValues: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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

// Synchronize alias fields before save
attributeSchema.pre('save', function (next) {
  if (this.displayLabel && !this.attribute) {
    this.attribute = this.displayLabel;
  } else if (this.attribute && !this.displayLabel) {
    this.displayLabel = this.attribute;
  }

  if (this.attributeKey && !this.key) {
    this.key = this.attributeKey;
  } else if (this.key && !this.attributeKey) {
    this.attributeKey = this.key;
  }

  if (this.optionValues && this.optionValues.length > 0) {
    this.options = this.optionValues;
  } else if (this.options && this.options.length > 0) {
    this.optionValues = this.options;
  }

  next();
});

const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;