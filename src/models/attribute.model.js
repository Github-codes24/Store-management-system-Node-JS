import mongoose from 'mongoose';

const attributeSchema = new mongoose.Schema(
  {
    attribute: {
      type: String,
      required: true,
      trim: true,
    },

    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    fieldType: {
      type: String,
      required: true,
      enum: [
        'Multi-select',
        'Color Picker',
        'Dropdown',
        'Text',
        'Date',
        'Number',
      ],
    },

    appliesTo: {
      type: [String],
      default: [],
    },

    options: {
      type: [String],
      default: [],
    },

    status: {
      type: Boolean,
      default: true,
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

const Attribute = mongoose.model('Attribute', attributeSchema);

export default Attribute;