import mongoose from 'mongoose';

const cmsPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    effectiveDate: {
      type: String,
      trim: true,
      default: '1st September, 2026',
    },
    content: {
      type: String,
      required: true,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const CmsPage = mongoose.models.CmsPage || mongoose.model('CmsPage', cmsPageSchema);

export default CmsPage;
